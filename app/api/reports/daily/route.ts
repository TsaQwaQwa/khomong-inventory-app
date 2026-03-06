export const runtime = "nodejs";

import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { addDays, todayYMD } from "@/lib/dates";
import { computeDailySummary } from "@/lib/reporting";
import { connectDB } from "@/lib/db";
import { syncStockAlertsForDay } from "@/lib/alerts";

type DailySummary = Awaited<
	ReturnType<typeof computeDailySummary>
>;

const dailySummaryCache = new Map<
	string,
	{ summary: DailySummary; expiresAt: number }
>();
const dailySummaryInflight = new Map<
	string,
	Promise<DailySummary>
>();

const getDailySummaryCacheKey = (
	scopeId: string,
	date: string,
) => `${scopeId}:${date}`;

const getDailySummaryTtlMs = (date: string) =>
	date === todayYMD() ? 15_000 : 300_000;
const isYmd = (value: string | null) =>
	Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const pruneDailySummaryCache = () => {
	if (dailySummaryCache.size <= 500) return;
	const now = Date.now();
	for (const [key, value] of dailySummaryCache) {
		if (value.expiresAt <= now) {
			dailySummaryCache.delete(key);
		}
	}
	while (dailySummaryCache.size > 500) {
		const oldestKey =
			dailySummaryCache.keys().next().value;
		if (!oldestKey) break;
		dailySummaryCache.delete(oldestKey);
	}
};

async function getDailySummaryCached({
	scopeId,
	date,
	userId,
	forceFresh,
}: {
	scopeId: string;
	date: string;
	userId: string;
	forceFresh: boolean;
}) {
	const key = getDailySummaryCacheKey(scopeId, date);
	if (forceFresh) {
		dailySummaryCache.delete(key);
	}
	const now = Date.now();
	const cached = dailySummaryCache.get(key);
	if (cached && cached.expiresAt > now) {
		return {
			summary: cached.summary,
			cacheHit: true,
		};
	}

	const inflight = dailySummaryInflight.get(key);
	if (inflight) {
		return {
			summary: await inflight,
			cacheHit: true,
		};
	}

	const computePromise = computeDailySummary(
		date,
		userId,
	)
		.then((summary) => {
			dailySummaryCache.set(key, {
				summary,
				expiresAt:
					Date.now() + getDailySummaryTtlMs(date),
			});
			pruneDailySummaryCache();
			return summary;
		})
		.finally(() => {
			dailySummaryInflight.delete(key);
		});

	dailySummaryInflight.set(key, computePromise);
	return {
		summary: await computePromise,
		cacheHit: false,
	};
}

const aggregateSummaries = (
	from: string,
	to: string,
	summaries: DailySummary[],
): DailySummary => {
	const payments = {
		CASH: 0,
		CARD: 0,
		EFT: 0,
	};
	const checklist = {
		hasSalesEntries: false,
		hasPurchases: false,
		hasTabActivity: false,
		hasAdjustments: false,
	};
	const warningsSet = new Set<string>();
	const byProductMap = new Map<
		string,
		{
			productId: string;
			productName: string;
			unitsSold: number;
			expectedRevenueCents: number;
			purchasedUnits: number;
			adjustments: number;
		}
	>();
	const recommendationsMap = new Map<
		string,
		DailySummary["recommendations"][number]
	>();
	const stockRecMap = new Map<
		string,
		DailySummary["stockRecommendations"][number]
	>();
	const topMoverMap = new Map<
		string,
		DailySummary["inventoryInsights"]["topMovers"][number]
	>();
	const slowMoverMap = new Map<
		string,
		DailySummary["inventoryInsights"]["slowMovers"][number]
	>();
	const deadStockMap = new Map<
		string,
		DailySummary["inventoryInsights"]["deadStock"][number]
	>();

	let expectedRevenueCents = 0;
	let collectedSalesCents = 0;
	let tabChargesCents = 0;
	let outstandingTabBalanceCents = 0;
	let overdueTabBalanceCents = 0;
	let accountedSalesCents = 0;
	let expensesCents = 0;
	let revenueVarianceCents = 0;
	let estimatedCogsCents = 0;
	let grossProfitCents = 0;
	let netProfitAfterExpensesCents = 0;

	for (const summary of summaries) {
		expectedRevenueCents +=
			summary.expectedRevenueCents;
		collectedSalesCents += summary.collectedSalesCents;
		tabChargesCents += summary.tabChargesCents;
		outstandingTabBalanceCents =
			summary.outstandingTabBalanceCents;
		overdueTabBalanceCents =
			summary.overdueTabBalanceCents;
		accountedSalesCents += summary.accountedSalesCents;
		expensesCents += summary.expensesCents ?? 0;
		revenueVarianceCents += summary.revenueVarianceCents;
		payments.CASH += summary.tabPaymentsByMethodCents.CASH;
		payments.CARD += summary.tabPaymentsByMethodCents.CARD;
		payments.EFT += summary.tabPaymentsByMethodCents.EFT;
		checklist.hasSalesEntries =
			checklist.hasSalesEntries ||
			summary.dayChecklist.hasSalesEntries;
		checklist.hasPurchases =
			checklist.hasPurchases ||
			summary.dayChecklist.hasPurchases;
		checklist.hasTabActivity =
			checklist.hasTabActivity ||
			summary.dayChecklist.hasTabActivity;
		checklist.hasAdjustments =
			checklist.hasAdjustments ||
			summary.dayChecklist.hasAdjustments;
		for (const warning of summary.warnings ?? []) {
			warningsSet.add(warning);
		}
		for (const row of summary.byProduct ?? []) {
			const existing = byProductMap.get(row.productId);
			if (existing) {
				existing.unitsSold += row.unitsSold;
				existing.expectedRevenueCents +=
					row.expectedRevenueCents;
				existing.purchasedUnits += row.purchasedUnits;
				existing.adjustments += row.adjustments;
			} else {
				byProductMap.set(row.productId, {
					productId: row.productId,
					productName: row.productName,
					unitsSold: row.unitsSold,
					expectedRevenueCents:
						row.expectedRevenueCents,
					purchasedUnits: row.purchasedUnits,
					adjustments: row.adjustments,
				});
			}
		}
		for (const rec of summary.recommendations ?? []) {
			const key = `${rec.title}:${rec.detail}`;
			if (!recommendationsMap.has(key)) {
				recommendationsMap.set(key, rec);
			}
		}
		for (const rec of summary.stockRecommendations ?? []) {
			const existing = stockRecMap.get(rec.productId);
			if (existing) {
				existing.recommendedOrderUnits +=
					rec.recommendedOrderUnits;
				existing.currentUnits = rec.currentUnits;
				existing.reorderLevelUnits = Math.max(
					existing.reorderLevelUnits,
					rec.reorderLevelUnits,
				);
				if (rec.priority === "HIGH") {
					existing.priority = "HIGH";
				}
			} else {
				stockRecMap.set(rec.productId, {
					...rec,
				});
			}
		}
		for (const row of summary.inventoryInsights
			.topMovers ?? []) {
			const existing = topMoverMap.get(row.productId);
			if (existing) {
				existing.unitsSoldToday += row.unitsSoldToday;
				existing.currentUnits = row.currentUnits;
			} else {
				topMoverMap.set(row.productId, { ...row });
			}
		}
		for (const row of summary.inventoryInsights
			.slowMovers ?? []) {
			const existing = slowMoverMap.get(row.productId);
			if (existing) {
				existing.unitsSoldLast30Days +=
					row.unitsSoldLast30Days;
				existing.currentUnits = row.currentUnits;
			} else {
				slowMoverMap.set(row.productId, { ...row });
			}
		}
		for (const row of summary.inventoryInsights
			.deadStock ?? []) {
			const existing = deadStockMap.get(row.productId);
			if (existing) {
				existing.unitsSoldLast30Days +=
					row.unitsSoldLast30Days;
				existing.currentUnits = row.currentUnits;
			} else {
				deadStockMap.set(row.productId, { ...row });
			}
		}
		estimatedCogsCents +=
			summary.grossProfit.estimatedCogsCents;
		grossProfitCents +=
			summary.grossProfit.grossProfitCents;
		netProfitAfterExpensesCents +=
			summary.netProfitAfterExpensesCents ?? 0;
	}

	const byProduct = Array.from(byProductMap.values())
		.map((row) => ({
			...row,
			unitPriceCents:
				row.unitsSold > 0
					? Math.round(
							row.expectedRevenueCents / row.unitsSold,
					  )
					: 0,
		}))
		.sort(
			(a, b) =>
				b.expectedRevenueCents -
				a.expectedRevenueCents,
		);
	const topProducts = byProduct
		.slice()
		.sort((a, b) => b.unitsSold - a.unitsSold)
		.slice(0, 3)
		.map((row) => ({
			productId: row.productId,
			productName: row.productName,
			unitsSold: row.unitsSold,
			revenueCents: row.expectedRevenueCents,
		}));

	return {
		date: `${from}..${to}`,
		expectedRevenueCents,
		collectedSalesCents,
		tabChargesCents,
		outstandingTabBalanceCents,
		overdueTabBalanceCents,
		accountedSalesCents,
		expensesCents,
		revenueVarianceCents,
		netProfitAfterExpensesCents,
		tabPaymentsByMethodCents: payments,
		dayChecklist: checklist,
		warnings: Array.from(warningsSet),
		byProduct,
		trends: {
			sales: {
				currentCents: accountedSalesCents,
				previousCents: null,
				changeCents: null,
				changePct: null,
			},
			topProducts,
		},
		grossProfit: {
			estimatedCogsCents,
			grossProfitCents,
			grossMarginPct:
				accountedSalesCents > 0
					? (grossProfitCents /
							accountedSalesCents) *
					  100
					: null,
		},
		inventoryInsights: {
			topMovers: Array.from(topMoverMap.values())
				.sort(
					(a, b) =>
						b.unitsSoldToday - a.unitsSoldToday,
				)
				.slice(0, 5),
			slowMovers: Array.from(slowMoverMap.values())
				.sort(
					(a, b) =>
						a.unitsSoldLast30Days -
						b.unitsSoldLast30Days,
				)
				.slice(0, 5),
			deadStock: Array.from(deadStockMap.values())
				.sort(
					(a, b) =>
						a.unitsSoldLast30Days -
						b.unitsSoldLast30Days,
				)
				.slice(0, 5),
		},
		recommendations: Array.from(
			recommendationsMap.values(),
		),
		stockRecommendations: Array.from(
			stockRecMap.values(),
		).sort((a, b) => {
			if (a.priority !== b.priority) {
				return a.priority === "HIGH" ? -1 : 1;
			}
			return (
				b.recommendedOrderUnits -
				a.recommendedOrderUnits
			);
		}),
	};
};

export async function GET(req: Request) {
	let a;
	try {
		a = await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	const url = new URL(req.url);
	const fromParam = url.searchParams.get("from");
	const toParam = url.searchParams.get("to");
	const dateParam = url.searchParams.get("date");
	const date = dateParam ?? toParam ?? todayYMD();
	const from =
		isYmd(fromParam) && isYmd(toParam)
			? fromParam
			: null;
	const to =
		isYmd(fromParam) && isYmd(toParam)
			? toParam
			: null;
	const forceFresh =
		url.searchParams.get("fresh") === "1";

	try {
		await connectDB();
		const scopeId = a.orgId ?? a.userId!;
		if (from && to && from <= to) {
			const dates: string[] = [];
			let cursor = from;
			while (cursor <= to) {
				dates.push(cursor);
				cursor = addDays(cursor, 1);
			}
			const summaries = await Promise.all(
				dates.map((d) =>
					getDailySummaryCached({
						scopeId,
						date: d,
						userId: a.userId!,
						forceFresh,
					}).then((res) => res.summary),
				),
			);
			const summary = aggregateSummaries(
				from,
				to,
				summaries,
			);
			await syncStockAlertsForDay({
				scopeId,
				date: to,
				summary,
			});
			return ok(summary);
		}
		const { summary, cacheHit } =
			await getDailySummaryCached({
				scopeId,
				date,
				userId: a.userId!,
				forceFresh,
			});
		if (!cacheHit || forceFresh) {
			await syncStockAlertsForDay({
				scopeId,
				date,
				summary,
			});
		}
		return ok(summary);
	} catch (e: any) {
		console.error(
			"Daily report failure",
			{ date },
			e,
		);
		return fail(
			"Failed to compute daily summary",
			{ status: 500, code: "SERVER_ERROR" },
		);
	}
}
