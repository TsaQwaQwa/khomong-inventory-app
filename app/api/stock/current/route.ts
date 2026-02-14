export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Adjustment } from "@/models/Adjustment";
import { TabTransaction } from "@/models/TabTransaction";
import { SaleTransaction } from "@/models/SaleTransaction";

type TotalsRow = {
	_id: string;
	units: number;
};

export async function GET() {
	try {
		await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();

	try {
		const [
			products,
			purchasedTotals,
			adjustmentTotals,
			tabSoldTotals,
			directSoldTotals,
		] = await Promise.all([
			Product.find({ isActive: true })
				.select({
					_id: 1,
					name: 1,
					category: 1,
					reorderLevelUnits: 1,
				})
				.sort({ name: 1 })
				.lean(),
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

		const rows = products.map((product) => {
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
			const status =
				currentUnits <= 0
					? "OUT"
					: currentUnits <= reorderLevelUnits
						? "LOW"
						: "OK";

			return {
				productId,
				productName: product.name,
				category: product.category,
				currentUnits,
				reorderLevelUnits,
				status,
			};
		});

		return ok(rows);
	} catch {
		return fail("Failed to load current stock", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}

