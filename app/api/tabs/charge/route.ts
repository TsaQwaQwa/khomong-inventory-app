export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { tabChargeSchema } from "@/lib/schemas";
import { getOrCreateDay } from "@/lib/businessDay";
import { TabAccount } from "@/models/TabAccount";
import { TabTransaction } from "@/models/TabTransaction";
import { Customer } from "@/models/Customer";
import { Product } from "@/models/Product";
import { Price } from "@/models/Price";
import { todayYMD } from "@/lib/dates";
import { serializeDoc } from "@/lib/serialize";
import { calculateSaleTotals } from "@/lib/sales-pricing";
import { getCurrentStockByProductIds } from "@/lib/stock-availability";
import { findBelowCostViolations } from "@/lib/margin-guardrails";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

async function getPrice(
	productId: string,
	date: string,
): Promise<number | null> {
	const p = await Price.findOne({
		productId,
		effectiveFrom: { $lte: date },
		$or: [
			{ effectiveTo: { $exists: false } },
			{ effectiveTo: null },
			{ effectiveTo: { $gte: date } },
		],
	})
		.sort({ effectiveFrom: -1 })
		.lean();
	return p?.priceCents ?? null;
}

export async function POST(req: Request) {
	let a;
	try {
		a = await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();
	try {
		const input = await parseJson(
			req,
			tabChargeSchema,
		);
		const date = input.date ?? todayYMD();
		const day = await getOrCreateDay(
			date,
			a.userId!,
		);

		const account = await TabAccount.findOne({
			customerId: input.customerId,
		}).lean();
		const customer = await Customer.findById(
			input.customerId,
		)
			.select({ customerMode: 1 })
			.lean();
		if (!account)
			return fail("Tab account not found", {
				status: 404,
				code: "NOT_FOUND",
			});
		if (account.status !== "ACTIVE")
			return fail("Tab account blocked", {
				status: 403,
				code: "BLOCKED",
			});

		// Compute amount from line items (price locked per line)
		const productIds = input.items.map(
			(i) => i.productId,
		);
		const products = await Product.find({
			_id: { $in: productIds },
		}).lean();
		const productSet = new Set(
			products.map((p) => String(p._id)),
		);
		for (const id of productIds) {
			if (!productSet.has(id))
				return fail(`Invalid productId: ${id}`, {
					status: 400,
					code: "INVALID_PRODUCT",
				});
		}
		const requestedUnitsByProduct = new Map<
			string,
			number
		>();
		for (const item of input.items) {
			requestedUnitsByProduct.set(
				item.productId,
				(requestedUnitsByProduct.get(
					item.productId,
				) ?? 0) + item.units,
			);
		}
		const stockByProduct =
			await getCurrentStockByProductIds(
				Array.from(requestedUnitsByProduct.keys()),
			);
		const productNameById = new Map(
			products.map((product) => [
				String(product._id),
				product.name,
			]),
		);
		const insufficient = Array.from(
			requestedUnitsByProduct.entries(),
		).filter(([productId, requestedUnits]) => {
			const availableUnits =
				stockByProduct.get(productId) ?? 0;
			return requestedUnits > availableUnits;
		});
		if (insufficient.length > 0) {
			const detail = insufficient
				.map(([productId, requestedUnits]) => {
					const availableUnits =
						stockByProduct.get(productId) ?? 0;
					const productName =
						productNameById.get(productId) ??
						"Unknown product";
					return `${productName} (available ${availableUnits}, requested ${requestedUnits})`;
				})
				.join("; ");
			return fail(
				`Insufficient stock: ${detail}`,
				{
					status: 409,
					code: "INSUFFICIENT_STOCK",
				},
			);
		}

		const itemsWithPrice = [];
		const rawLines: {
			productId: string;
			units: number;
			unitPriceCents: number;
		}[] = [];
		for (const it of input.items) {
			const unitPriceCents = await getPrice(
				it.productId,
				date,
			);
			if (unitPriceCents === null)
				return fail(
					`No price set for productId=${it.productId} on ${date}`,
					{ status: 400, code: "NO_PRICE" },
				);
			rawLines.push({
				productId: it.productId,
				units: it.units,
				unitPriceCents,
			});
		}
		const totals = calculateSaleTotals(rawLines);
		itemsWithPrice.push(...totals.items);
		const belowCostViolations =
			await findBelowCostViolations({
				date,
				lines: totals.items.map((line) => ({
					productId: line.productId,
					unitPriceCents: line.unitPriceCents,
				})),
			});
		if (
			belowCostViolations.length > 0 &&
			!input.belowCostApproved
		) {
			const detail = belowCostViolations
				.map(
					(violation) =>
						`${violation.productName} (sell ${violation.unitPriceCents}c, cost ${violation.baselineCostCents}c)`,
				)
				.join("; ");
			return fail(
				`Below-cost account sale detected: ${detail}. Confirm override to continue.`,
				{
					status: 409,
					code: "BELOW_COST",
				},
			);
		}

		// Naive balance check (starter): compute current balance from ledger
		const agg = await TabTransaction.aggregate([
			{
				$match: { customerId: input.customerId },
			},
			{
				$group: {
					_id: null,
					charges: {
						$sum: {
							$cond: [
								{ $eq: ["$type", "CHARGE"] },
								"$amountCents",
								0,
							],
						},
					},
					payments: {
						$sum: {
							$cond: [
								{ $eq: ["$type", "PAYMENT"] },
								"$amountCents",
								0,
							],
						},
					},
					adjustments: {
						$sum: {
							$cond: [
								{ $eq: ["$type", "ADJUSTMENT"] },
								"$amountCents",
								0,
							],
						},
					},
				},
			},
		]).then(
			(r) =>
				r?.[0] ?? {
					charges: 0,
					payments: 0,
					adjustments: 0,
				},
		);

		const balance =
			(agg.charges ?? 0) -
			(agg.payments ?? 0) +
			(agg.adjustments ?? 0);
		const enforceCreditLimit =
			customer?.customerMode !== "DEBT_ONLY";
		if (
			enforceCreditLimit &&
			balance + totals.amountCents >
			account.creditLimitCents
		) {
			return fail("Credit limit exceeded", {
				status: 403,
				code: "CREDIT_LIMIT",
			});
		}

		const created = await TabTransaction.create({
			customerId: input.customerId,
			businessDayId: String(day._id),
			type: "CHARGE",
			subtotalCents: totals.subtotalCents,
			amountCents: totals.amountCents,
			items: itemsWithPrice,
			note: input.note,
			createdByUserId: a.userId!,
		});
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "CREATE",
			entityType: "TabTransaction",
			entityId: String(created._id),
			oldValues: null,
			newValues: toAuditObject(created.toObject()),
		});

		return ok(serializeDoc(created.toObject()), {
			status: 201,
		});
	} catch (e: any) {
		const msg = String(e?.message ?? e);
		if (msg.startsWith("VALIDATION_ERROR:"))
			return fail(
				msg.replace("VALIDATION_ERROR:", ""),
				{ status: 400, code: "VALIDATION_ERROR" },
			);
		return fail("Failed to create tab charge", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
