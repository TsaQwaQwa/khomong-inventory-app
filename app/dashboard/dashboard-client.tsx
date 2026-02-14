"use client";
/* eslint-disable max-len */

import * as React from "react";
import {
	usePathname,
	useRouter,
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
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DatePickerYMD } from "@/components/date-picker-ymd";
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
import { getTodayJHB } from "@/lib/date-utils";
import { formatZAR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DailyReport } from "@/lib/types";

const DASHBOARD_TABS = [
	"overview",
	"sales-by-product",
	"trends-recommendations",
] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number];

const isValidDateParam = (
	value: string | null,
): value is string =>
	Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

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
		| "account-payments";
	productId?: string;
}

export function DashboardClient() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const date = isValidDateParam(
		searchParams.get("date"),
	)
		? searchParams.get("date")!
		: getTodayJHB();
	const activeTab = isDashboardTab(
		searchParams.get("tab"),
	)
		? searchParams.get("tab")!
		: "overview";

	const updateQueryParam = React.useCallback(
		(key: string, value: string) => {
			const params = new URLSearchParams(
				searchParams.toString(),
			);
			params.set(key, value);
			const query = params.toString();
			router.replace(
				query ? `${pathname}?${query}` : pathname,
				{ scroll: false },
			);
		},
		[pathname, router, searchParams],
	);

	const onDateChange = React.useCallback(
		(nextDate: string) => {
			updateQueryParam("date", nextDate);
		},
		[updateQueryParam],
	);

	const onTabChange = React.useCallback(
		(nextTab: string) => {
			if (!isDashboardTab(nextTab)) return;
			updateQueryParam("tab", nextTab);
		},
		[updateQueryParam],
	);

	const {
		data: report,
		error,
		isLoading,
	} = useSWR<DailyReport>(
		`/api/reports/daily?date=${date}`,
		fetcher,
		{
			onError: (err) => {
				toast.error(err.message);
			},
		},
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
	const stockRecommendations =
		report?.stockRecommendations ?? [];
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
					? `/api/transactions?date=${date}&limit=200`
					: `/api/transactions?date=${date}&limit=200&fields=quick`
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
				<DatePickerYMD
					value={date}
					onChange={onDateChange}
				/>
			}
		>
			{isLoading ? (
				<>
					<LoadingCards className="mb-6" />
					<LoadingTable />
				</>
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{error.message}
					</AlertDescription>
				</Alert>
			) : !report ? (
				<EmptyState
					title="No data for this date"
					description="No sales or stock activity has been recorded for this date yet."
				/>
			) : (
				<>
					<StockAlertsPanel
						rows={stockRecommendations}
					/>
					{!report.byProduct?.length ? (
						<EmptyState
							title="No data for this date"
							description="No sales or stock activity has been recorded for this date yet."
						/>
					) : (
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
						</div>
						<Card className="shadow-md">
							<CardHeader>
								<CardTitle>
									Gross Profit Estimate
								</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-3 sm:grid-cols-3">
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
									{report.stockRecommendations
										.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No purchase suggestions for this
											date.
										</p>
									) : (
									<div className="space-y-3">
										{report.stockRecommendations.map(
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
					)}
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
							{date} transaction details shown in dashboard.
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
}: {
	rows: DailyReport["stockRecommendations"];
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
				<CardTitle className="flex items-center gap-2 text-base">
					<AlertCircle className="h-4 w-4 text-destructive" />
					Stock Alerts
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<span className="rounded bg-destructive/10 px-2 py-1 font-medium text-destructive">
						{outOfStock.length} out of stock
					</span>
					<span className="rounded bg-amber-500/10 px-2 py-1 font-medium text-amber-700">
						{lowStock.length} low stock
					</span>
				</div>
				<div className="space-y-2">
					{rows.slice(0, 5).map((item) => (
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
					{rows.length > 5 && (
						<p className="text-xs text-muted-foreground">
							+{rows.length - 5} more in Trends & Recommendations.
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

interface SummaryCardProps {
	title: string;
	value: number;
	variant?: "default" | "negative";
	onClick?: () => void;
}

function SummaryCard({
	title,
	value,
	variant = "default",
	onClick,
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
