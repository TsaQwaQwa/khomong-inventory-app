import { connectDB } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { BusinessDay } from "@/models/BusinessDay";
import { Purchase } from "@/models/Purchase";
import { Adjustment } from "@/models/Adjustment";
import { Product } from "@/models/Product";
import { Price } from "@/models/Price";
import { StockCount } from "@/models/StockCount";

type ProductMeta = {
	name: string;
	reorderLevelUnits: number;
	packSize: number;
};

type ProductCount = {
	productId: string;
	countedUnits: number;
};

type PurchaseWithItems = {
	items?: {
		productId: string;
		units?: number;
	}[];
};

type AdjustmentWithItems = {
	items?: {
		productId: string;
		unitsDelta?: number;
	}[];
};

type PriceRow = {
	productId: string;
	priceCents?: number;
};

export interface DailyStockMovementRow {
	productId: string;
	productName: string;
	openingUnits: number | null;
	purchasedUnits: number;
	adjustments: number;
	closingUnits: number | null;
	unitsSold: number;
	unitPriceCents: number;
	expectedRevenueCents: number;
	missingOpeningCount: boolean;
	missingClosingCount: boolean;
}

export interface DailyStockMovementSummary {
	date: string;
	nextDate: string;
	hasOpeningCount: boolean;
	hasClosingCount: boolean;
	missingOpeningProductIds: string[];
	missingClosingProductIds: string[];
	warnings: string[];
	rows: DailyStockMovementRow[];
}

const sumPurchaseUnits = (purchases: PurchaseWithItems[]) => {
	const byProduct = new Map<string, number>();
	for (const purchase of purchases) {
		for (const item of purchase.items ?? []) {
			byProduct.set(
				item.productId,
				(byProduct.get(item.productId) ?? 0) + (item.units ?? 0),
			);
		}
	}
	return byProduct;
};

const sumAdjustmentUnits = (adjustments: AdjustmentWithItems[]) => {
	const byProduct = new Map<string, number>();
	for (const adjustment of adjustments) {
		for (const item of adjustment.items ?? []) {
			byProduct.set(
				item.productId,
				(byProduct.get(item.productId) ?? 0) + (item.unitsDelta ?? 0),
			);
		}
	}
	return byProduct;
};

const latestPriceByProduct = (prices: PriceRow[]) => {
	const priceByProduct = new Map<string, number>();
	for (const price of prices) {
		if (priceByProduct.has(price.productId)) continue;
		priceByProduct.set(price.productId, price.priceCents ?? 0);
	}
	return priceByProduct;
};

const addMapInto = (
	target: Map<string, number>,
	source: Map<string, number>,
) => {
	for (const [productId, value] of source.entries()) {
		target.set(productId, (target.get(productId) ?? 0) + value);
	}
};

async function getAdjustmentsForDate(date: string) {
	const day = await BusinessDay.findOne({ date })
		.select({ _id: 1 })
		.lean();

	if (!day) return [];

	return Adjustment.find({ businessDayId: String(day._id) })
		.select({ items: 1 })
		.lean<AdjustmentWithItems[]>();
}

export async function computeDailyStockMovement(
	date: string,
): Promise<DailyStockMovementSummary> {
	await connectDB();

	const nextDate = addDays(date, 1);
	const [products, openingCounts, closingCounts, purchases, prices] =
		await Promise.all([
			Product.find({ isActive: true })
				.select({ _id: 1, name: 1, reorderLevelUnits: 1, packSize: 1 })
				.lean(),
			StockCount.find({ date, status: "COMPLETED" })
				.select({ productId: 1, countedUnits: 1 })
				.lean<ProductCount[]>(),
			StockCount.find({ date: nextDate, status: "COMPLETED" })
				.select({ productId: 1, countedUnits: 1 })
				.lean<ProductCount[]>(),
			Purchase.find({ purchaseDate: date })
				.select({ items: 1 })
				.lean<PurchaseWithItems[]>(),
			Price.find({ effectiveFrom: { $lte: date } })
				.sort({ productId: 1, effectiveFrom: -1, createdAt: -1 })
				.select({ productId: 1, priceCents: 1 })
				.lean<PriceRow[]>(),
		]);

	const adjustments = await getAdjustmentsForDate(date);

	const productById = new Map<string, ProductMeta>();
	for (const product of products) {
		productById.set(String(product._id), {
			name: product.name,
			reorderLevelUnits: product.reorderLevelUnits ?? 0,
			packSize: product.packSize ?? 1,
		});
	}

	const openingByProduct = new Map(
		openingCounts.map((count) => [count.productId, count.countedUnits]),
	);
	const closingByProduct = new Map(
		closingCounts.map((count) => [count.productId, count.countedUnits]),
	);
	const purchasedByProduct = sumPurchaseUnits(purchases);
	const adjustedByProduct = sumAdjustmentUnits(adjustments);
	const priceByProduct = latestPriceByProduct(prices);

	const productIds = new Set<string>();
	for (const id of productById.keys()) productIds.add(id);
	for (const id of openingByProduct.keys()) productIds.add(id);
	for (const id of closingByProduct.keys()) productIds.add(id);
	for (const id of purchasedByProduct.keys()) productIds.add(id);
	for (const id of adjustedByProduct.keys()) productIds.add(id);

	const missingOpeningProductIds: string[] = [];
	const missingClosingProductIds: string[] = [];
	const rows: DailyStockMovementRow[] = [];

	for (const productId of productIds) {
		const meta = productById.get(productId);
		const openingUnits = openingByProduct.has(productId)
			? openingByProduct.get(productId)!
			: null;
		const closingUnits = closingByProduct.has(productId)
			? closingByProduct.get(productId)!
			: null;
		const purchasedUnits = purchasedByProduct.get(productId) ?? 0;
		const adjustmentUnits = adjustedByProduct.get(productId) ?? 0;
		const missingOpeningCount = openingUnits === null;
		const missingClosingCount = closingUnits === null;

		if (missingOpeningCount) missingOpeningProductIds.push(productId);
		if (missingClosingCount) missingClosingProductIds.push(productId);

		const unitsSold =
			openingUnits === null || closingUnits === null
				? 0
				: Math.max(
						0,
						openingUnits + purchasedUnits + adjustmentUnits - closingUnits,
				  );
		const unitPriceCents = priceByProduct.get(productId) ?? 0;

		rows.push({
			productId,
			productName: meta?.name ?? "(unknown product)",
			openingUnits,
			purchasedUnits,
			adjustments: adjustmentUnits,
			closingUnits,
			unitsSold,
			unitPriceCents,
			expectedRevenueCents: unitsSold * unitPriceCents,
			missingOpeningCount,
			missingClosingCount,
		});
	}

	const warnings: string[] = [];
	if (openingCounts.length === 0) {
		warnings.push(
			"Morning stock count is missing. Daily movement cannot be calculated reliably.",
		);
	}
	if (closingCounts.length === 0) {
		warnings.push(
			`Next morning stock count (${nextDate}) is missing. Sold quantities for ${date} are incomplete until that count is finalized.`,
		);
	}
	if (missingOpeningProductIds.length > 0 && openingCounts.length > 0) {
		warnings.push(
			`${missingOpeningProductIds.length} product(s) are missing from the opening count.`,
		);
	}
	if (missingClosingProductIds.length > 0 && closingCounts.length > 0) {
		warnings.push(
			`${missingClosingProductIds.length} product(s) are missing from the next morning count.`,
		);
	}

	return {
		date,
		nextDate,
		hasOpeningCount: openingCounts.length > 0,
		hasClosingCount: closingCounts.length > 0,
		missingOpeningProductIds,
		missingClosingProductIds,
		warnings,
		rows: rows.sort((a, b) => {
			if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
			return a.productName.localeCompare(b.productName);
		}),
	};
}

export async function computeMovementRowsForDateRange(
	from: string,
	to: string,
) {
	const rows: DailyStockMovementRow[] = [];
	let cursor = from;
	while (cursor <= to) {
		const summary = await computeDailyStockMovement(cursor);
		rows.push(...summary.rows);
		cursor = addDays(cursor, 1);
	}
	return rows;
}

export async function computeStockPositionAsOfDate(date: string) {
	await connectDB();

	const products = await Product.find({ isActive: true })
		.select({ _id: 1 })
		.lean();
	const productIds = products.map((product) => String(product._id));
	if (productIds.length === 0) return new Map<string, number>();

	const latestCounts = await StockCount.aggregate<{
		_id: string;
		date: string;
		countedUnits: number;
	}>([
		{
			$match: {
				productId: { $in: productIds },
				status: "COMPLETED",
				date: { $lte: date },
			},
		},
		{ $sort: { productId: 1, date: -1, countedAt: -1 } },
		{
			$group: {
				_id: "$productId",
				date: { $first: "$date" },
				countedUnits: { $first: "$countedUnits" },
			},
		},
	]);

	const stockByProduct = new Map<string, number>();
	const countDateByProduct = new Map<string, string>();
	for (const count of latestCounts) {
		stockByProduct.set(count._id, count.countedUnits);
		countDateByProduct.set(count._id, count.date);
	}

	const purchaseDeltas = new Map<string, number>();
	const adjustmentDeltas = new Map<string, number>();

	const earliestCountDate = latestCounts
		.map((count) => count.date)
		.sort()[0];

	if (!earliestCountDate) return stockByProduct;

	const [purchases, businessDays] = await Promise.all([
		Purchase.find({ purchaseDate: { $gte: earliestCountDate, $lte: date } })
			.select({ purchaseDate: 1, items: 1 })
			.lean<(PurchaseWithItems & { purchaseDate: string })[]>(),
		BusinessDay.find({ date: { $gte: earliestCountDate, $lte: date } })
			.select({ _id: 1, date: 1 })
			.lean<{ _id: unknown; date: string }[]>(),
	]);

	for (const purchase of purchases) {
		for (const item of purchase.items ?? []) {
			const countDate = countDateByProduct.get(item.productId);
			if (!countDate || purchase.purchaseDate < countDate) continue;
			purchaseDeltas.set(
				item.productId,
				(purchaseDeltas.get(item.productId) ?? 0) + (item.units ?? 0),
			);
		}
	}

	const dayDateById = new Map(
		businessDays.map((day) => [String(day._id), day.date]),
	);
	const dayIds = Array.from(dayDateById.keys());
	if (dayIds.length > 0) {
		const adjustments = await Adjustment.find({ businessDayId: { $in: dayIds } })
			.select({ businessDayId: 1, items: 1 })
			.lean<(AdjustmentWithItems & { businessDayId: string })[]>();

		for (const adjustment of adjustments) {
			const adjustmentDate = dayDateById.get(adjustment.businessDayId);
			if (!adjustmentDate) continue;
			for (const item of adjustment.items ?? []) {
				const countDate = countDateByProduct.get(item.productId);
				if (!countDate || adjustmentDate < countDate) continue;
				adjustmentDeltas.set(
					item.productId,
					(adjustmentDeltas.get(item.productId) ?? 0) +
						(item.unitsDelta ?? 0),
				);
			}
		}
	}

	addMapInto(stockByProduct, purchaseDeltas);
	addMapInto(stockByProduct, adjustmentDeltas);
	return stockByProduct;
}
