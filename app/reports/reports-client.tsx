"use client";
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
	Download,
	Save,
	Trash2,
	GitCompare,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DatePickerYMD } from "@/components/date-picker-ymd";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { LoadingCards } from "@/components/loading-state";
import {
	formatDateDisplay,
	getTodayJHB,
} from "@/lib/date-utils";
import { addDays } from "@/lib/dates";
import { formatZAR } from "@/lib/money";
import * as XLSX from "xlsx";
import type {
	Customer,
	Product,
	Supplier,
} from "@/lib/types";

type ReportsTab =
	| "overview"
	| "timeline"
	| "products"
	| "activity";

type ReportKind =
	| "all"
	| "direct"
	| "account"
	| "payment"
	| "purchase"
	| "adjustment";
type RangePreset =
	| "day"
	| "week"
	| "month"
	| "year"
	| "custom";
type PreferredRangePreset = Exclude<
	RangePreset,
	"custom"
>;

interface RangeReport {
	range: {
		from: string;
		to: string;
		kind: ReportKind;
		productId: string | null;
		supplierId: string | null;
		customerId: string | null;
	};
	summary: {
		salesCents: number;
		directSalesCents: number;
		accountSalesCents: number;
		paymentsCents: number;
		purchaseCostCents: number;
		grossProfitEstimateCents: number;
		salesDiscountCents: number;
		purchaseDiscountCents: number;
		totalDiscountCents: number;
		adjustmentUnitsTotal: number;
		daysWithActivity: number;
	};
	timeline: Array<{
		date: string;
		directSalesCents: number;
		accountSalesCents: number;
		paymentsCents: number;
		purchaseCostCents: number;
		adjustmentUnits: number;
		discountCents: number;
		salesCents: number;
		netCashflowCents: number;
	}>;
	byProduct: Array<{
		productId: string;
		productName: string;
		unitsSold: number;
		salesCents: number;
		unitsPurchased: number;
		purchaseCostCents: number;
		adjustmentUnits: number;
		discountCents: number;
	}>;
	activity: Array<{
		id: string;
		date: string;
		type:
			| "DIRECT_SALE"
			| "ACCOUNT_SALE"
			| "ACCOUNT_PAYMENT"
			| "PURCHASE"
			| "ADJUSTMENT";
		amountCents: number | null;
		discountCents?: number;
		itemsCount?: number;
		counterpartyName?: string;
		paymentMethod?: string;
		reference?: string;
		note?: string;
	}>;
}

interface ReportPreset {
	id: string;
	name: string;
	from: string;
	to: string;
	kind: ReportKind;
	productId: string;
	supplierId: string;
	customerId: string;
}

const PRESET_KEY = "reports-presets:v1";
const RANGE_PREFERENCE_KEY =
	"global-date-range-preference:v1";

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
	return (json?.data ?? json) as any;
};

const isYmd = (value: string | null) =>
	Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const isTab = (
	value: string | null,
): value is ReportsTab =>
	value === "overview" ||
	value === "timeline" ||
	value === "products" ||
	value === "activity";

const isKind = (
	value: string | null,
): value is ReportKind =>
	value === "all" ||
	value === "direct" ||
	value === "account" ||
	value === "payment" ||
	value === "purchase" ||
	value === "adjustment";
const isRangePreset = (
	value: string | null,
): value is RangePreset =>
	value === "day" ||
	value === "week" ||
	value === "month" ||
	value === "year" ||
	value === "custom";
const isPreferredRangePreset = (
	value: string | null,
): value is PreferredRangePreset =>
	value === "day" ||
	value === "week" ||
	value === "month" ||
	value === "year";

const rangeDaysInclusive = (from: string, to: string) => {
	const a = new Date(`${from}T00:00:00.000Z`).getTime();
	const b = new Date(`${to}T00:00:00.000Z`).getTime();
	const diff = Math.floor((b - a) / 86400000);
	return Math.max(1, diff + 1);
};
const rangeFromPreset = (
	preset: PreferredRangePreset,
	to: string,
) => {
	if (preset === "day")
		return { from: to, to };
	if (preset === "week")
		return { from: addDays(to, -6), to };
	if (preset === "year")
		return { from: addDays(to, -364), to };
	return { from: addDays(to, -29), to };
};
const inferRangePreset = (
	from: string,
	to: string,
): RangePreset => {
	if (from === to) return "day";
	const days = rangeDaysInclusive(from, to);
	if (days === 7) return "week";
	if (days === 30) return "month";
	if (days >= 365 && days <= 366) return "year";
	return "custom";
};

function asCsvCell(value: unknown): string {
	const text = String(value ?? "").replaceAll('"', '""');
	return `"${text}"`;
}

function triggerDownload(
	filename: string,
	contents: string,
	mime = "text/csv;charset=utf-8",
) {
	const blob = new Blob([contents], { type: mime });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

export function ReportsClient() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const today = React.useMemo(() => getTodayJHB(), []);
	const [presets, setPresets] = React.useState<
		ReportPreset[]
	>([]);
	const [selectedPresetId, setSelectedPresetId] =
		React.useState<string>("none");
	const [
		rangePreference,
		setRangePreference,
	] = React.useState<PreferredRangePreset>("month");
	const [
		rangePreferenceLoaded,
		setRangePreferenceLoaded,
	] = React.useState(false);
	const fromParam = isYmd(searchParams.get("from"))
		? searchParams.get("from")!
		: null;
	const toParam = isYmd(searchParams.get("to"))
		? searchParams.get("to")!
		: null;
	const rangeParam = isRangePreset(
		searchParams.get("range"),
	)
		? searchParams.get("range")!
		: null;
	const to = toParam ?? today;
	const from = fromParam ?? addDays(to, -29);
	const tab = isTab(searchParams.get("tab"))
		? searchParams.get("tab")!
		: "overview";
	const kindParam = searchParams.get("kind");
	const kind: ReportKind = isKind(kindParam)
		? kindParam
		: "all";
	const productId =
		searchParams.get("productId") ?? "all";
	const supplierId =
		searchParams.get("supplierId") ?? "all";
	const customerId =
		searchParams.get("customerId") ?? "all";

	React.useEffect(() => {
		try {
			const raw = localStorage.getItem(PRESET_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as ReportPreset[];
			if (!Array.isArray(parsed)) return;
			setPresets(parsed);
		} catch {
			setPresets([]);
		}
	}, []);
	React.useEffect(() => {
		try {
			const raw = localStorage.getItem(
				RANGE_PREFERENCE_KEY,
			);
			if (isPreferredRangePreset(raw)) {
				setRangePreference(raw);
			}
		} finally {
			setRangePreferenceLoaded(true);
		}
	}, []);

	const persistPresets = React.useCallback(
		(next: ReportPreset[]) => {
			setPresets(next);
			localStorage.setItem(
				PRESET_KEY,
				JSON.stringify(next),
			);
		},
		[],
	);

	const setQuery = React.useCallback(
		(updates: Record<string, string>) => {
			const params = new URLSearchParams(
				searchParams.toString(),
			);
			for (const [key, value] of Object.entries(
				updates,
			)) {
				if (value === "all" || value === "") {
					params.delete(key);
				} else {
					params.set(key, value);
				}
			}
			const query = params.toString();
			router.replace(
				query ? `${pathname}?${query}` : pathname,
				{ scroll: false },
			);
		},
		[pathname, router, searchParams],
	);
	const setRangePreferenceAndPersist =
		React.useCallback(
			(next: PreferredRangePreset) => {
				setRangePreference(next);
				localStorage.setItem(
					RANGE_PREFERENCE_KEY,
					next,
				);
			},
			[],
		);
	const activeRangePreset = React.useMemo(() => {
		if (rangeParam) return rangeParam;
		return inferRangePreset(from, to);
	}, [from, rangeParam, to]);
	React.useEffect(() => {
		if (!rangePreferenceLoaded) return;
		if (fromParam && toParam) return;
		const next = rangeFromPreset(
			rangePreference,
			toParam ?? today,
		);
		setQuery({
			from: next.from,
			to: next.to,
			range: rangePreference,
		});
	}, [
		fromParam,
		rangePreference,
		rangePreferenceLoaded,
		setQuery,
		toParam,
		today,
	]);

	const reportQuery = React.useMemo(() => {
		const params = new URLSearchParams({
			from,
			to,
			kind,
		});
		if (productId !== "all") {
			params.set("productId", productId);
		}
		if (supplierId !== "all") {
			params.set("supplierId", supplierId);
		}
		if (customerId !== "all") {
			params.set("customerId", customerId);
		}
		return `/api/reports/range?${params.toString()}`;
	}, [from, to, kind, productId, supplierId, customerId]);

	const compareQuery = React.useMemo(() => {
		const days = rangeDaysInclusive(from, to);
		const prevTo = addDays(from, -1);
		const prevFrom = addDays(prevTo, -(days - 1));
		const params = new URLSearchParams({
			from: prevFrom,
			to: prevTo,
			kind,
		});
		if (productId !== "all") {
			params.set("productId", productId);
		}
		if (supplierId !== "all") {
			params.set("supplierId", supplierId);
		}
		if (customerId !== "all") {
			params.set("customerId", customerId);
		}
		return `/api/reports/range?${params.toString()}`;
	}, [from, to, kind, productId, supplierId, customerId]);

	const {
		data: report,
		error,
		isLoading,
	} = useSWR<RangeReport>(reportQuery, fetcher, {
		onError: (err) => toast.error(err.message),
	});
	const { data: compareReport } = useSWR<RangeReport>(
		compareQuery,
		fetcher,
	);

	const { data: products = [] } = useSWR<Product[]>(
		"/api/products",
		fetcher,
	);
	const { data: suppliers = [] } = useSWR<
		Supplier[]
	>("/api/suppliers", fetcher);
	const { data: customers = [] } = useSWR<
		Customer[]
	>("/api/customers", fetcher);

	const clearFilters = () => {
		setQuery({
			kind: "all",
			productId: "all",
			supplierId: "all",
			customerId: "all",
		});
	};
	const applyRangePreset = React.useCallback(
		(value: string) => {
			if (!isRangePreset(value)) return;
			if (value === "custom") {
				setQuery({ range: "custom" });
				return;
			}
			setRangePreferenceAndPersist(value);
			const next = rangeFromPreset(value, to);
			setQuery({
				from: next.from,
				to: next.to,
				range: value,
			});
		},
		[setQuery, setRangePreferenceAndPersist, to],
	);
	const onFromChange = React.useCallback(
		(value: string) => {
			const nextTo = value > to ? value : to;
			setQuery({
				from: value,
				to: nextTo,
				range: "custom",
			});
		},
		[setQuery, to],
	);
	const onToChange = React.useCallback(
		(value: string) => {
			const nextFrom =
				value < from ? value : from;
			setQuery({
				from: nextFrom,
				to: value,
				range: "custom",
			});
		},
		[from, setQuery],
	);

	const saveCurrentPreset = () => {
		const name = window
			.prompt("Preset name")
			?.trim();
		if (!name) return;
		const next: ReportPreset = {
			id: crypto.randomUUID(),
			name,
			from,
			to,
			kind,
			productId,
			supplierId,
			customerId,
		};
		persistPresets([next, ...presets]);
		setSelectedPresetId(next.id);
		toast.success("Preset saved");
	};

	const applyPreset = (id: string) => {
		setSelectedPresetId(id);
		if (id === "none") return;
		const preset = presets.find((p) => p.id === id);
		if (!preset) return;
		setQuery({
			from: preset.from,
			to: preset.to,
			kind: preset.kind,
			productId: preset.productId,
			supplierId: preset.supplierId,
			customerId: preset.customerId,
		});
	};

	const deletePreset = () => {
		if (selectedPresetId === "none") return;
		const next = presets.filter(
			(preset) => preset.id !== selectedPresetId,
		);
		persistPresets(next);
		setSelectedPresetId("none");
		toast.success("Preset deleted");
	};

	const exportData = (mode: "csv" | "xlsx") => {
		if (!report) return;
		const stamp = `${report.range.from}_to_${report.range.to}`;
		const lines: string[] = [];
		lines.push(
			["Section", "Field", "Value"]
				.map(asCsvCell)
				.join(","),
		);
		lines.push(
			[
				"Summary",
				"Range",
				`${report.range.from} to ${report.range.to}`,
			]
				.map(asCsvCell)
				.join(","),
		);
		lines.push(
			["Summary", "Sales", report.summary.salesCents]
				.map(asCsvCell)
				.join(","),
		);
		lines.push(
			[
				"Summary",
				"Purchase Cost",
				report.summary.purchaseCostCents,
			]
				.map(asCsvCell)
				.join(","),
		);
		lines.push(
			[
				"Summary",
				"Total Discount",
				report.summary.totalDiscountCents,
			]
				.map(asCsvCell)
				.join(","),
		);

		lines.push("");
		lines.push(
			["Timeline Date", "Sales", "Payments", "Purchases", "Discounts", "Net Cashflow"]
				.map(asCsvCell)
				.join(","),
		);
		for (const day of report.timeline) {
			lines.push(
				[
					day.date,
					day.salesCents,
					day.paymentsCents,
					day.purchaseCostCents,
					day.discountCents,
					day.netCashflowCents,
				]
					.map(asCsvCell)
					.join(","),
			);
		}

		lines.push("");
		lines.push(
			["Product", "Sold Units", "Purchased Units", "Sales", "Cost", "Discount", "Adjustments"]
				.map(asCsvCell)
				.join(","),
		);
		for (const item of report.byProduct) {
			lines.push(
				[
					item.productName,
					item.unitsSold,
					item.unitsPurchased,
					item.salesCents,
					item.purchaseCostCents,
					item.discountCents,
					item.adjustmentUnits,
				]
					.map(asCsvCell)
					.join(","),
			);
		}

		lines.push("");
		lines.push(
			["Activity Date", "Type", "Party", "Amount", "Discount", "Items", "Payment", "Reference", "Note"]
				.map(asCsvCell)
				.join(","),
		);
		for (const entry of report.activity) {
			lines.push(
				[
					entry.date,
					entry.type,
					entry.counterpartyName ?? "",
					entry.amountCents ?? "",
					entry.discountCents ?? 0,
					entry.itemsCount ?? "",
					entry.paymentMethod ?? "",
					entry.reference ?? "",
					entry.note ?? "",
				]
					.map(asCsvCell)
					.join(","),
			);
		}

		if (mode === "xlsx") {
			const workbook = XLSX.utils.book_new();
			const summaryRows = [
				["Range From", report.range.from],
				["Range To", report.range.to],
				["Kind", report.range.kind],
				["Sales", report.summary.salesCents],
				[
					"Direct Sales",
					report.summary.directSalesCents,
				],
				[
					"Account Sales",
					report.summary.accountSalesCents,
				],
				[
					"Account Payments",
					report.summary.paymentsCents,
				],
				[
					"Purchase Cost",
					report.summary.purchaseCostCents,
				],
				[
					"Estimated Margin",
					report.summary.grossProfitEstimateCents,
				],
				[
					"Total Discounts",
					report.summary.totalDiscountCents,
				],
				[
					"Days With Activity",
					report.summary.daysWithActivity,
				],
			];
			const timelineRows = [
				[
					"Date",
					"Sales",
					"Payments",
					"Purchases",
					"Discounts",
					"Net Cashflow",
				],
				...report.timeline.map((day) => [
					day.date,
					day.salesCents,
					day.paymentsCents,
					day.purchaseCostCents,
					day.discountCents,
					day.netCashflowCents,
				]),
			];
			const productRows = [
				[
					"Product",
					"Sold Units",
					"Purchased Units",
					"Sales",
					"Cost",
					"Discount",
					"Adjustments",
				],
				...report.byProduct.map((item) => [
					item.productName,
					item.unitsSold,
					item.unitsPurchased,
					item.salesCents,
					item.purchaseCostCents,
					item.discountCents,
					item.adjustmentUnits,
				]),
			];
			const activityRows = [
				[
					"Date",
					"Type",
					"Party",
					"Amount",
					"Discount",
					"Items",
					"Payment",
					"Reference",
					"Note",
				],
				...report.activity.map((entry) => [
					entry.date,
					entry.type,
					entry.counterpartyName ?? "",
					entry.amountCents ?? "",
					entry.discountCents ?? 0,
					entry.itemsCount ?? "",
					entry.paymentMethod ?? "",
					entry.reference ?? "",
					entry.note ?? "",
				]),
			];

			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet(summaryRows),
				"Summary",
			);
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet(timelineRows),
				"Timeline",
			);
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet(productRows),
				"Products",
			);
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet(activityRows),
				"Activity",
			);
			XLSX.writeFile(
				workbook,
				`report_${stamp}.xlsx`,
			);
			return;
		}
		triggerDownload(`report_${stamp}.csv`, lines.join("\n"));
	};

	const salesDeltaCents =
		report && compareReport
			? report.summary.salesCents -
				compareReport.summary.salesCents
			: null;
	const purchaseDeltaCents =
		report && compareReport
			? report.summary.purchaseCostCents -
				compareReport.summary.purchaseCostCents
			: null;
	const marginDeltaCents =
		report && compareReport
			? report.summary.grossProfitEstimateCents -
				compareReport.summary.grossProfitEstimateCents
			: null;

	return (
		<PageWrapper
			title="Reports"
			description="Analyze historical sales, purchases, customer account activity, and discounts by date range."
			actions={
				<div className="flex flex-col gap-2 sm:flex-row">
					<Select
						value={activeRangePreset}
						onValueChange={applyRangePreset}
					>
						<SelectTrigger className="w-[170px]">
							<SelectValue placeholder="Range preset" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="day">
								Day
							</SelectItem>
							<SelectItem value="week">
								Week
							</SelectItem>
							<SelectItem value="month">
								Month
							</SelectItem>
							<SelectItem value="year">
								Year
							</SelectItem>
							<SelectItem value="custom">
								Custom
							</SelectItem>
						</SelectContent>
					</Select>
					<DatePickerYMD
						value={from}
						onChange={onFromChange}
					/>
					<DatePickerYMD
						value={to}
						onChange={onToChange}
					/>
				</div>
			}
		>
			<Card className="mb-4">
				<CardContent className="pt-6">
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
						<div className="space-y-1">
							<Label>Kind</Label>
							<Select value={kind} onValueChange={(value) => setQuery({ kind: value })}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Activity</SelectItem>
									<SelectItem value="direct">Direct Sales</SelectItem>
									<SelectItem value="account">Account Sales</SelectItem>
									<SelectItem value="payment">Account Payments</SelectItem>
									<SelectItem value="purchase">Purchases</SelectItem>
									<SelectItem value="adjustment">Adjustments</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label>Product</Label>
							<Select value={productId} onValueChange={(value) => setQuery({ productId: value })}>
								<SelectTrigger>
									<SelectValue placeholder="All products" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All products</SelectItem>
									{products.map((product) => (
										<SelectItem key={product.id} value={product.id}>
											{product.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label>Supplier</Label>
							<Select value={supplierId} onValueChange={(value) => setQuery({ supplierId: value })}>
								<SelectTrigger>
									<SelectValue placeholder="All suppliers" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All suppliers</SelectItem>
									{suppliers.map((supplier) => (
										<SelectItem key={supplier.id} value={supplier.id}>
											{supplier.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label>Customer</Label>
							<Select value={customerId} onValueChange={(value) => setQuery({ customerId: value })}>
								<SelectTrigger>
									<SelectValue placeholder="All customers" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All customers</SelectItem>
									{customers.map((customer) => (
										<SelectItem key={customer.id} value={customer.id}>
											{customer.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-end">
							<Button type="button" variant="outline" onClick={clearFilters} className="w-full">
								Clear Filters
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="mb-6">
				<CardContent className="pt-6">
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
						<div className="space-y-1">
							<Label>Saved Preset</Label>
							<Select value={selectedPresetId} onValueChange={applyPreset}>
								<SelectTrigger>
									<SelectValue placeholder="Select preset" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">No preset</SelectItem>
									{presets.map((preset) => (
										<SelectItem key={preset.id} value={preset.id}>
											{preset.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-end">
							<Button type="button" variant="outline" className="w-full" onClick={saveCurrentPreset}>
								<Save className="mr-2 h-4 w-4" /> Save Preset
							</Button>
						</div>
						<div className="flex items-end">
							<Button type="button" variant="outline" className="w-full" onClick={deletePreset} disabled={selectedPresetId === "none"}>
								<Trash2 className="mr-2 h-4 w-4" /> Delete Preset
							</Button>
						</div>
						<div className="flex items-end">
							<Button type="button" className="w-full" onClick={() => exportData("csv")} disabled={!report}>
								<Download className="mr-2 h-4 w-4" /> Export CSV
							</Button>
						</div>
						<div className="flex items-end">
							<Button type="button" variant="secondary" className="w-full" onClick={() => exportData("xlsx")} disabled={!report}>
								<Download className="mr-2 h-4 w-4" /> Export XLSX
							</Button>
						</div>
						<div className="flex items-end text-xs text-muted-foreground">
							<div className="rounded-md border px-3 py-2">
								<GitCompare className="mr-1 inline h-3.5 w-3.5" />
								Comparison uses previous equal range.
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{isLoading ? (
				<LoadingCards />
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : !report ? (
				<EmptyState
					title="No report data"
					description="Try changing the date range or filters."
				/>
			) : (
				<Tabs
					value={tab}
					onValueChange={(value) => {
						if (!isTab(value)) return;
						setQuery({ tab: value });
					}}
					className="space-y-6"
				>
					<TabsList className="flex w-full items-center gap-1 overflow-x-auto">
						<TabsTrigger value="overview" className="shrink-0">Overview</TabsTrigger>
						<TabsTrigger value="timeline" className="shrink-0">Timeline</TabsTrigger>
						<TabsTrigger value="products" className="shrink-0">Products</TabsTrigger>
						<TabsTrigger value="activity" className="shrink-0">Activity</TabsTrigger>
					</TabsList>

					<TabsContent value="overview" className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<SummaryCard label="Sales" value={report.summary.salesCents} />
							<SummaryCard label="Purchases Cost" value={report.summary.purchaseCostCents} />
							<SummaryCard label="Estimated Margin" value={report.summary.grossProfitEstimateCents} />
							<SummaryCard label="Total Discounts" value={report.summary.totalDiscountCents} />
							<SummaryCard label="Direct Sales" value={report.summary.directSalesCents} />
							<SummaryCard label="Account Sales" value={report.summary.accountSalesCents} />
							<SummaryCard label="Account Payments" value={report.summary.paymentsCents} />
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm text-muted-foreground">Activity Days</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-2xl font-bold">{report.summary.daysWithActivity}</p>
								</CardContent>
							</Card>
						</div>
						<div className="grid gap-4 md:grid-cols-3">
							<DeltaCard title="Sales vs previous period" deltaCents={salesDeltaCents} />
							<DeltaCard title="Purchases vs previous period" deltaCents={purchaseDeltaCents} />
							<DeltaCard title="Margin vs previous period" deltaCents={marginDeltaCents} />
						</div>
						<p className="text-sm text-muted-foreground">
							Range: {formatDateDisplay(report.range.from)} to {formatDateDisplay(report.range.to)}
						</p>
					</TabsContent>

					<TabsContent value="timeline">
						{report.timeline.length === 0 ? (
							<EmptyState title="No timeline data" description="No entries were found for this range." />
						) : (
							<>
								<div className="hidden md:block rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Sales</TableHead>
												<TableHead>Payments</TableHead>
												<TableHead>Purchases</TableHead>
												<TableHead>Discounts</TableHead>
												<TableHead>Net Cashflow</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{report.timeline.map((day) => (
												<TableRow key={day.date}>
													<TableCell>{formatDateDisplay(day.date)}</TableCell>
													<TableCell>{formatZAR(day.salesCents)}</TableCell>
													<TableCell>{formatZAR(day.paymentsCents)}</TableCell>
													<TableCell>{formatZAR(day.purchaseCostCents)}</TableCell>
													<TableCell>{formatZAR(day.discountCents)}</TableCell>
													<TableCell>{formatZAR(day.netCashflowCents)}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
								<div className="space-y-3 md:hidden">
									{report.timeline.map((day) => (
										<Card key={day.date}>
											<CardHeader className="pb-2">
												<CardTitle className="text-base">{formatDateDisplay(day.date)}</CardTitle>
											</CardHeader>
											<CardContent className="grid grid-cols-2 gap-2 text-sm">
												<p>Sales: {formatZAR(day.salesCents)}</p>
												<p>Payments: {formatZAR(day.paymentsCents)}</p>
												<p>Purchases: {formatZAR(day.purchaseCostCents)}</p>
												<p>Discounts: {formatZAR(day.discountCents)}</p>
												<p className="col-span-2 font-medium">Net Cashflow: {formatZAR(day.netCashflowCents)}</p>
											</CardContent>
										</Card>
									))}
								</div>
							</>
						)}
					</TabsContent>

					<TabsContent value="products">
						{report.byProduct.length === 0 ? (
							<EmptyState title="No product activity" description="No matching product movement for this range." />
						) : (
							<>
								<div className="hidden md:block rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Product</TableHead>
												<TableHead>Sold</TableHead>
												<TableHead>Purchased</TableHead>
												<TableHead>Sales Value</TableHead>
												<TableHead>Cost</TableHead>
												<TableHead>Discount</TableHead>
												<TableHead>Adjustments</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{report.byProduct.map((item) => (
												<TableRow key={item.productId}>
													<TableCell className="font-medium">{item.productName}</TableCell>
													<TableCell>{item.unitsSold}</TableCell>
													<TableCell>{item.unitsPurchased}</TableCell>
													<TableCell>{formatZAR(item.salesCents)}</TableCell>
													<TableCell>{formatZAR(item.purchaseCostCents)}</TableCell>
													<TableCell>{formatZAR(item.discountCents)}</TableCell>
													<TableCell>{item.adjustmentUnits}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
								<div className="space-y-3 md:hidden">
									{report.byProduct.map((item) => (
										<Card key={item.productId}>
											<CardHeader className="pb-2">
												<CardTitle className="text-base">{item.productName}</CardTitle>
											</CardHeader>
											<CardContent className="grid grid-cols-2 gap-2 text-sm">
												<p>Sold: {item.unitsSold}</p>
												<p>Purchased: {item.unitsPurchased}</p>
												<p>Sales: {formatZAR(item.salesCents)}</p>
												<p>Cost: {formatZAR(item.purchaseCostCents)}</p>
												<p>Discount: {formatZAR(item.discountCents)}</p>
												<p>Adjustments: {item.adjustmentUnits}</p>
											</CardContent>
										</Card>
									))}
								</div>
							</>
						)}
					</TabsContent>

					<TabsContent value="activity">
						{report.activity.length === 0 ? (
							<EmptyState title="No activity found" description="No records match your filters." />
						) : (
							<>
								<div className="hidden md:block rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Party</TableHead>
												<TableHead>Amount</TableHead>
												<TableHead>Discount</TableHead>
												<TableHead>Items</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{report.activity.map((item) => (
												<TableRow key={item.id}>
													<TableCell>{formatDateDisplay(item.date)}</TableCell>
													<TableCell>{item.type.replaceAll("_", " ")}</TableCell>
													<TableCell>{item.counterpartyName ?? "-"}</TableCell>
													<TableCell>{item.amountCents === null ? "-" : formatZAR(item.amountCents)}</TableCell>
													<TableCell>{formatZAR(item.discountCents ?? 0)}</TableCell>
													<TableCell>{item.itemsCount ?? "-"}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
								<div className="space-y-3 md:hidden">
									{report.activity.map((item) => (
										<Card key={item.id}>
											<CardHeader className="pb-2">
												<CardTitle className="text-base">{item.type.replaceAll("_", " ")}</CardTitle>
											</CardHeader>
											<CardContent className="space-y-1 text-sm">
												<p>Date: {formatDateDisplay(item.date)}</p>
												<p>Party: {item.counterpartyName ?? "-"}</p>
												<p>Amount: {item.amountCents === null ? "-" : formatZAR(item.amountCents)}</p>
												<p>Discount: {formatZAR(item.discountCents ?? 0)}</p>
												{item.note && <p className="text-muted-foreground">{item.note}</p>}
											</CardContent>
										</Card>
									))}
								</div>
							</>
						)}
					</TabsContent>
				</Tabs>
			)}
		</PageWrapper>
	);
}

function SummaryCard({
	label,
	value,
}: {
	label: string;
	value: number;
}) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-2xl font-bold">{formatZAR(value)}</p>
			</CardContent>
		</Card>
	);
}

function DeltaCard({
	title,
	deltaCents,
}: {
	title: string;
	deltaCents: number | null;
}) {
	const colorClass =
		deltaCents === null
			? "text-muted-foreground"
			: deltaCents >= 0
				? "text-emerald-600"
				: "text-rose-600";
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className={`text-xl font-semibold ${colorClass}`}>
					{deltaCents === null ? "-" : formatZAR(deltaCents)}
				</p>
			</CardContent>
		</Card>
	);
}
