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
