import { connectDB } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { BusinessDay } from "@/models/BusinessDay";
import { Purchase } from "@/models/Purchase";
import { Adjustment } from "@/models/Adjustment";
import { Product } from "@/models/Product";
import { TabTransaction } from "@/models/TabTransaction";
import { SaleTransaction } from "@/models/SaleTransaction";
import type { DailyReport, DailyReportProduct } from "@/lib/types";

export async function getOrCreateBusinessDay(
	date: string,
	userId: string,
) {
	await connectDB();
	const existing = await BusinessDay.findOne({
		date,
	}).lean();
	if (existing) return existing;

	const created = await BusinessDay.create({
		date,
		status: "OPEN",
		openedByUserId: userId,
		openedAt: new Date(),
	});

	return created.toObject();
}

async function getAccountedSalesForDate(
	date: string,
): Promise<number | null> {
	const day = await BusinessDay.findOne({ date }).lean();
	if (!day) return null;
	const directSales = await SaleTransaction.find({
		businessDayId: String(day._id),
	}).lean();
	const collectedSalesCents = directSales.reduce(
		(sum, sale) => sum + (sale.amountCents ?? 0),
		0,
	);

	const tabChargesCents =
		await TabTransaction.aggregate([
			{
				$match: {
					businessDayId: String(day._id),
					type: "CHARGE",
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: "$amountCents" },
				},
			},
		]).then((r) => r?.[0]?.total ?? 0);

	return collectedSalesCents + tabChargesCents;
}

export async function computeDailySummary(
	date: string,
	userId: string,
): Promise<DailyReport> {
	await connectDB();

	const day = await getOrCreateBusinessDay(
		date,
		userId,
	);

	// Purchases
	const purchases = await Purchase.find({
		purchaseDate: date,
	}).lean();
	const purchasedUnitsByProduct = new Map<
		string,
		number
	>();
	for (const p of purchases) {
		for (const it of p.items) {
			purchasedUnitsByProduct.set(
				it.productId,
				(purchasedUnitsByProduct.get(
					it.productId,
				) ?? 0) + (it.units ?? 0),
			);
		}
	}

	// Sales ledger (from transaction line items)
	const salesTransactions = await TabTransaction.find({
		businessDayId: String(day._id),
		type: "CHARGE",
	})
		.select({
			items: 1,
			amountCents: 1,
		})
		.lean();
	const directSales = await SaleTransaction.find({
		businessDayId: String(day._id),
	})
		.select({
			items: 1,
			amountCents: 1,
			paymentMethod: 1,
		})
		.lean();
	const soldUnitsByProduct = new Map<
		string,
		number
	>();
	const revenueByProduct = new Map<
		string,
		number
	>();
	for (const txn of salesTransactions) {
		for (const item of txn.items ?? []) {
			soldUnitsByProduct.set(
				item.productId,
				(soldUnitsByProduct.get(item.productId) ??
					0) + (item.units ?? 0),
			);
			revenueByProduct.set(
				item.productId,
				(revenueByProduct.get(item.productId) ??
					0) + (item.lineTotalCents ?? 0),
			);
		}
	}
	for (const sale of directSales) {
		for (const item of sale.items ?? []) {
			soldUnitsByProduct.set(
				item.productId,
				(soldUnitsByProduct.get(item.productId) ??
					0) + (item.units ?? 0),
			);
			revenueByProduct.set(
				item.productId,
				(revenueByProduct.get(item.productId) ??
					0) + (item.lineTotalCents ?? 0),
			);
		}
	}

	// Adjustments
	const adjustments = await Adjustment.find({
		businessDayId: String(day._id),
	}).lean();
	const adjUnitsByProduct = new Map<
		string,
		number
	>();
	for (const a of adjustments) {
		for (const it of a.items) {
			adjUnitsByProduct.set(
				it.productId,
				(adjUnitsByProduct.get(it.productId) ??
					0) + (it.unitsDelta ?? 0),
			);
		}
	}

	const productIds = new Set<string>();
	for (const id of purchasedUnitsByProduct.keys())
		productIds.add(id);
	for (const id of soldUnitsByProduct.keys())
		productIds.add(id);
	for (const id of adjUnitsByProduct.keys())
		productIds.add(id);
	const products = await Product.find({}).lean();
	const productById = new Map<
		string,
		{
			name: string;
			reorderLevelUnits: number;
			packSize: number;
		}
	>();
	for (const p of products)
		productById.set(String(p._id), {
			name: p.name,
			reorderLevelUnits:
				p.reorderLevelUnits ?? 0,
			packSize: p.packSize ?? 1,
		});

	const warnings: string[] = [];
	if (
		salesTransactions.length === 0 &&
		directSales.length === 0
	) {
		warnings.push(
			"No product-level sales entries for this date yet.",
		);
	}

	let expectedRevenueCents = 0;

	const byProduct: DailyReportProduct[] = [];
	for (const productId of Array.from(
		productIds,
	)) {
		const purchasedUnits =
			purchasedUnitsByProduct.get(productId) ?? 0;
		const unitsSold =
			soldUnitsByProduct.get(productId) ?? 0;
		const adjustments =
			adjUnitsByProduct.get(productId) ?? 0;
		const productExpected =
			revenueByProduct.get(productId) ?? 0;
		const unitPriceCents =
			unitsSold > 0
				? Math.round(productExpected / unitsSold)
				: 0;

		expectedRevenueCents += productExpected;

		byProduct.push({
			productId,
			productName:
				productById.get(productId)?.name ??
				"(unknown product)",
			unitsSold,
			unitPriceCents,
			expectedRevenueCents: productExpected,
			purchasedUnits,
			adjustments,
		});
	}

	const directSalesByMethodCents = {
		CASH: 0,
		CARD: 0,
		EFT: 0,
	};
	for (const sale of directSales) {
		const paymentMethod =
			sale.paymentMethod ?? "CASH";
		directSalesByMethodCents[paymentMethod] +=
			sale.amountCents ?? 0;
	}
	const collectedSalesCents =
		directSalesByMethodCents.CASH +
		directSalesByMethodCents.CARD +
		directSalesByMethodCents.EFT;

	// Tab ledger - charges and payments (today)
	const tabChargesCents =
		salesTransactions.reduce(
			(sum, txn) => sum + (txn.amountCents ?? 0),
			0,
		);

	const payments = await TabTransaction.find({
		businessDayId: String(day._id),
		type: "PAYMENT",
	}).lean();
	const tabPaymentsByMethodCents = {
		CASH: 0,
		CARD: 0,
		EFT: 0,
	};
	for (const p of payments) {
		const m = p.paymentMethod ?? "CASH";
		tabPaymentsByMethodCents[m] += p.amountCents;
	}

	const accountedSalesCents =
		collectedSalesCents + tabChargesCents;
	const revenueVarianceCents =
		accountedSalesCents - expectedRevenueCents;

	const hasSalesEntries =
		salesTransactions.length > 0 ||
		directSales.length > 0;
	const hasPurchases = purchases.length > 0;
	const hasTabActivity =
		tabChargesCents > 0 || payments.length > 0;
	const hasAdjustments = adjustments.length > 0;

	const previousDate = addDays(date, -1);
	const previousAccountedSalesCents =
		await getAccountedSalesForDate(previousDate);
	const salesChangeCents =
		previousAccountedSalesCents === null
			? null
			: accountedSalesCents - previousAccountedSalesCents;
	const salesChangePct =
		previousAccountedSalesCents === null ||
		previousAccountedSalesCents === 0 ||
		salesChangeCents === null
			? null
			: (salesChangeCents /
					previousAccountedSalesCents) *
				100;

	const topProducts = [...byProduct]
		.sort((a, b) => b.unitsSold - a.unitsSold)
		.slice(0, 3)
		.map((item) => ({
			productId: item.productId,
			productName: item.productName,
			unitsSold: item.unitsSold,
			revenueCents: item.expectedRevenueCents,
		}));

	const recommendations: DailyReport["recommendations"] =
		[];
	if (!hasSalesEntries) {
		recommendations.push({
			priority: "HIGH",
			title: "Record Product Sales",
			detail:
				"Add sales entries with products and units sold so stock movement can be tracked.",
		});
	}
	if (Math.abs(revenueVarianceCents) > 10000) {
		recommendations.push({
			priority: "MEDIUM",
			title: "Review Sales Variance",
			detail:
				"Sales variance is above R100. Check sales entries, pricing, and payment totals.",
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

	const daysUpToDate = await BusinessDay.find({
		date: { $lte: date },
	})
		.select({ _id: 1 })
		.lean();
	const dayIdsUpToDate = daysUpToDate.map((dayDoc) =>
		String(dayDoc._id),
	);

	const purchasedUnitsToDateByProduct = new Map<
		string,
		number
	>();
	const purchaseCostTotalsByProduct = new Map<
		string,
		{ costCents: number; units: number }
	>();
	const purchasesToDate = await Purchase.find({
		purchaseDate: { $lte: date },
	})
		.select({ items: 1 })
		.lean();
	for (const purchase of purchasesToDate) {
		for (const item of purchase.items ?? []) {
			purchasedUnitsToDateByProduct.set(
				item.productId,
				(purchasedUnitsToDateByProduct.get(
					item.productId,
				) ?? 0) + (item.units ?? 0),
			);
			if (
				typeof item.unitCostCents === "number" &&
				item.unitCostCents >= 0 &&
				(item.units ?? 0) > 0
			) {
				const existing =
					purchaseCostTotalsByProduct.get(
						item.productId,
					) ?? {
						costCents: 0,
						units: 0,
					};
				purchaseCostTotalsByProduct.set(
					item.productId,
					{
						costCents:
							existing.costCents +
							item.unitCostCents *
								(item.units ?? 0),
						units:
							existing.units +
							(item.units ?? 0),
					},
				);
			}
		}
	}

	const adjustedUnitsToDateByProduct = new Map<
		string,
		number
	>();
	if (dayIdsUpToDate.length > 0) {
		const adjustmentsToDate = await Adjustment.find({
			businessDayId: { $in: dayIdsUpToDate },
		})
			.select({ items: 1 })
			.lean();
		for (const adjustmentDoc of adjustmentsToDate) {
			for (const item of adjustmentDoc.items ?? []) {
				adjustedUnitsToDateByProduct.set(
					item.productId,
					(adjustedUnitsToDateByProduct.get(
						item.productId,
					) ?? 0) + (item.unitsDelta ?? 0),
				);
			}
		}
	}

	const soldUnitsToDateByProduct = new Map<
		string,
		number
	>();
	if (dayIdsUpToDate.length > 0) {
		const [tabSalesToDate, directSalesToDate] =
			await Promise.all([
				TabTransaction.find({
					businessDayId: { $in: dayIdsUpToDate },
					type: "CHARGE",
				})
					.select({ items: 1 })
					.lean(),
				SaleTransaction.find({
					businessDayId: { $in: dayIdsUpToDate },
				})
					.select({ items: 1 })
					.lean(),
			]);
		for (const txn of tabSalesToDate) {
			for (const item of txn.items ?? []) {
				soldUnitsToDateByProduct.set(
					item.productId,
					(soldUnitsToDateByProduct.get(
						item.productId,
					) ?? 0) + (item.units ?? 0),
				);
			}
		}
		for (const txn of directSalesToDate) {
			for (const item of txn.items ?? []) {
				soldUnitsToDateByProduct.set(
					item.productId,
					(soldUnitsToDateByProduct.get(
						item.productId,
					) ?? 0) + (item.units ?? 0),
				);
			}
		}
	}

	const last30StartDate = addDays(date, -29);
	const dayDocsLast30 = await BusinessDay.find({
		date: { $gte: last30StartDate, $lte: date },
	})
		.select({ _id: 1 })
		.lean();
	const dayIdsLast30 = dayDocsLast30.map((doc) =>
		String(doc._id),
	);
	const soldUnitsLast30ByProduct = new Map<
		string,
		number
	>();
	if (dayIdsLast30.length > 0) {
		const [tabSalesLast30, directSalesLast30] =
			await Promise.all([
				TabTransaction.find({
					businessDayId: { $in: dayIdsLast30 },
					type: "CHARGE",
				})
					.select({ items: 1 })
					.lean(),
				SaleTransaction.find({
					businessDayId: { $in: dayIdsLast30 },
				})
					.select({ items: 1 })
					.lean(),
			]);
		for (const txn of tabSalesLast30) {
			for (const item of txn.items ?? []) {
				soldUnitsLast30ByProduct.set(
					item.productId,
					(soldUnitsLast30ByProduct.get(
						item.productId,
					) ?? 0) + (item.units ?? 0),
				);
			}
		}
		for (const txn of directSalesLast30) {
			for (const item of txn.items ?? []) {
				soldUnitsLast30ByProduct.set(
					item.productId,
					(soldUnitsLast30ByProduct.get(
						item.productId,
					) ?? 0) + (item.units ?? 0),
				);
			}
		}
	}

	let estimatedCogsCents = 0;
	for (const item of byProduct) {
		const summary =
			purchaseCostTotalsByProduct.get(
				item.productId,
			);
		if (!summary || summary.units <= 0) continue;
		const avgUnitCost =
			summary.costCents / summary.units;
		estimatedCogsCents += Math.round(
			(item.unitsSold ?? 0) * avgUnitCost,
		);
	}
	const grossProfitCents =
		expectedRevenueCents - estimatedCogsCents;
	const grossMarginPct =
		expectedRevenueCents > 0
			? (grossProfitCents / expectedRevenueCents) *
				100
			: null;

	const inventoryRows = Array.from(
		productById.entries(),
	).map(([productId, meta]) => {
		const currentUnits =
			(purchasedUnitsToDateByProduct.get(productId) ??
				0) +
			(adjustedUnitsToDateByProduct.get(productId) ??
				0) -
			(soldUnitsToDateByProduct.get(productId) ??
				0);
		return {
			productId,
			productName: meta.name,
			currentUnits,
			unitsSoldToday:
				soldUnitsByProduct.get(productId) ?? 0,
			unitsSoldLast30Days:
				soldUnitsLast30ByProduct.get(productId) ?? 0,
		};
	});
	const topMovers = inventoryRows
		.filter((row) => row.unitsSoldToday > 0)
		.sort(
			(a, b) => b.unitsSoldToday - a.unitsSoldToday,
		)
		.slice(0, 5);
	const slowMovers = inventoryRows
		.filter(
			(row) =>
				row.currentUnits > 0 &&
				row.unitsSoldLast30Days > 0,
		)
		.sort(
			(a, b) =>
				a.unitsSoldLast30Days -
				b.unitsSoldLast30Days,
		)
		.slice(0, 5);
	const deadStock = inventoryRows
		.filter(
			(row) =>
				row.currentUnits > 0 &&
				row.unitsSoldLast30Days === 0,
		)
		.sort((a, b) => b.currentUnits - a.currentUnits)
		.slice(0, 5);

	const stockRecommendations: DailyReport["stockRecommendations"] =
		Array.from(productById.entries())
			.map(([productId, productMeta]) => {
				const purchasedUnits =
					purchasedUnitsToDateByProduct.get(productId) ?? 0;
				const soldUnits =
					soldUnitsToDateByProduct.get(productId) ?? 0;
				const adjustedUnits =
					adjustedUnitsToDateByProduct.get(productId) ?? 0;
				const currentUnits =
					purchasedUnits + adjustedUnits - soldUnits;
				const reorderLevelUnits =
					productMeta?.reorderLevelUnits ?? 0;
				const recommendedOrderUnits = Math.max(
					reorderLevelUnits - currentUnits,
					0,
				);

				if (
					reorderLevelUnits <= 0 ||
					currentUnits > reorderLevelUnits ||
					recommendedOrderUnits <= 0
				) {
					return null;
				}

				return {
					productId,
					productName: productMeta.name,
					currentUnits,
					reorderLevelUnits,
					recommendedOrderUnits,
					priority: (currentUnits <= 0 ? "HIGH" : "MEDIUM") as "HIGH" | "MEDIUM",
				};
			})
			.filter(
				(
					entry,
				): entry is NonNullable<
					typeof entry
				> => entry !== null,
			)
			.sort((a, b) => {
				if (a.priority !== b.priority) {
					return a.priority === "HIGH"
						? -1
						: 1;
				}
				return (
					a.currentUnits - b.currentUnits
				);
			})
			.slice(0, 10);

	if (stockRecommendations.length > 0) {
		const criticalCount =
			stockRecommendations.filter(
				(item) => item.priority === "HIGH",
			).length;
		recommendations.push({
			priority:
				criticalCount > 0 ? "HIGH" : "MEDIUM",
			title: "Reorder Low-Stock Products",
			detail:
				criticalCount > 0
					? `${criticalCount} product(s) are out of stock. Prioritize restocking today.`
					: `${stockRecommendations.length} product(s) are below reorder level.`,
		});
	}

	return {
		date,
		expectedRevenueCents,
		collectedSalesCents,
		tabChargesCents,
		accountedSalesCents,
		revenueVarianceCents,
		tabPaymentsByMethodCents,
		dayChecklist: {
			hasSalesEntries,
			hasPurchases,
			hasTabActivity,
			hasAdjustments,
		},
		warnings,
		byProduct: byProduct.sort(
			(a, b) =>
				b.expectedRevenueCents -
				a.expectedRevenueCents,
		),
		trends: {
			sales: {
				currentCents: accountedSalesCents,
				previousCents:
					previousAccountedSalesCents,
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
