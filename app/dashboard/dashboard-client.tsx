"use client";
/* eslint-disable max-len */

import * as React from "react";
import Link from "next/link";
import {
	useSearchParams,
} from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
	AlertCircle,
	CheckCircle2,
	CircleDashed,
	TrendingUp,
	TrendingDown,
	Minus,
	Lightbulb,
	ChevronDown,
	ChevronUp,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DateRangeControls } from "@/components/date-range-controls";
import {
	LoadingCards,
	LoadingTable,
} from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatZAR } from "@/lib/money";
import { useOfflineCachedSWR } from "@/lib/use-offline-cached-swr";
import { cn } from "@/lib/utils";
import type { DailyReport } from "@/lib/types";
import { useGlobalDateRangeQuery } from "@/lib/use-global-date-range-query";

const DASHBOARD_TABS = [
	"overview",
	"sales-by-product",
	"trends-recommendations",
] as const;
const STOCK_RECOMMENDATIONS_PREVIEW_LIMIT = 5;

type DashboardTab = (typeof DASHBOARD_TABS)[number];

const isDashboardTab = (
	value: string | null,
): value is DashboardTab =>
	Boolean(
		value &&
			DASHBOARD_TABS.includes(
				value as DashboardTab,
			),
	);

const fetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(
			json?.error?.message ??
				json?.error ??
				"Failed to fetch data",
		);
	}
	return json?.data ?? json;
};

interface DashboardTransactionEntry {
	id: string;
	date: string | null;
	customerName: string;
	type:
		| "CHARGE"
		| "PAYMENT"
		| "ADJUSTMENT"
		| "EXPENSE"
		| "DIRECT_SALE";
	amountCents: number;
	paymentMethod?: string;
	createdAt?: string;
	items?: {
		productId: string;
		units: number;
	}[];
}

interface TransactionDrilldownState {
	open: boolean;
	title: string;
	kind?:
		| "all-transactions"
		| "direct-sales"
		| "account-sales"
		| "account-payments"
		| "expenses";
	productId?: string;
}
interface ExceptionsSummary {
	counts: {
		outOfStock: number;
		negativeStock: number;
		noPrice: number;
		overdueTabs: number;
	};
}

export function DashboardClient() {
	const searchParams = useSearchParams();
	const {
		from,
		to,
		date,
		preset,
		onPresetChange,
		onFromChange,
		onToChange,
		onRangeChange,
		updateQuery,
	} = useGlobalDateRangeQuery();
	const activeTab = isDashboardTab(
		searchParams.get("tab"),
	)
		? searchParams.get("tab")!
		: "overview";

	const onTabChange = React.useCallback(
		(nextTab: string) => {
			if (!isDashboardTab(nextTab)) return;
			updateQuery({ tab: nextTab });
		},
		[updateQuery],
	);

	const {
		data: report,
		error: effectiveError,
		isLoading: effectiveLoading,
	} = useOfflineCachedSWR<DailyReport>({
		key: `/api/reports/daily?from=${from}&to=${to}`,
		cacheKey: `dashboard:daily-report:${from}:${to}`,
		fetcher,
		onError: (err) => toast.error(err.message),
	});
	const { data: exceptionsSummary } =
		useSWR<ExceptionsSummary>(
			"/api/exceptions/summary",
			fetcher,
		);

	const checklistItems = React.useMemo(() => {
		if (!report) return [];
		const checklist = report.dayChecklist ?? {
			hasSalesEntries: false,
			hasPurchases: false,
			hasTabActivity: false,
			hasAdjustments: false,
		};
		return [
			{
				label: "Sales entries captured",
				done: checklist.hasSalesEntries,
				detail:
					"Record products and units sold so stock can move automatically.",
			},
			{
				label: "Stock purchases entered",
				done: checklist.hasPurchases,
				detail:
					"Add supplier purchases so incoming stock is tracked.",
			},
			{
				label: "Stock adjustments entered",
				done: checklist.hasAdjustments,
				detail:
					"Capture breakage, freebies, and corrections.",
			},
			{
				label:
					"Customer account activity entered",
				done: checklist.hasTabActivity,
				detail:
					"Record account sales and payments.",
			},
		];
	}, [report]);

	const salesTrendLabel = React.useMemo(() => {
		if (!report?.trends?.sales) return "-";
		const changePct =
			report.trends.sales.changePct;
		if (changePct === null)
			return "No previous day";
		const sign = changePct > 0 ? "+" : "";
		return `${sign}${changePct.toFixed(1)}%`;
	}, [report]);
	const stockRecommendations = React.useMemo(
		() => report?.stockRecommendations ?? [],
		[report?.stockRecommendations],
	);
	const hasExtraStockRecommendations =
		stockRecommendations.length >
		STOCK_RECOMMENDATIONS_PREVIEW_LIMIT;
	const [
		showAllStockRecommendations,
		setShowAllStockRecommendations,
	] = React.useState(false);
	const [
		stockAlertsOpen,
		setStockAlertsOpen,
	] = React.useState(false);
	const visibleStockRecommendations =
		React.useMemo(
			() =>
				showAllStockRecommendations
					? stockRecommendations
					: stockRecommendations.slice(
							0,
							STOCK_RECOMMENDATIONS_PREVIEW_LIMIT,
						),
			[
				showAllStockRecommendations,
				stockRecommendations,
			],
		);
	React.useEffect(() => {
		if (!hasExtraStockRecommendations) {
			setShowAllStockRecommendations(false);
		}
	}, [hasExtraStockRecommendations, date]);
	React.useEffect(() => {
		setStockAlertsOpen(false);
	}, [date]);
	const [txDrilldown, setTxDrilldown] =
		React.useState<TransactionDrilldownState>({
			open: false,
			title: "Transactions",
			kind: "all-transactions",
		});

	const openTxDrilldown = React.useCallback(
		({
			title,
			kind,
			productId,
		}: {
			title: string;
			kind?: TransactionDrilldownState["kind"];
			productId?: string;
		}) => {
			setTxDrilldown({
				open: true,
				title,
				kind: kind ?? "all-transactions",
				productId,
			});
		},
		[],
	);

	const { data: transactions = [], isLoading: txLoading } =
		useSWR<DashboardTransactionEntry[]>(
			txDrilldown.open
				? txDrilldown.productId
					? `/api/transactions?from=${from}&to=${to}&limit=200`
					: `/api/transactions?from=${from}&to=${to}&limit=200&fields=quick`
				: null,
			fetcher,
		);

	const filteredTransactions = React.useMemo(
		() =>
			(transactions ?? []).filter((txn) => {
				const kind =
					txDrilldown.kind ??
					"all-transactions";
				const kindMatch =
					kind === "direct-sales"
						? txn.type === "DIRECT_SALE"
						: kind === "account-sales"
							? txn.type === "CHARGE"
							: kind ===
								  "account-payments"
								? txn.type === "PAYMENT"
								: kind === "expenses"
									? txn.type === "EXPENSE"
								: true;
				if (!kindMatch) return false;
				if (!txDrilldown.productId) return true;
				return (txn.items ?? []).some(
					(item) =>
						item.productId ===
						txDrilldown.productId,
				);
			}),
		[transactions, txDrilldown.kind, txDrilldown.productId],
	);

	return (
		<PageWrapper
			title="Daily Overview"
			description="See daily sales and stock movement."
			actions={
				<DateRangeControls
					from={from}
					to={to}
					preset={preset}
					onPresetChange={onPresetChange}
					onFromChange={onFromChange}
					onToChange={onToChange}
					onRangeChange={onRangeChange}
				/>
			}
		>
			{effectiveLoading ? (
				<>
					<LoadingCards className="mb-6" />
					<LoadingTable />
				</>
			) : effectiveError ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{effectiveError.message}
					</AlertDescription>
				</Alert>
			) : !report ? (
				<EmptyState
					title="No data for this date"
					description="No sales or stock activity has been recorded for this date yet."
				/>
			) : (
				<>
					<Card className="mb-4 border-amber-300/60 bg-amber-50/50 shadow-sm">
						<CardContent className="pt-4">
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-sm font-medium">
									Needs attention:
								</p>
								<Link
									href="/products?stockStatus=OUT"
									className="rounded border bg-background px-2 py-1 text-xs hover:bg-accent/50"
								>
									{exceptionsSummary
										?.counts
										.outOfStock ?? 0}{" "}
									out of stock
								</Link>
								<Link
									href="/tabs?customerFilter=overdue"
									className="rounded border bg-background px-2 py-1 text-xs hover:bg-accent/50"
								>
									{exceptionsSummary
										?.counts
										.overdueTabs ?? 0}{" "}
									overdue tabs
								</Link>
								<Link
									href="/products?priceFilter=missing"
									className="rounded border bg-background px-2 py-1 text-xs hover:bg-accent/50"
								>
									{exceptionsSummary
										?.counts.noPrice ?? 0}{" "}
									no-price products
								</Link>
								<Link
									href="/exceptions"
									className="rounded border bg-background px-2 py-1 text-xs hover:bg-accent/50"
								>
									View exceptions
								</Link>
							</div>
						</CardContent>
					</Card>
					<div className="mb-4">
						<StockAlertsPanel
							rows={stockRecommendations}
							visibleRows={visibleStockRecommendations}
							showAll={showAllStockRecommendations}
							open={stockAlertsOpen}
							hasExtraRows={
								hasExtraStockRecommendations
							}
							onToggleShowAll={() =>
								setShowAllStockRecommendations(
									(prev) => !prev,
								)
							}
							onToggleOpen={() =>
								setStockAlertsOpen(
									(prev) => !prev,
								)
							}
							onOpenTrendsTab={() =>
								onTabChange(
									"trends-recommendations",
								)
							}
						/>
					</div>
					<Tabs
						value={activeTab}
						onValueChange={onTabChange}
						className="space-y-6"
					>
					<TabsList className="flex w-full items-center gap-1 overflow-x-auto">
						<TabsTrigger
							value="overview"
							className="shrink-0 text-xs sm:text-sm"
						>
							Overview
						</TabsTrigger>
						<TabsTrigger
							value="sales-by-product"
							className="shrink-0 text-xs sm:text-sm"
						>
							<span className="sm:hidden">
								Sales
							</span>
							<span className="hidden sm:inline">
								Sales by Product
							</span>
						</TabsTrigger>
						<TabsTrigger
							value="trends-recommendations"
							className="shrink-0 text-xs sm:text-sm"
						>
							<span className="sm:hidden">
								Trends
							</span>
							<span className="hidden sm:inline">
								Trends & Recommendations
							</span>
						</TabsTrigger>
					</TabsList>

					<TabsContent
						value="overview"
						className="space-y-6"
					>
						{report.warnings &&
							report.warnings.length > 0 && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>
										Warnings
									</AlertTitle>
									<AlertDescription>
										<ul className="list-disc list-inside mt-1">
											{report.warnings.map(
												(warning, i) => (
													<li key={i}>
														{warning}
													</li>
												),
											)}
										</ul>
									</AlertDescription>
								</Alert>
							)}

						{checklistItems.length > 0 && (
							<Card className="shadow-md bg-muted/50">
								<CardHeader>
									<CardTitle>
										Daily checklist
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="grid gap-3 md:grid-cols-2">
										{checklistItems.map(
											(item) => (
												<div
													key={item.label}
													className="flex items-start gap-3"
												>
													{item.done ? (
														<CheckCircle2 className="h-5 w-5 text-emerald-500 mt-1" />
													) : (
														<CircleDashed className="h-5 w-5 text-muted-foreground mt-1" />
													)}
													<div>
														<p className="text-sm font-medium">
															{item.label}
														</p>
														<p className="text-xs text-muted-foreground">
															{item.detail}
														</p>
													</div>
												</div>
											),
										)}
									</div>
								</CardContent>
							</Card>
						)}

						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<SummaryCard
								title="Expected Sales"
								value={
									report.expectedRevenueCents
								}
								onClick={() =>
									openTxDrilldown({
										title: "Expected Sales",
										kind: "all-transactions",
									})
								}
							/>
							<SummaryCard
								title="Collected Sales"
								value={report.collectedSalesCents}
								onClick={() =>
									openTxDrilldown({
										title: "Collected Sales",
										kind: "direct-sales",
									})
								}
							/>
							<SummaryCard
								title="Account Sales"
								value={report.tabChargesCents}
								onClick={() =>
									openTxDrilldown({
										title: "Account Sales",
										kind: "account-sales",
									})
								}
							/>
							<SummaryCard
								title="Customers Owe"
								value={
									report.outstandingTabBalanceCents
								}
								href="/tabs"
							/>
							<SummaryCard
								title="Overdue Tab Balance"
								value={
									report.overdueTabBalanceCents
								}
								variant={
									report.overdueTabBalanceCents > 0
										? "negative"
										: "default"
								}
								href="/tabs?customerFilter=overdue"
							/>
							<SummaryCard
								title="Sales Accounted For"
								value={report.accountedSalesCents}
								onClick={() =>
									openTxDrilldown({
										title: "Sales Accounted For",
										kind: "all-transactions",
									})
								}
							/>
							<SummaryCard
								title="Sales Difference"
								value={
									report.revenueVarianceCents
								}
								variant={
									report.revenueVarianceCents < 0
										? "negative"
										: "default"
								}
								onClick={() =>
									openTxDrilldown({
										title: "Sales Difference",
										kind: "all-transactions",
									})
								}
							/>
							<SummaryCard
								title="Expenses"
								value={
									report.expensesCents ?? 0
								}
								onClick={() =>
									openTxDrilldown({
										title: "Expenses",
										kind: "expenses",
									})
								}
							/>
							<SummaryCard
								title="Est. Gross Profit"
								value={
									report.grossProfit
										.grossProfitCents
								}
								variant={
									report.grossProfit
										.grossProfitCents < 0
										? "negative"
										: "default"
								}
							/>
							<SummaryCard
								title="Net After Expenses"
								value={
									report.netProfitAfterExpensesCents ??
									(
										report.grossProfit
											.grossProfitCents -
										(report.expensesCents ?? 0)
									)
								}
								variant={
									(
										report.netProfitAfterExpensesCents ??
										(
											report.grossProfit
												.grossProfitCents -
											(report.expensesCents ?? 0)
										)
									) < 0
										? "negative"
										: "default"
								}
							/>
						</div>
						<Card className="shadow-md">
							<CardHeader>
								<CardTitle>
									Gross Profit Estimate
								</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
								<div className="rounded-lg border p-3">
									<p className="text-xs text-muted-foreground">
										Estimated COGS
									</p>
									<p className="text-lg font-semibold">
										{formatZAR(
											report.grossProfit
												.estimatedCogsCents,
										)}
									</p>
								</div>
								<div className="rounded-lg border p-3">
									<p className="text-xs text-muted-foreground">
										Gross Profit
									</p>
									<p className="text-lg font-semibold">
										{formatZAR(
											report.grossProfit
												.grossProfitCents,
										)}
									</p>
								</div>
								<div className="rounded-lg border p-3">
									<p className="text-xs text-muted-foreground">
										Expenses
									</p>
									<p className="text-lg font-semibold text-destructive">
										{formatZAR(
											-(report.expensesCents ?? 0),
										)}
									</p>
								</div>
								<div className="rounded-lg border p-3">
									<p className="text-xs text-muted-foreground">
										Net After Expenses
									</p>
									<p
										className={cn(
											"text-lg font-semibold",
											(
												report.netProfitAfterExpensesCents ??
												(
													report.grossProfit
														.grossProfitCents -
													(report.expensesCents ?? 0)
												)
											) < 0
												? "text-destructive"
												: undefined,
										)}
									>
										{formatZAR(
											report.netProfitAfterExpensesCents ??
											(
												report.grossProfit
													.grossProfitCents -
												(report.expensesCents ?? 0)
											),
										)}
									</p>
								</div>
								<div className="rounded-lg border p-3">
									<p className="text-xs text-muted-foreground">
										Gross Margin
									</p>
									<p className="text-lg font-semibold">
										{report.grossProfit
											.grossMarginPct === null
											? "-"
											: `${report.grossProfit.grossMarginPct.toFixed(1)}%`}
									</p>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="sales-by-product">
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>
									Sales by Product
								</CardTitle>
							</CardHeader>
							<CardContent>
								{report.byProduct.length === 0 ? (
									<EmptyState
										title="No product sales yet"
										description="No product movement has been recorded for this date."
									/>
								) : (
									<>
								<div className="space-y-3 md:hidden">
									{report.byProduct.map(
										(item) => {
											const netMovement =
												item.purchasedUnits +
												item.adjustments -
												item.unitsSold;
											return (
												<div
													key={item.productId}
													className="rounded-lg border p-3"
												>
													<div className="flex items-start justify-between gap-2">
														<div>
														<p className="font-medium">
															<button
																type="button"
																className="underline-offset-2 hover:underline"
																onClick={() =>
																	openTxDrilldown(
																		{
																			title: `${item.productName} Transactions`,
																			productId:
																				item.productId,
																			kind: "all-transactions",
																		},
																	)
																}
															>
																{item.productName}
															</button>
														</p>
															<p className="text-xs text-muted-foreground">
																{item.unitsSold}{" "}
																units sold
															</p>
														</div>
														<p className="font-semibold">
															{formatZAR(
																item.expectedRevenueCents,
															)}
														</p>
													</div>
													<div className="mt-3 grid grid-cols-4 gap-2 text-xs">
														<div>
															<p className="text-muted-foreground">
																Purchased
															</p>
															<p>
																{
																	item.purchasedUnits
																}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground">
																Sold
															</p>
															<p>
																{
																	item.unitsSold
																}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground">
																Adj
															</p>
															<p
																className={cn(
																	item.adjustments <
																		0 &&
																		"text-destructive",
																)}
															>
																{item.adjustments >
																0
																	? `+${item.adjustments}`
																	: item.adjustments}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground">
																Net
															</p>
															<p
																className={cn(
																	netMovement < 0 &&
																		"text-destructive",
																)}
															>
																{netMovement > 0
																	? `+${netMovement}`
																	: netMovement}
															</p>
														</div>
													</div>
													<p className="mt-2 text-xs text-muted-foreground">
														Net = Purchased + Adjustments - Sold
													</p>
												</div>
											);
										},
									)}
								</div>

								<div className="hidden md:block">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>
													Product
												</TableHead>
												<TableHead className="text-right">
													Units Sold
												</TableHead>
												<TableHead className="text-right">
													Avg Sell Price
												</TableHead>
												<TableHead className="text-right">
													Sales Value
												</TableHead>
												<TableHead className="text-right">
													Purchased
												</TableHead>
												<TableHead className="text-right">
													Sold
												</TableHead>
												<TableHead className="text-right">
													Adjustments
												</TableHead>
												<TableHead className="text-right">
													Net Movement
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{report.byProduct.map(
												(item) => {
													const netMovement =
														item.purchasedUnits +
														item.adjustments -
														item.unitsSold;
													return (
														<TableRow
															key={item.productId}
														>
															<TableCell className="font-medium">
																<button
																	type="button"
																	className="underline-offset-2 hover:underline"
																	onClick={() =>
																		openTxDrilldown(
																			{
																				title: `${item.productName} Transactions`,
																				productId:
																					item.productId,
																				kind: "all-transactions",
																			},
																		)
																	}
																>
																	{item.productName}
																</button>
															</TableCell>
															<TableCell className="text-right">
																{item.unitsSold}
															</TableCell>
															<TableCell className="text-right">
																{formatZAR(
																	item.unitPriceCents,
																)}
															</TableCell>
															<TableCell className="text-right">
																{formatZAR(
																	item.expectedRevenueCents,
																)}
															</TableCell>
															<TableCell className="text-right">
																{
																	item.purchasedUnits
																}
															</TableCell>
															<TableCell className="text-right">
																{
																	item.unitsSold
																}
															</TableCell>
															<TableCell
																className={cn(
																	"text-right",
																	item.adjustments <
																		0 &&
																		"text-destructive",
																)}
															>
																{item.adjustments >
																0
																	? `+${item.adjustments}`
																	: item.adjustments}
															</TableCell>
															<TableCell className="text-right">
																<span
																	className={cn(
																		netMovement < 0 &&
																			"text-destructive",
																	)}
																>
																	{netMovement > 0
																		? `+${netMovement}`
																		: netMovement}
																</span>
															</TableCell>
														</TableRow>
													);
												},
											)}
										</TableBody>
									</Table>
								</div>
									</>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="trends-recommendations"
						className="space-y-4"
					>
						<div className="grid gap-4 lg:grid-cols-2">
							<Card className="shadow-md">
								<CardHeader>
									<CardTitle>Trends</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center justify-between rounded-lg border p-3">
										<div>
											<p className="text-sm text-muted-foreground">
												Sales vs Previous Day
											</p>
											<p className="font-semibold">
												{salesTrendLabel}
											</p>
										</div>
										{report.trends.sales
											.changePct === null ? (
											<Minus className="h-4 w-4 text-muted-foreground" />
										) : report.trends.sales
												.changePct >= 0 ? (
											<TrendingUp className="h-4 w-4 text-emerald-500" />
										) : (
											<TrendingDown className="h-4 w-4 text-destructive" />
										)}
									</div>

									<div className="rounded-lg border p-3">
										<p className="mb-2 text-sm text-muted-foreground">
											Top Products by Units Sold
										</p>
									{report.trends.topProducts
										.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No product trends yet for
											this date.
										</p>
									) : (
										<div className="space-y-2 text-sm">
											{report.trends.topProducts.map(
												(product) => (
													<div
														key={
															product.productId
														}
														className="flex items-center justify-between gap-2"
													>
														<p className="truncate">
															{
																product.productName
															}
														</p>
														<p className="text-muted-foreground">
															{product.unitsSold}{" "}
															units
														</p>
													</div>
												),
											)}
										</div>
									)}
								</div>
							</CardContent>
						</Card>

							<Card className="shadow-md">
								<CardHeader>
									<CardTitle>
										Recommendations
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{report.recommendations
										.length === 0 ? (
										<div className="flex items-start gap-2 rounded-lg border p-3">
											<Lightbulb className="mt-0.5 h-4 w-4 text-muted-foreground" />
											<p className="text-sm text-muted-foreground">
												No urgent recommendations
												for this date.
											</p>
										</div>
									) : (
										report.recommendations.map(
											(rec, idx) => (
												<div
													key={`${rec.title}-${idx}`}
													className="rounded-lg border p-3"
												>
													<div className="mb-1 flex flex-wrap items-center justify-between gap-2">
														<p className="text-sm font-semibold wrap-break-word">
															{rec.title}
														</p>
														<span
															className={cn(
																"rounded px-2 py-0.5 text-xs font-medium",
																rec.priority ===
																	"HIGH" &&
																	"bg-destructive/10 text-destructive",
																rec.priority ===
																	"MEDIUM" &&
																	"bg-amber-500/10 text-amber-700",
																rec.priority ===
																	"LOW" &&
																	"bg-muted text-muted-foreground",
															)}
														>
															{rec.priority}
														</span>
													</div>
													<p className="text-sm text-muted-foreground">
														{rec.detail}
													</p>
												</div>
											),
										)
									)}
								</CardContent>
							</Card>
						</div>

							<Card className="shadow-md">
								<CardHeader>
									<CardTitle>
										Daily Suggested Purchase List
									</CardTitle>
								</CardHeader>
								<CardContent>
									{stockRecommendations.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No purchase suggestions for this
											date.
										</p>
									) : (
									<div className="space-y-3">
										{visibleStockRecommendations.map(
											(item) => (
												<div
													key={item.productId}
													className="rounded-lg border p-3"
												>
													<div className="flex flex-wrap items-start justify-between gap-2">
														<div className="min-w-0">
															<p className="font-medium">
																{item.productName}
															</p>
														<div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
															<p>
																Current:{" "}
																	{
																		item.currentUnits
																	}
																</p>
															<p>
																Reorder:{" "}
																	{
																		item.reorderLevelUnits
																	}
															</p>
															<p>
																Sell-through:{" "}
																{item.recentAvgDailySoldUnits?.toFixed(
																	2,
																) ?? "0.00"}
																/day
															</p>
															<p>
																Basis:{" "}
																{item.recommendationBasis ??
																	"REORDER_LEVEL"}
															</p>
														</div>
													</div>
														<span
															className={cn(
																"rounded px-2 py-0.5 text-xs font-medium",
																item.priority ===
																	"HIGH"
																	? "bg-destructive/10 text-destructive"
																	: "bg-amber-500/10 text-amber-700",
															)}
														>
															{item.priority}
														</span>
													</div>
													<p className="mt-2 text-sm">
														Recommended order:{" "}
														<span className="font-semibold">
															{
																item.recommendedOrderUnits
															}{" "}
															units
														</span>
													</p>
												</div>
											),
										)}
										{hasExtraStockRecommendations && (
											<button
												type="button"
												className="text-xs font-medium text-primary underline-offset-2 hover:underline"
												onClick={() =>
													setShowAllStockRecommendations(
														(prev) => !prev,
													)
												}
											>
												{showAllStockRecommendations
													? "Show fewer recommendations"
													: `Show all ${stockRecommendations.length} recommendations`}
											</button>
										)}
									</div>
								)}
							</CardContent>
						</Card>

						<div className="grid gap-4 lg:grid-cols-3">
							<InventoryListCard
								title="Top Movers Today"
								emptyLabel="No movers yet for this date."
								rows={
									report.inventoryInsights
										.topMovers
								}
								rightLabel={(row) =>
									`${row.unitsSoldToday} sold`
								}
							/>
							<InventoryListCard
								title="Slow Movers (30 Days)"
								emptyLabel="No slow movers in current stock."
								rows={
									report.inventoryInsights
										.slowMovers
								}
								rightLabel={(row) =>
									`${row.unitsSoldLast30Days} sold`
								}
							/>
							<InventoryListCard
								title="Dead Stock (30 Days)"
								emptyLabel="No dead stock detected."
								rows={
									report.inventoryInsights
										.deadStock
								}
								rightLabel={(row) =>
									`${row.currentUnits} on hand`
								}
							/>
						</div>
					</TabsContent>
					</Tabs>
				</>
			)}
			<Dialog
				open={txDrilldown.open}
				onOpenChange={(open) =>
					setTxDrilldown((prev) => ({
						...prev,
						open,
					}))
				}
			>
				<DialogContent className="h-[70vh] w-[90vw] max-w-[90vw] overflow-hidden p-0 md:max-w-3xl">
					<DialogHeader className="h-16 shrink-0 space-y-0.5 border-b px-4 py-1.5">
						<DialogTitle>
							{txDrilldown.title}
						</DialogTitle>
						<DialogDescription className="text-xs leading-tight">
							{from} to {to} transaction details shown in dashboard.
						</DialogDescription>
					</DialogHeader>
					<div className="flex h-[60vh] min-h-0 flex-col overflow-hidden p-4">
						<div className="min-h-0 flex-1 overflow-y-auto">
						{txLoading ? (
							<LoadingTable />
						) : filteredTransactions.length === 0 ? (
							<EmptyState
								title="No transactions found"
								description="No matching transactions for this selection."
							/>
						) : (
							<>
								<div className="space-y-3 md:hidden">
									{filteredTransactions.map(
										(txn) => (
											<div
												key={txn.id}
												className="rounded-lg border p-3"
											>
												<div className="flex items-start justify-between gap-2">
													<div>
														<p className="text-sm font-medium">
															{txn.customerName}
														</p>
														<p className="text-xs text-muted-foreground">
															{txn.type}
															{txn.paymentMethod
																? ` | ${txn.paymentMethod}`
																: ""}
														</p>
													</div>
													<p className="font-semibold">
														{formatZAR(
															txn.amountCents,
														)}
													</p>
												</div>
											</div>
										),
									)}
								</div>
								<div className="hidden md:block">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>
													Customer
												</TableHead>
												<TableHead>
													Type
												</TableHead>
												<TableHead>
													Method
												</TableHead>
												<TableHead className="text-right">
													Amount
												</TableHead>
												<TableHead className="text-right">
													Time
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredTransactions.map(
												(txn) => (
													<TableRow
														key={txn.id}
													>
														<TableCell className="font-medium">
															{txn.customerName}
														</TableCell>
														<TableCell>
															{txn.type}
														</TableCell>
														<TableCell>
															{txn.paymentMethod ??
																"-"}
														</TableCell>
														<TableCell className="text-right">
															{formatZAR(
																txn.amountCents,
															)}
														</TableCell>
														<TableCell className="text-right text-xs text-muted-foreground">
															{txn.createdAt
																? new Date(
																		txn.createdAt,
																  ).toLocaleTimeString()
																: "-"}
														</TableCell>
													</TableRow>
												),
											)}
										</TableBody>
									</Table>
								</div>
							</>
						)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</PageWrapper>
	);
}

function StockAlertsPanel({
	rows,
	visibleRows,
	showAll,
	open,
	hasExtraRows,
	onToggleOpen,
	onToggleShowAll,
	onOpenTrendsTab,
}: {
	rows: DailyReport["stockRecommendations"];
	visibleRows: DailyReport["stockRecommendations"];
	showAll: boolean;
	open: boolean;
	hasExtraRows: boolean;
	onToggleOpen: () => void;
	onToggleShowAll: () => void;
	onOpenTrendsTab: () => void;
}) {
	if (rows.length === 0) return null;
	const outOfStock = rows.filter(
		(item) =>
			item.priority === "HIGH" ||
			item.currentUnits <= 0,
	);
	const lowStock = rows.filter(
		(item) =>
			item.priority !== "HIGH" &&
			item.currentUnits > 0,
	);

	return (
		<Card className="border-destructive/30 bg-destructive/5 shadow-md">
			<CardHeader className="pb-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<AlertCircle className="h-4 w-4 text-destructive" />
							Stock Alerts
						</CardTitle>
						<span className="rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
							{outOfStock.length} out of stock
						</span>
						<span className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">
							{lowStock.length} low stock
						</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onToggleOpen}
							className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs font-medium"
						>
							{open ? (
								<>
									<ChevronUp className="h-3.5 w-3.5" />
									Collapse
								</>
							) : (
								<>
									<ChevronDown className="h-3.5 w-3.5" />
									Expand
								</>
							)}
						</button>
					</div>
				</div>
			</CardHeader>
			{open && (
				<CardContent className="space-y-3">
					<div className="space-y-2">
						{visibleRows.map((item) => (
							<div
								key={item.productId}
								className="flex items-center justify-between gap-3 rounded-lg border bg-background p-2"
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">
										{item.productName}
									</p>
									<p className="text-xs text-muted-foreground">
										Current: {item.currentUnits} | Reorder:{" "}
										{item.reorderLevelUnits}
									</p>
								</div>
								<span
									className={cn(
										"rounded px-2 py-0.5 text-xs font-medium",
										item.priority === "HIGH"
											? "bg-destructive/10 text-destructive"
											: "bg-amber-500/10 text-amber-700",
									)}
								>
									{item.priority}
								</span>
							</div>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={onOpenTrendsTab}
							className="text-xs font-medium text-primary underline-offset-2 hover:underline"
						>
							Open Trends & Recommendations
						</button>
						{hasExtraRows && (
							<button
								type="button"
								onClick={onToggleShowAll}
								className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs font-medium"
							>
								{showAll ? (
									<>
										<ChevronUp className="h-3.5 w-3.5" />
										Show less
									</>
								) : (
									<>
										<ChevronDown className="h-3.5 w-3.5" />
										Show all
									</>
								)}
							</button>
						)}
					</div>
				</CardContent>
			)}
		</Card>
	);
}

interface SummaryCardProps {
	title: string;
	value: number;
	variant?: "default" | "negative";
	onClick?: () => void;
	href?: string;
}

function SummaryCard({
	title,
	value,
	variant = "default",
	onClick,
	href,
}: SummaryCardProps) {
	const card = (
		<Card className="shadow-md">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p
					className={cn(
						"text-2xl font-bold",
						variant === "negative" &&
							"text-destructive",
					)}
				>
					{formatZAR(value)}
				</p>
			</CardContent>
		</Card>
	);
	if (href) {
		return (
			<Link
				href={href}
				className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{card}
			</Link>
		);
	}
	if (!onClick) return card;
	return (
		<button
			type="button"
			onClick={onClick}
			className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{card}
		</button>
	);
}

function InventoryListCard({
	title,
	rows,
	emptyLabel,
	rightLabel,
}: {
	title: string;
	rows: {
		productId: string;
		productName: string;
		currentUnits: number;
		unitsSoldToday?: number;
		unitsSoldLast30Days?: number;
	}[];
	emptyLabel: string;
	rightLabel: (row: {
		productId: string;
		productName: string;
		currentUnits: number;
		unitsSoldToday?: number;
		unitsSoldLast30Days?: number;
	}) => string;
}) {
	return (
		<Card className="shadow-md">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{emptyLabel}
					</p>
				) : (
					<div className="space-y-2">
						{rows.map((row) => (
							<div
								key={row.productId}
								className="flex items-center justify-between gap-2 rounded-lg border p-2"
							>
								<p className="truncate text-sm font-medium">
									{row.productName}
								</p>
								<p className="text-xs text-muted-foreground">
									{rightLabel(row)}
								</p>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
