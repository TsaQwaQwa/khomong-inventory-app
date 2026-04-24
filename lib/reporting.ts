import { connectDB } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { BusinessDay } from "@/models/BusinessDay";
import { Purchase } from "@/models/Purchase";
import { Adjustment } from "@/models/Adjustment";
import { Product } from "@/models/Product";
import { TabTransaction } from "@/models/TabTransaction";
import { TabAccount } from "@/models/TabAccount";
import {
	computeDailyStockMovement,
	computeMovementRowsForDateRange,
	computeStockPositionAsOfDate,
} from "@/lib/stock-movement";
import type {
	DailyReport,
	DailyReportProduct,
	PaymentMethod,
} from "@/lib/types";

export async function getOrCreateBusinessDay(
	date: string,
	userId: string,
) {
	await connectDB();

	const existing = await BusinessDay.findOne({ date }).lean();
	if (existing) return existing;

	const created = await BusinessDay.create({
		date,
		status: "OPEN",
		openedByUserId: userId,
		openedAt: new Date(),
	});

	return created.toObject();
}

async function getCalculatedSalesForDate(
	date: string,
): Promise<number | null> {
	const movement = await computeDailyStockMovement(date);
	if (!movement.hasOpeningCount || !movement.hasClosingCount) return null;

	return movement.rows.reduce(
		(sum, row) => sum + row.expectedRevenueCents,
		0,
	);
}

async function getOutstandingTabBalances(date: string) {
	const day = await BusinessDay.findOne({ date }).lean();
	if (!day) {
		return {
			outstandingTabBalanceCents: 0,
			overdueTabBalanceCents: 0,
		};
	}

	const customersWithAccounts = await TabTransaction.aggregate<{
		_id: string;
		charges: number;
		payments: number;
		adjustments: number;
		lastChargeAt: Date | null;
	}>([
		{
			$group: {
				_id: "$customerId",
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
				lastChargeAt: {
					$max: {
						$cond: [
							{ $eq: ["$type", "CHARGE"] },
							"$createdAt",
							null,
						],
					},
				},
			},
		},
		{
			$match: {
				_id: { $type: "string" },
			},
		},
	]);

	const customerIds = customersWithAccounts
		.map((entry) => entry._id)
		.filter(
			(id): id is string => typeof id === "string" && id.length > 0,
		);

	if (customerIds.length === 0) {
		return {
			outstandingTabBalanceCents: 0,
			overdueTabBalanceCents: 0,
		};
	}

	const accounts = await TabAccount.find({
		customerId: { $in: customerIds },
	})
		.select({ customerId: 1, dueDays: 1 })
		.lean();

	const dueDaysByCustomerId = new Map(
		accounts.map((account) => [
			String(account.customerId),
			typeof account.dueDays === "number" ? account.dueDays : undefined,
		]),
	);

	let outstandingTabBalanceCents = 0;
	let overdueTabBalanceCents = 0;

	for (const entry of customersWithAccounts) {
		const balance =
			(entry.charges ?? 0) -
			(entry.payments ?? 0) +
			(entry.adjustments ?? 0);

		if (balance <= 0) continue;

		outstandingTabBalanceCents += balance;

		const dueDays = dueDaysByCustomerId.get(entry._id);
		if (!dueDays || !entry.lastChargeAt) continue;

		const dueAt = new Date(entry.lastChargeAt);
		dueAt.setDate(dueAt.getDate() + dueDays);

		if (dueAt < new Date(`${date}T23:59:59.999Z`)) {
			overdueTabBalanceCents += balance;
		}
	}

	return {
		outstandingTabBalanceCents,
		overdueTabBalanceCents,
	};
}

type PurchaseCostSummary = {
	costCents: number;
	units: number;
};

async function getPurchaseCostTotalsByProduct(date: string) {
	const totals = new Map<string, PurchaseCostSummary>();
	const purchasesToDate = await Purchase.find({
		purchaseDate: { $lte: date },
	})
		.select({ items: 1 })
		.lean();

	for (const purchase of purchasesToDate) {
		for (const item of purchase.items ?? []) {
			if (
				typeof item.unitCostCents !== "number" ||
				item.unitCostCents < 0 ||
				(item.units ?? 0) <= 0
			) {
				continue;
			}

			const existing = totals.get(item.productId) ?? {
				costCents: 0,
				units: 0,
			};

			totals.set(item.productId, {
				costCents:
					existing.costCents + item.unitCostCents * (item.units ?? 0),
				units: existing.units + (item.units ?? 0),
			});
		}
	}

	return totals;
}

function paymentBuckets() {
	return {
		CASH: 0,
		CARD: 0,
		EFT: 0,
	};
}

export async function computeDailySummary(
	date: string,
	userId: string,
): Promise<DailyReport> {
	await connectDB();

	const day = await getOrCreateBusinessDay(date, userId);
	const movement = await computeDailyStockMovement(date);

	const [purchases, adjustments, payments, expenses, products] = await Promise.all([
		Purchase.find({ purchaseDate: date }).lean(),
		Adjustment.find({ businessDayId: String(day._id) }).lean(),
		TabTransaction.find({
			businessDayId: String(day._id),
			type: "PAYMENT",
		}).lean(),
		TabTransaction.find({
			businessDayId: String(day._id),
			type: "EXPENSE",
		})
			.select({ amountCents: 1 })
			.lean(),
		Product.find({}).lean(),
	]);

	const tabPaymentsByMethodCents: Record<PaymentMethod, number> =
		paymentBuckets();

	for (const payment of payments) {
		const method = (payment.paymentMethod ?? "CASH") as PaymentMethod;
		tabPaymentsByMethodCents[method] += payment.amountCents ?? 0;
	}

	const expensesCents = expenses.reduce(
		(sum, expense) => sum + (expense.amountCents ?? 0),
		0,
	);

	const expectedRevenueCents = movement.rows.reduce(
		(sum, row) => sum + row.expectedRevenueCents,
		0,
	);

	const byProduct: DailyReportProduct[] = movement.rows.map((row) => ({
		productId: row.productId,
		productName: row.productName,
		unitsSold: row.unitsSold,
		unitPriceCents: row.unitPriceCents,
		expectedRevenueCents: row.expectedRevenueCents,
		purchasedUnits: row.purchasedUnits,
		adjustments: row.adjustments,
		openingUnits: row.openingUnits,
		closingUnits: row.closingUnits,
		missingOpeningCount: row.missingOpeningCount,
		missingClosingCount: row.missingClosingCount,
	}));

	const purchaseCostTotalsByProduct = await getPurchaseCostTotalsByProduct(date);
	let estimatedCogsCents = 0;

	for (const item of byProduct) {
		const costSummary = purchaseCostTotalsByProduct.get(item.productId);
		if (!costSummary || costSummary.units <= 0) continue;

		const avgUnitCost = costSummary.costCents / costSummary.units;
		estimatedCogsCents += Math.round(item.unitsSold * avgUnitCost);
	}

	const grossProfitCents = expectedRevenueCents - estimatedCogsCents;
	const grossMarginPct =
		expectedRevenueCents > 0
			? (grossProfitCents / expectedRevenueCents) * 100
			: null;
	const netProfitAfterExpensesCents = grossProfitCents - expensesCents;

	const hasMorningCount = movement.hasOpeningCount;
	const hasNextMorningCount = movement.hasClosingCount;
	const hasPurchases = purchases.length > 0;
	const hasTabActivity = payments.length > 0;
	const hasAdjustments = adjustments.length > 0;

	const previousDate = addDays(date, -1);
	const previousCalculatedSalesCents =
		await getCalculatedSalesForDate(previousDate);

	const salesChangeCents =
		previousCalculatedSalesCents === null
			? null
			: expectedRevenueCents - previousCalculatedSalesCents;

	const salesChangePct =
		previousCalculatedSalesCents === null ||
		previousCalculatedSalesCents === 0 ||
		salesChangeCents === null
			? null
			: (salesChangeCents / previousCalculatedSalesCents) * 100;

	const topProducts = [...byProduct]
		.sort((a, b) => b.unitsSold - a.unitsSold)
		.slice(0, 3)
		.map((item) => ({
			productId: item.productId,
			productName: item.productName,
			unitsSold: item.unitsSold,
			revenueCents: item.expectedRevenueCents,
		}));

	const recommendations: DailyReport["recommendations"] = [];

	if (!hasMorningCount) {
		recommendations.push({
			priority: "HIGH",
			title: "Start Morning Count",
			detail:
				"Capture opening stock before trading starts. Daily sold units cannot be calculated without it.",
		});
	}

	if (!hasNextMorningCount) {
		recommendations.push({
			priority: "HIGH",
			title: "Missing Next Morning Count",
			detail:
				"Finalize the next morning count before trusting this day's calculated sold quantities.",
		});
	}

	if (!hasPurchases) {
		recommendations.push({
			priority: "LOW",
			title: "Capture Supplier Purchases",
			detail:
				"No purchases recorded for this date. Add invoices if stock was received.",
		});
	}

	if (!hasAdjustments) {
		recommendations.push({
			priority: "LOW",
			title: "Capture Stock Adjustments",
			detail:
				"Record breakage, freebies, or corrections to keep stock movement accurate.",
		});
	}

	const stockPositionByProduct = await computeStockPositionAsOfDate(date);
	const last30StartDate = addDays(date, -29);
	const last30MovementRows = await computeMovementRowsForDateRange(
		last30StartDate,
		date,
	);
	const soldUnitsLast30ByProduct = new Map<string, number>();

	for (const row of last30MovementRows) {
		soldUnitsLast30ByProduct.set(
			row.productId,
			(soldUnitsLast30ByProduct.get(row.productId) ?? 0) + row.unitsSold,
		);
	}

	const soldUnitsTodayByProduct = new Map(
		byProduct.map((row) => [row.productId, row.unitsSold]),
	);

	const inventoryRows = products.map((product) => {
		const productId = String(product._id);
		return {
			productId,
			productName: product.name,
			currentUnits: stockPositionByProduct.get(productId) ?? 0,
			unitsSoldToday: soldUnitsTodayByProduct.get(productId) ?? 0,
			unitsSoldLast30Days: soldUnitsLast30ByProduct.get(productId) ?? 0,
		};
	});

	const topMovers = inventoryRows
		.filter((row) => row.unitsSoldToday > 0)
		.sort((a, b) => b.unitsSoldToday - a.unitsSoldToday)
		.slice(0, 5);

	const slowMovers = inventoryRows
		.filter(
			(row) => row.currentUnits > 0 && row.unitsSoldLast30Days > 0,
		)
		.sort((a, b) => a.unitsSoldLast30Days - b.unitsSoldLast30Days)
		.slice(0, 5);

	const deadStock = inventoryRows
		.filter(
			(row) => row.currentUnits > 0 && row.unitsSoldLast30Days === 0,
		)
		.sort((a, b) => b.currentUnits - a.currentUnits)
		.slice(0, 5);

	const stockRecommendations: DailyReport["stockRecommendations"] =
		products
			.map((product) => {
				const productId = String(product._id);
				const currentUnits = stockPositionByProduct.get(productId) ?? 0;
				const reorderLevelUnits = product.reorderLevelUnits ?? 0;
				const recentSoldUnits = soldUnitsLast30ByProduct.get(productId) ?? 0;
				const recentAvgDailySoldUnits = recentSoldUnits / 30;
				const targetCoverDays = 7;
				const velocityTargetUnits = Math.ceil(
					recentAvgDailySoldUnits * targetCoverDays,
				);
				const reorderGapUnits = reorderLevelUnits - currentUnits;
				const velocityGapUnits = velocityTargetUnits - currentUnits;
				const recommendedOrderUnits = Math.max(
					reorderGapUnits,
					velocityGapUnits,
					0,
				);

				if (reorderLevelUnits <= 0 && velocityTargetUnits <= 0) return null;
				if (recommendedOrderUnits <= 0) return null;

				let recommendationBasis:
					| "REORDER_LEVEL"
					| "SELL_THROUGH"
					| "BLENDED" = "REORDER_LEVEL";

				if (velocityGapUnits > 0 && reorderGapUnits <= 0) {
					recommendationBasis = "SELL_THROUGH";
				} else if (velocityGapUnits > 0 && reorderGapUnits > 0) {
					recommendationBasis = "BLENDED";
				}

				return {
					productId,
					productName: product.name,
					currentUnits,
					reorderLevelUnits,
					recommendedOrderUnits,
					recentAvgDailySoldUnits: Number(
						recentAvgDailySoldUnits.toFixed(2),
					),
					targetCoverDays,
					recommendationBasis,
					priority: (currentUnits <= 0 ? "HIGH" : "MEDIUM") as
						| "HIGH"
						| "MEDIUM",
				};
			})
			.filter(
				(entry): entry is NonNullable<typeof entry> => entry !== null,
			)
			.sort((a, b) => {
				if (a.priority !== b.priority) return a.priority === "HIGH" ? -1 : 1;
				return a.currentUnits - b.currentUnits;
			})
			.slice(0, 10);

	if (stockRecommendations.length > 0) {
		const criticalCount = stockRecommendations.filter(
			(item) => item.priority === "HIGH",
		).length;

		recommendations.push({
			priority: criticalCount > 0 ? "HIGH" : "MEDIUM",
			title: "Reorder Low-Stock Products",
			detail:
				criticalCount > 0
					? `${criticalCount} product(s) are out of stock. Prioritize restocking today.`
					: `${stockRecommendations.length} product(s) are below reorder level.`,
		});
	}

	const { outstandingTabBalanceCents, overdueTabBalanceCents } =
		await getOutstandingTabBalances(date);

	return {
		date,
		expectedRevenueCents,
		collectedSalesCents: 0,
		tabChargesCents: 0,
		outstandingTabBalanceCents,
		overdueTabBalanceCents,
		accountedSalesCents: expectedRevenueCents,
		expensesCents,
		revenueVarianceCents: 0,
		netProfitAfterExpensesCents,
		tabPaymentsByMethodCents,
		dayChecklist: {
			hasMorningCount,
			hasNextMorningCount,
			hasPurchases,
			hasTabActivity,
			hasAdjustments,
		},
		movementStatus: {
			hasOpeningCount: movement.hasOpeningCount,
			hasClosingCount: movement.hasClosingCount,
			nextDate: movement.nextDate,
			missingOpeningProductIds: movement.missingOpeningProductIds,
			missingClosingProductIds: movement.missingClosingProductIds,
		},
		warnings: movement.warnings,
		byProduct: byProduct.sort(
			(a, b) => b.expectedRevenueCents - a.expectedRevenueCents,
		),
		trends: {
			sales: {
				currentCents: expectedRevenueCents,
				previousCents: previousCalculatedSalesCents,
				changeCents: salesChangeCents,
				changePct: salesChangePct,
			},
			topProducts,
		},
		grossProfit: {
			estimatedCogsCents,
			grossProfitCents,
			grossMarginPct,
		},
		inventoryInsights: {
			topMovers,
			slowMovers,
			deadStock,
		},
		recommendations,
		stockRecommendations,
	};
}
