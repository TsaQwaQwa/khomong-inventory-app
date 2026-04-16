import { Purchase } from "@/models/Purchase";
import { Adjustment } from "@/models/Adjustment";
import { TabTransaction } from "@/models/TabTransaction";

type TotalsRow = {
	_id: string;
	units: number;
};

export async function getCurrentStockByProductIds(
	productIds: string[],
) {
	const normalizedIds = Array.from(
		new Set(
			productIds.filter(
				(id) =>
					typeof id === "string" &&
					id.length > 0,
			),
		),
	);

	if (normalizedIds.length === 0) {
		return new Map<string, number>();
	}

	const [
		purchasedTotals,
		adjustmentTotals,
		tabSoldTotals,
	] = await Promise.all([
		Purchase.aggregate<TotalsRow>([
			{ $unwind: "$items" },
			{
				$match: {
					"items.productId": {
						$in: normalizedIds,
					},
				},
			},
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
				$match: {
					"items.productId": {
						$in: normalizedIds,
					},
				},
			},
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
				$match: {
					"items.productId": {
						$in: normalizedIds,
					},
				},
			},
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
		purchasedTotals.map((row) => [
			row._id,
			row.units,
		]),
	);
	const adjustedByProduct = new Map(
		adjustmentTotals.map((row) => [
			row._id,
			row.units,
		]),
	);
	const tabSoldByProduct = new Map(
		tabSoldTotals.map((row) => [
			row._id,
			row.units,
		]),
	);

	const stockByProduct = new Map<string, number>();

	for (const productId of normalizedIds) {
		const purchased =
			purchasedByProduct.get(productId) ?? 0;
		const adjusted =
			adjustedByProduct.get(productId) ?? 0;
		const sold =
			tabSoldByProduct.get(productId) ?? 0;

		stockByProduct.set(
			productId,
			purchased + adjusted - sold,
		);
	}

	return stockByProduct;
}