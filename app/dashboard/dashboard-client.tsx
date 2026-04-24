"use client";
/* eslint-disable max-len */

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
	AlertCircle,
	CheckCircle2,
	CircleDashed,
	ClipboardList,
	Lightbulb,
	Minus,
	TrendingDown,
	TrendingUp,
	TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/page-wrapper";
import { DateRangeControls } from "@/components/date-range-controls";
import {
	LoadingCards,
	LoadingTable,
} from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import { formatZAR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useOfflineCachedSWR } from "@/lib/use-offline-cached-swr";
import { useGlobalDateRangeQuery } from "@/lib/use-global-date-range-query";
import type { DailyReport } from "@/lib/types";
import { DatePickerYMD } from "@/components/date-picker-ymd";

const DASHBOARD_TABS = [
	"operations",
	"movement",
	"insights",
] as const;
type DashboardTab =
	(typeof DASHBOARD_TABS)[number];

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

const formatUnits = (
	value: number | null | undefined,
) => {
	if (value === null || value === undefined)
		return "-";
	return value.toLocaleString();
};

export function DashboardClient() {
	const searchParams = useSearchParams();
	const { to: date, updateQuery } =
		useGlobalDateRangeQuery();
	const activeTab = isDashboardTab(
		searchParams.get("tab"),
	)
		? searchParams.get("tab")!
		: "operations";

	const onTabChange = React.useCallback(
		(nextTab: string) => {
			if (!isDashboardTab(nextTab)) return;
			updateQuery({ tab: nextTab });
		},
		[updateQuery],
	);

	const onDateChange = React.useCallback(
		(nextDate: string) => {
			updateQuery({
				from: null,
				to: nextDate,
				range: null,
				date: nextDate,
			});
		},
		[updateQuery],
	);

	const {
		data: report,
		error: effectiveError,
		isLoading: effectiveLoading,
	} = useOfflineCachedSWR<DailyReport>({
		key: `/api/reports/daily?date=${date}`,
		cacheKey: `dashboard:daily-report:${date}`,
		fetcher,
		onError: (err) => toast.error(err.message),
	});

	const checklistItems = React.useMemo(() => {
		if (!report) return [];
		return [
			{
				label: "Morning count completed",
				done: report.dayChecklist.hasMorningCount,
				detail:
					"Opening stock has been captured for the selected day.",
				href: `/stock-counts?date=${date}`,
			},
			{
				label: "Next morning count available",
				done: report.dayChecklist
					.hasNextMorningCount,
				detail:
					"The next morning count is needed to calculate sold quantities reliably.",
				href: report.movementStatus?.nextDate
					? `/stock-counts?date=${report.movementStatus.nextDate}`
					: "/stock-counts",
			},
			{
				label: "Deliveries recorded",
				done: report.dayChecklist.hasPurchases,
				detail:
					"Supplier purchases received during the day are included.",
				href: "/purchases",
			},
			{
				label: "Adjustments recorded",
				done: report.dayChecklist.hasAdjustments,
				detail:
					"Breakage, freebies, theft, and corrections are included.",
				href: "/adjustments",
			},
			{
				label: "Customer payments recorded",
				done: report.dayChecklist.hasTabActivity,
				detail:
					"Payments against customer accounts are captured separately from sold units.",
				href: "/tabs?action=payment",
			},
		];
	}, [date, report]);

	const salesTrendLabel = React.useMemo(() => {
		if (!report?.trends?.sales) return "-";
		const changePct =
			report.trends.sales.changePct;
		if (changePct === null)
			return "No previous day";
		const sign = changePct > 0 ? "+" : "";
		return `${sign}${changePct.toFixed(1)}%`;
	}, [report]);

	const movementStatus = report?.movementStatus;
	const missingOpeningCount =
		movementStatus?.missingOpeningProductIds
			.length ?? 0;
	const missingClosingCount =
		movementStatus?.missingClosingProductIds
			.length ?? 0;
	const varianceCount =
		report?.byProduct.filter(
			(row) =>
				(row.negativeVarianceUnits ?? 0) > 0,
		).length ?? 0;

	return (
		<PageWrapper
			title="Daily Operations"
			description="Start the day with a stock count, record stock movements, then review calculated daily movement."
			actions={
				<DatePickerYMD
					value={date}
					onChange={onDateChange}
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
					title="No operations data for this date"
					description="Start with a morning count, then record purchases, adjustments, and payments as they happen."
				/>
			) : (
				<Tabs
					value={activeTab}
					onValueChange={onTabChange}
					className="space-y-6"
				>
					<TabsList className="flex w-full items-center gap-1 overflow-x-auto">
						<TabsTrigger
							value="operations"
							className="shrink-0 text-xs sm:text-sm"
						>
							Operations
						</TabsTrigger>
						<TabsTrigger
							value="movement"
							className="shrink-0 text-xs sm:text-sm"
						>
							Daily Movement
						</TabsTrigger>
						<TabsTrigger
							value="insights"
							className="shrink-0 text-xs sm:text-sm"
						>
							Insights
						</TabsTrigger>
					</TabsList>

					<TabsContent
						value="operations"
						className="space-y-6"
					>
						<DayStatusStrip
							hasOpeningCount={
								movementStatus?.hasOpeningCount ??
								false
							}
							hasClosingCount={
								movementStatus?.hasClosingCount ??
								false
							}
							missingOpeningCount={
								missingOpeningCount
							}
							missingClosingCount={
								missingClosingCount
							}
							varianceCount={varianceCount}
							nextDate={movementStatus?.nextDate}
						/>

						{report.warnings.length > 0 && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>
									Movement warnings
								</AlertTitle>
								<AlertDescription>
									<ul className="mt-1 list-inside list-disc">
										{report.warnings.map(
											(warning) => (
												<li key={warning}>
													{warning}
												</li>
											),
										)}
									</ul>
								</AlertDescription>
							</Alert>
						)}

						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
							{checklistItems.map((item) => (
								<Link
									key={item.label}
									href={item.href}
								>
									<Card className="h-full shadow-md transition-colors hover:bg-accent/40">
										<CardContent className="flex items-start gap-3 pt-4">
											{item.done ? (
												<CheckCircle2 className="mt-1 h-5 w-5 text-emerald-500" />
											) : (
												<CircleDashed className="mt-1 h-5 w-5 text-muted-foreground" />
											)}
											<div>
												<p className="text-sm font-medium">
													{item.label}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{item.detail}
												</p>
											</div>
										</CardContent>
									</Card>
								</Link>
							))}
						</div>

						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<SummaryCard
								title="Calculated Sales Value"
								value={formatZAR(
									report.expectedRevenueCents,
								)}
							/>
							<SummaryCard
								title="Customer Payments"
								value={formatZAR(
									report.tabPaymentsByMethodCents
										.CASH +
										report
											.tabPaymentsByMethodCents
											.CARD +
										report
											.tabPaymentsByMethodCents
											.EFT,
								)}
							/>
							<SummaryCard
								title="Customers Owe"
								value={formatZAR(
									report.outstandingTabBalanceCents,
								)}
								href="/tabs"
							/>
							<SummaryCard
								title="Expenses"
								value={formatZAR(
									report.expensesCents ?? 0,
								)}
							/>
							<SummaryCard
								title="Est. Gross Profit"
								value={formatZAR(
									report.grossProfit
										.grossProfitCents,
								)}
								variant={
									report.grossProfit
										.grossProfitCents < 0
										? "negative"
										: "default"
								}
							/>
							<SummaryCard
								title="Net After Expenses"
								value={formatZAR(
									report.netProfitAfterExpensesCents ??
										0,
								)}
								variant={
									(report.netProfitAfterExpensesCents ??
										0) < 0
										? "negative"
										: "default"
								}
							/>
							<SummaryCard
								title="Movement Trend"
								value={salesTrendLabel}
							/>
							<SummaryCard
								title="Overdue Customer Balance"
								value={formatZAR(
									report.overdueTabBalanceCents,
								)}
								variant={
									report.overdueTabBalanceCents >
									0
										? "negative"
										: "default"
								}
								href="/tabs?customerFilter=overdue"
							/>
						</div>

						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<Button
								asChild
								className="justify-start gap-2"
							>
								<Link
									href={`/stock-counts?date=${date}`}
								>
									<ClipboardList className="h-4 w-4" />
									Morning Count
								</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								className="justify-start"
							>
								<Link href="/purchases">
									Record Delivery
								</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								className="justify-start"
							>
								<Link href="/adjustments">
									Record Adjustment
								</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								className="justify-start"
							>
								<Link href="/tabs?action=payment">
									Customer Payment
								</Link>
							</Button>
						</div>
					</TabsContent>

					<TabsContent
						value="movement"
						className="space-y-6"
					>
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>
									Calculated movement by product
								</CardTitle>
							</CardHeader>
							<CardContent className="p-0">
								{report.byProduct.length === 0 ? (
									<div className="p-6">
										<EmptyState
											title="No movement rows"
											description="Complete morning counts and record stock movements to calculate sold quantities."
										/>
									</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>
													Product
												</TableHead>
												<TableHead className="text-right">
													Opening
												</TableHead>
												<TableHead className="text-right">
													Purchases
												</TableHead>
												<TableHead className="text-right">
													Adjustments
												</TableHead>
												<TableHead className="text-right">
													Next count
												</TableHead>
												<TableHead className="text-right">
													Sold
												</TableHead>
												<TableHead className="text-right">
													Value
												</TableHead>
												<TableHead>
													Status
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{report.byProduct.map(
												(row) => {
													const hasVariance =
														(row.negativeVarianceUnits ??
															0) > 0;
													return (
														<TableRow
															key={row.productId}
														>
															<TableCell className="font-medium">
																{row.productName}
															</TableCell>
															<TableCell className="text-right">
																{formatUnits(
																	row.openingUnits,
																)}
															</TableCell>
															<TableCell className="text-right">
																{formatUnits(
																	row.purchasedUnits,
																)}
															</TableCell>
															<TableCell className="text-right">
																{formatUnits(
																	row.adjustments,
																)}
															</TableCell>
															<TableCell className="text-right">
																{formatUnits(
																	row.closingUnits,
																)}
															</TableCell>
															<TableCell
																className={cn(
																	"text-right",
																	hasVariance &&
																		"text-destructive",
																)}
															>
																{formatUnits(
																	row.calculatedUnitsSold ??
																		row.unitsSold,
																)}
															</TableCell>
															<TableCell className="text-right">
																{formatZAR(
																	row.expectedRevenueCents,
																)}
															</TableCell>
															<TableCell>
																{row.missingOpeningCount ||
																row.missingClosingCount ? (
																	<span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
																		Missing count
																	</span>
																) : hasVariance ? (
																	<span className="rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">
																		Variance
																	</span>
																) : (
																	<span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
																		Ready
																	</span>
																)}
															</TableCell>
														</TableRow>
													);
												},
											)}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="insights"
						className="space-y-6"
					>
						<div className="grid gap-4 lg:grid-cols-3">
							<InsightTable
								title="Top movers"
								rows={report.inventoryInsights.topMovers.map(
									(row) => ({
										productId: row.productId,
										productName: row.productName,
										metric: `${row.unitsSoldToday.toLocaleString()} sold`,
										detail: `${row.currentUnits.toLocaleString()} currently counted`,
									}),
								)}
							/>
							<InsightTable
								title="Slow movers"
								rows={report.inventoryInsights.slowMovers.map(
									(row) => ({
										productId: row.productId,
										productName: row.productName,
										metric: `${row.unitsSoldLast30Days.toLocaleString()} sold in 30 days`,
										detail: `${row.currentUnits.toLocaleString()} currently counted`,
									}),
								)}
							/>
							<InsightTable
								title="Dead stock"
								rows={report.inventoryInsights.deadStock.map(
									(row) => ({
										productId: row.productId,
										productName: row.productName,
										metric: "0 sold in 30 days",
										detail: `${row.currentUnits.toLocaleString()} currently counted`,
									}),
								)}
							/>
						</div>

						<Card className="shadow-md">
							<CardHeader>
								<CardTitle>
									Recommendations
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{report.recommendations.length ===
								0 ? (
									<p className="text-sm text-muted-foreground">
										No recommendations for this
										period.
									</p>
								) : (
									report.recommendations.map(
										(recommendation) => (
											<div
												key={`${recommendation.title}:${recommendation.detail}`}
												className="flex items-start gap-3 rounded-lg border p-3"
											>
												<Lightbulb className="mt-0.5 h-4 w-4 text-amber-500" />
												<div>
													<p className="text-sm font-medium">
														{recommendation.title}
													</p>
													<p className="text-xs text-muted-foreground">
														{
															recommendation.detail
														}
													</p>
												</div>
											</div>
										),
									)
								)}
							</CardContent>
						</Card>

						<Card className="shadow-md">
							<CardHeader>
								<CardTitle>
									Restock recommendations
								</CardTitle>
							</CardHeader>
							<CardContent className="p-0">
								{report.stockRecommendations
									.length === 0 ? (
									<p className="p-4 text-sm text-muted-foreground">
										No restock recommendations
										right now.
									</p>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>
													Product
												</TableHead>
												<TableHead className="text-right">
													Current
												</TableHead>
												<TableHead className="text-right">
													Reorder level
												</TableHead>
												<TableHead className="text-right">
													Recommended
												</TableHead>
												<TableHead>
													Priority
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{report.stockRecommendations.map(
												(row) => (
													<TableRow
														key={row.productId}
													>
														<TableCell className="font-medium">
															{row.productName}
														</TableCell>
														<TableCell className="text-right">
															{row.currentUnits.toLocaleString()}
														</TableCell>
														<TableCell className="text-right">
															{row.reorderLevelUnits.toLocaleString()}
														</TableCell>
														<TableCell className="text-right">
															{row.recommendedOrderUnits.toLocaleString()}
														</TableCell>
														<TableCell>
															{row.priority}
														</TableCell>
													</TableRow>
												),
											)}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			)}
		</PageWrapper>
	);
}

function DayStatusStrip({
	hasOpeningCount,
	hasClosingCount,
	missingOpeningCount,
	missingClosingCount,
	varianceCount,
	nextDate,
}: {
	hasOpeningCount: boolean;
	hasClosingCount: boolean;
	missingOpeningCount: number;
	missingClosingCount: number;
	varianceCount: number;
	nextDate?: string;
}) {
	const items = [
		{
			label: hasOpeningCount
				? "Morning count completed"
				: "Morning count not started",
			state: hasOpeningCount ? "ok" : "warn",
		},
		{
			label: hasClosingCount
				? "Next morning count available"
				: `Missing next-day count${nextDate ? ` (${nextDate})` : ""}`,
			state: hasClosingCount ? "ok" : "warn",
		},
		{
			label:
				missingOpeningCount +
					missingClosingCount >
				0
					? `${missingOpeningCount + missingClosingCount} missing product count(s)`
					: "No missing product counts",
			state:
				missingOpeningCount +
					missingClosingCount >
				0
					? "warn"
					: "ok",
		},
		{
			label:
				varianceCount > 0
					? `${varianceCount} variance(s) need review`
					: "No negative variances",
			state: varianceCount > 0 ? "bad" : "ok",
		},
	];

	return (
		<Card className="border-primary/20 bg-primary/5 shadow-md">
			<CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-4">
				{items.map((item) => (
					<div
						key={item.label}
						className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
					>
						{item.state === "ok" ? (
							<CheckCircle2 className="h-4 w-4 text-emerald-500" />
						) : item.state === "bad" ? (
							<TriangleAlert className="h-4 w-4 text-destructive" />
						) : (
							<CircleDashed className="h-4 w-4 text-amber-500" />
						)}
						<span>{item.label}</span>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function SummaryCard({
	title,
	value,
	variant = "default",
	href,
}: {
	title: string;
	value: string;
	variant?: "default" | "negative";
	href?: string;
}) {
	const card = (
		<Card className="h-full shadow-md transition-colors hover:bg-accent/30">
			<CardContent className="pt-4">
				<p className="text-xs text-muted-foreground">
					{title}
				</p>
				<p
					className={cn(
						"mt-1 text-xl font-semibold",
						variant === "negative" &&
							"text-destructive",
					)}
				>
					{value}
				</p>
			</CardContent>
		</Card>
	);

	if (!href) return card;
	return <Link href={href}>{card}</Link>;
}

function InsightTable({
	title,
	rows,
}: {
	title: string;
	rows: {
		productId: string;
		productName: string;
		metric: string;
		detail: string;
	}[];
}) {
	return (
		<Card className="shadow-md">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No products to show.
					</p>
				) : (
					rows.map((row, index) => (
						<div
							key={row.productId}
							className="flex items-start justify-between gap-3 rounded-lg border p-3"
						>
							<div>
								<p className="text-sm font-medium">
									{row.productName}
								</p>
								<p className="text-xs text-muted-foreground">
									{row.detail}
								</p>
							</div>
							<div className="flex items-center gap-1 text-sm font-medium">
								{index === 0 ? (
									<TrendingUp className="h-4 w-4 text-emerald-500" />
								) : index === rows.length - 1 ? (
									<TrendingDown className="h-4 w-4 text-amber-500" />
								) : (
									<Minus className="h-4 w-4 text-muted-foreground" />
								)}
								{row.metric}
							</div>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}
