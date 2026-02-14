export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { productCreateSchema } from "@/lib/schemas";
import { Product } from "@/models/Product";
import { Price } from "@/models/Price";
import { Purchase } from "@/models/Purchase";
import { Adjustment } from "@/models/Adjustment";
import { TabTransaction } from "@/models/TabTransaction";
import { SaleTransaction } from "@/models/SaleTransaction";
import { serializeDoc, serializeDocs } from "@/lib/serialize";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

type TotalsRow = {
	_id: string;
	units: number;
};

export async function GET(req: Request) {
	await requireOrgAuth().catch(() => null);

	await connectDB();
	const url = new URL(req.url);
	const includeStock =
		url.searchParams.get("includeStock") === "1";

	const products = await Product.find({
		isActive: true,
	})
		.sort({ name: 1 })
		.lean();
	const productIds = products.map((p) =>
		String(p._id),
	);
	const priceDocs = await Price.find({
		productId: { $in: productIds },
	})
		.sort({ effectiveFrom: -1, createdAt: -1 })
		.lean();
	const priceMap = new Map<string, number>();
	for (const price of priceDocs) {
		if (priceMap.has(price.productId)) continue;
		priceMap.set(price.productId, price.priceCents);
	}
	const productsWithPrice = products.map(
		(product) => ({
			...product,
			currentPriceCents: priceMap.get(
				String(product._id),
			),
		}),
	);

	if (!includeStock) {
		return ok(serializeDocs(productsWithPrice));
	}

	const [
		purchasedTotals,
		adjustmentTotals,
		tabSoldTotals,
		directSoldTotals,
	] = await Promise.all([
		Purchase.aggregate<TotalsRow>([
			{ $unwind: "$items" },
			{
				$group: {
					_id: "$items.productId",
					units: {
						$sum: {
							$ifNull: ["$items.units", 0],
						},
					},
				},
			},
		]),
		Adjustment.aggregate<TotalsRow>([
			{ $unwind: "$items" },
			{
				$group: {
					_id: "$items.productId",
					units: {
						$sum: {
							$ifNull: [
								"$items.unitsDelta",
								0,
							],
						},
					},
				},
			},
		]),
		TabTransaction.aggregate<TotalsRow>([
			{ $match: { type: "CHARGE" } },
			{ $unwind: "$items" },
			{
				$group: {
					_id: "$items.productId",
					units: {
						$sum: {
							$ifNull: ["$items.units", 0],
						},
					},
				},
			},
		]),
		SaleTransaction.aggregate<TotalsRow>([
			{ $unwind: "$items" },
			{
				$group: {
					_id: "$items.productId",
					units: {
						$sum: {
							$ifNull: ["$items.units", 0],
						},
					},
				},
			},
		]),
	]);

	const purchasedByProduct = new Map(
		purchasedTotals.map((row) => [row._id, row.units]),
	);
	const adjustedByProduct = new Map(
		adjustmentTotals.map((row) => [row._id, row.units]),
	);
	const tabSoldByProduct = new Map(
		tabSoldTotals.map((row) => [row._id, row.units]),
	);
	const directSoldByProduct = new Map(
		directSoldTotals.map((row) => [row._id, row.units]),
	);

	const productsWithPriceAndStock = productsWithPrice.map(
		(product) => {
			const productId = String(product._id);
			const purchased =
				purchasedByProduct.get(productId) ?? 0;
			const adjusted =
				adjustedByProduct.get(productId) ?? 0;
			const sold =
				(tabSoldByProduct.get(productId) ?? 0) +
				(directSoldByProduct.get(productId) ?? 0);
			const currentUnits =
				purchased + adjusted - sold;
			const reorderLevelUnits =
				product.reorderLevelUnits ?? 0;
			const stockStatus =
				currentUnits <= 0
					? "OUT"
					: currentUnits <= reorderLevelUnits
						? "LOW"
						: "OK";
			return {
				...product,
				currentUnits,
				stockStatus,
			};
		},
	);
	return ok(serializeDocs(productsWithPriceAndStock));
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
			productCreateSchema,
		);
		const created = await Product.create({
			...input,
		});
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "CREATE",
			entityType: "Product",
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
		if (msg.includes("E11000"))
			return fail("Product already exists", {
				status: 409,
				code: "DUPLICATE",
			});
		return fail("Failed to create product", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
