export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { directSaleSchema } from "@/lib/schemas";
import { getOrCreateDay } from "@/lib/businessDay";
import { Product } from "@/models/Product";
import { Price } from "@/models/Price";
import { SaleTransaction } from "@/models/SaleTransaction";
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
			directSaleSchema,
		);
		const date = input.date ?? todayYMD();
		const day = await getOrCreateDay(
			date,
			a.userId!,
		);

		const productIds = input.items.map(
			(item) => item.productId,
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
			discountCents?: number;
		}[] = [];
		for (const item of input.items) {
			const unitPriceCents = await getPrice(
				item.productId,
				date,
			);
			if (unitPriceCents === null)
				return fail(
					`No price set for productId=${item.productId} on ${date}`,
					{ status: 400, code: "NO_PRICE" },
				);

			rawLines.push({
				productId: item.productId,
				units: item.units,
				unitPriceCents,
				discountCents: item.discountCents,
			});
		}
		const totals = calculateSaleTotals(
			rawLines,
			input.discountCents,
		);
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
				`Below-cost sale detected: ${detail}. Confirm override to continue.`,
				{
					status: 409,
					code: "BELOW_COST",
				},
			);
		}

		const created =
			await SaleTransaction.create({
				businessDayId: String(day._id),
				paymentMethod: input.paymentMethod,
				subtotalCents: totals.subtotalCents,
				discountCents: totals.discountCents,
				amountCents: totals.amountCents,
				items: itemsWithPrice,
				note: input.note,
				createdByUserId: a.userId!,
			});
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "CREATE",
			entityType: "SaleTransaction",
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
		return fail("Failed to create sale transaction", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
