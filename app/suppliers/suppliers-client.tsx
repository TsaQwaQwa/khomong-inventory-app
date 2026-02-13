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
import { AlertCircle } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DatePickerYMD } from "@/components/date-picker-ymd";
import { LoadingTable } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
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
import { getTodayJHB } from "@/lib/date-utils";
import { formatZAR } from "@/lib/money";
import type {
	DailyReport,
	Product,
	Purchase,
	Supplier,
	SupplierPrice,
} from "@/lib/types";

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

interface RestockPlanRow {
	productId: string;
	productName: string;
	recommendedUnits: number;
	lastSupplierName: string;
	lastUnitCostCents: number | null;
	bestSupplierName: string;
	bestUnitCostCents: number | null;
	bestCostSource: "PURCHASE_HISTORY" | "PRICE_LIST" | "NONE";
	potentialSavingsCents: number;
}

const formatOptionalMoney = (
	cents: number | null,
) => (cents === null ? "-" : formatZAR(cents));

const SUPPLIER_TABS = [
	"directory",
	"contracts",
	"restock",
] as const;

type SupplierTab = (typeof SUPPLIER_TABS)[number];

const isValidDateParam = (
	value: string | null,
): value is string =>
	Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const isSupplierTab = (
	value: string | null,
): value is SupplierTab =>
	Boolean(
		value &&
			SUPPLIER_TABS.includes(value as SupplierTab),
	);

export function SuppliersClient() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const date = isValidDateParam(
		searchParams.get("date"),
	)
		? searchParams.get("date")!
		: getTodayJHB();
	const activeTab = isSupplierTab(
		searchParams.get("tab"),
	)
		? searchParams.get("tab")!
		: "directory";

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
			if (!isSupplierTab(nextTab)) return;
			updateQueryParam("tab", nextTab);
		},
		[updateQueryParam],
	);

	const {
		data: suppliers,
		error: suppliersError,
		isLoading: suppliersLoading,
	} = useSWR<Supplier[]>(
		"/api/suppliers",
		fetcher,
	);
	const { data: access } = useSWR<{
		isAdmin: boolean;
	}>("/api/session/access", fetcher);
	const isAdmin = access?.isAdmin ?? false;
	const [backfillLoading, setBackfillLoading] =
		React.useState(false);
	const { data: products = [] } = useSWR<Product[]>(
		"/api/products",
		fetcher,
	);
	const { data: report } = useSWR<DailyReport>(
		`/api/reports/daily?date=${date}`,
		fetcher,
	);
	const { data: purchases = [] } = useSWR<Purchase[]>(
		`/api/purchases?date=${date}&lookbackDays=90`,
		fetcher,
	);
	const {
		data: supplierPrices = [],
		mutate: mutateSupplierPrices,
	} = useSWR<SupplierPrice[]>(
		`/api/supplier-prices?asOf=${date}`,
		fetcher,
	);

	const productNameById = React.useMemo(
		() =>
			new Map(products.map((p) => [p.id, p.name])),
		[products],
	);

	const supplierNameById = React.useMemo(
		() =>
			new Map(
				(suppliers ?? []).map((s) => [s.id, s.name]),
			),
		[suppliers],
	);

	const supplierSummary = React.useMemo(() => {
		const purchaseCounts = new Map<string, number>();
		const lastPurchaseDate = new Map<string, string>();
		const priceListCountBySupplier = new Map<
			string,
			number
		>();
		const purchasedProductsBySupplier = new Map<
			string,
			Set<string>
		>();

		for (const purchase of purchases) {
			if (!purchase.supplierId) continue;
			purchaseCounts.set(
				purchase.supplierId,
				(purchaseCounts.get(purchase.supplierId) ??
					0) + 1,
			);
			if (!lastPurchaseDate.has(purchase.supplierId)) {
				lastPurchaseDate.set(
					purchase.supplierId,
					purchase.purchaseDate,
				);
			}
		}

		for (const contract of supplierPrices) {
			priceListCountBySupplier.set(
				contract.supplierId,
				(priceListCountBySupplier.get(
					contract.supplierId,
				) ?? 0) + 1,
			);
		}
		for (const purchase of purchases) {
			if (!purchase.supplierId) continue;
			for (const item of purchase.items ?? []) {
				const hasCost =
					typeof item.unitCostCents === "number" &&
					item.unitCostCents > 0;
				if (!hasCost) continue;
				if (
					!purchasedProductsBySupplier.has(
						purchase.supplierId,
					)
				) {
					purchasedProductsBySupplier.set(
						purchase.supplierId,
						new Set(),
					);
				}
				purchasedProductsBySupplier
					.get(purchase.supplierId)
					?.add(item.productId);
			}
		}

		return (suppliers ?? []).map((supplier) => ({
			...supplier,
			purchaseCount:
				purchaseCounts.get(supplier.id) ?? 0,
			lastPurchase:
				lastPurchaseDate.get(supplier.id) ?? "-",
			knownCosts:
				Math.max(
					priceListCountBySupplier.get(
						supplier.id,
					) ?? 0,
					purchasedProductsBySupplier.get(
						supplier.id,
					)?.size ?? 0,
				) ?? 0,
		}));
	}, [purchases, supplierPrices, suppliers]);

	const contractRows = React.useMemo(() => {
		return supplierPrices
			.map((contract) => ({
				...contract,
				supplierName:
					supplierNameById.get(contract.supplierId) ??
					"Unknown Supplier",
				productName:
					productNameById.get(contract.productId) ??
					contract.productId,
			}))
			.sort((a, b) => {
				if (a.productName === b.productName) {
					return a.unitCostCents - b.unitCostCents;
				}
				return a.productName.localeCompare(
					b.productName,
				);
			});
	}, [productNameById, supplierNameById, supplierPrices]);

	const planRows = React.useMemo(() => {
		const lastObservedByProduct = new Map<
			string,
			{ supplierId: string; unitCostCents: number }
		>();
		for (const purchase of purchases) {
			if (!purchase.supplierId) continue;
			for (const item of purchase.items ?? []) {
				if (
					!item.productId ||
					typeof item.unitCostCents !== "number" ||
					item.unitCostCents <= 0 ||
					lastObservedByProduct.has(item.productId)
				) {
					continue;
				}
				lastObservedByProduct.set(item.productId, {
					supplierId: purchase.supplierId,
					unitCostCents: item.unitCostCents,
				});
			}
		}

		const knownOptionsByProduct = new Map<
			string,
			{
				supplierId: string;
				unitCostCents: number;
				source: "PURCHASE_HISTORY" | "PRICE_LIST";
			}[]
		>();
		const purchaseAvgByProductSupplier = new Map<
			string,
			{ costCents: number; units: number }
		>();

		for (const purchase of purchases) {
			if (!purchase.supplierId) continue;
			for (const item of purchase.items ?? []) {
				const units = item.units ?? 0;
				if (!item.productId || units <= 0) continue;
				const lineCost =
					typeof item.lineTotalCostCents ===
					"number"
						? item.lineTotalCostCents
						: typeof item.unitCostCents === "number"
							? item.unitCostCents * units
							: null;
				if (lineCost === null || lineCost <= 0) continue;
				const key = `${item.productId}::${purchase.supplierId}`;
				const existing =
					purchaseAvgByProductSupplier.get(key) ?? {
						costCents: 0,
						units: 0,
					};
				purchaseAvgByProductSupplier.set(key, {
					costCents: existing.costCents + lineCost,
					units: existing.units + units,
				});
			}
		}
		for (const [key, agg] of purchaseAvgByProductSupplier) {
			if (agg.units <= 0) continue;
			const [productId, supplierId] =
				key.split("::");
			if (!knownOptionsByProduct.has(productId)) {
				knownOptionsByProduct.set(productId, []);
			}
			knownOptionsByProduct.get(productId)?.push({
				supplierId,
				unitCostCents: Math.round(
					agg.costCents / agg.units,
				),
				source: "PURCHASE_HISTORY",
			});
		}
		for (const contract of supplierPrices) {
			if (!knownOptionsByProduct.has(contract.productId)) {
				knownOptionsByProduct.set(
					contract.productId,
					[],
				);
			}
			knownOptionsByProduct
				.get(contract.productId)
				?.push({
					supplierId: contract.supplierId,
					unitCostCents: contract.unitCostCents,
					source: "PRICE_LIST",
				});
		}

		const recommendations = (
			report?.stockRecommendations ?? []
		).filter(
			(item) => item.recommendedOrderUnits > 0,
		);

		const rows: RestockPlanRow[] = [];
		for (const rec of recommendations) {
			const options =
				knownOptionsByProduct.get(rec.productId) ?? [];
			options.sort(
				(a, b) => a.unitCostCents - b.unitCostCents,
			);
			const best = options[0];

			const lastObserved = lastObservedByProduct.get(
				rec.productId,
			);
			const potentialSavingsCents =
				best && lastObserved
					? Math.max(
						0,
						(lastObserved.unitCostCents -
							best.unitCostCents) *
							rec.recommendedOrderUnits,
					)
					: 0;

			rows.push({
				productId: rec.productId,
				productName:
					productNameById.get(rec.productId) ??
					rec.productName,
				recommendedUnits: rec.recommendedOrderUnits,
				lastSupplierName: lastObserved
					? supplierNameById.get(
							lastObserved.supplierId,
						) ?? "Unknown Supplier"
					: "N/A",
				lastUnitCostCents:
					lastObserved?.unitCostCents ?? null,
				bestSupplierName: best
					? supplierNameById.get(best.supplierId) ??
						"Unknown Supplier"
					: "No known cost",
				bestUnitCostCents:
					best?.unitCostCents ?? null,
				bestCostSource: best?.source ?? "NONE",
				potentialSavingsCents,
			});
		}
		return rows;
	}, [
		productNameById,
		purchases,
		report,
		supplierNameById,
		supplierPrices,
	]);

	const totalPotentialSavings = planRows.reduce(
		(sum, row) => sum + row.potentialSavingsCents,
		0,
	);
	const totalSuppliers = supplierSummary.length;
	const totalKnownCosts = supplierSummary.reduce(
		(sum, supplier) => sum + supplier.knownCosts,
		0,
	);
	const totalRestockItems = planRows.length;
	const runSupplierCostBackfill = async () => {
		setBackfillLoading(true);
		try {
			const res = await fetch(
				"/api/supplier-prices/backfill",
				{
					method: "POST",
				},
			);
			const json = await res
				.json()
				.catch(() => ({}));
			if (!res.ok) {
				throw new Error(
					json?.error?.message ??
						json?.error ??
						"Backfill failed",
				);
			}
			toast.success(
				`Backfill complete. Purchases scanned: ${json?.data?.processedPurchases ?? 0}`,
			);
			await mutateSupplierPrices();
		} catch (e) {
			toast.error(
				e instanceof Error
					? e.message
					: "Backfill failed",
			);
		} finally {
			setBackfillLoading(false);
		}
	};

	return (
		<PageWrapper
			title="Suppliers"
			description={
				"View suppliers, known supplier costs, and restock savings. Use Global Quick Actions to add suppliers and set supplier costs."
			}
			actions={
				<DatePickerYMD
					value={date}
					onChange={onDateChange}
				/>
			}
		>
			<div className="mb-4 grid gap-3 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-4">
						<p className="text-xs text-muted-foreground">
							Suppliers
						</p>
						<p className="text-2xl font-semibold">
							{totalSuppliers}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<p className="text-xs text-muted-foreground">
							Known Costs
						</p>
						<p className="text-2xl font-semibold">
							{totalKnownCosts}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<p className="text-xs text-muted-foreground">
							Restock Items
						</p>
						<p className="text-2xl font-semibold">
							{totalRestockItems}
						</p>
					</CardContent>
				</Card>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={onTabChange}
				className="space-y-4"
			>
				<TabsList className="flex w-full items-center gap-1 overflow-x-auto">
					<TabsTrigger value="directory" className="shrink-0">
						Directory
					</TabsTrigger>
					<TabsTrigger value="contracts" className="shrink-0">
						Costs
					</TabsTrigger>
					<TabsTrigger value="restock" className="shrink-0">
						Restock Plan
					</TabsTrigger>
				</TabsList>

				<TabsContent value="directory">
					<Card>
						<CardHeader>
							<CardTitle>Supplier Directory</CardTitle>
						</CardHeader>
						<CardContent>
							{suppliersLoading ? (
								<LoadingTable />
							) : suppliersError ? (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>Error</AlertTitle>
									<AlertDescription>
										{suppliersError.message}
									</AlertDescription>
								</Alert>
							) : !supplierSummary.length ? (
								<EmptyState
									title="No suppliers yet"
									description="Use Global Quick Actions to add your first supplier."
								/>
							) : (
								<>
									<div className="space-y-3 md:hidden">
										{supplierSummary.map((supplier) => (
											<div
												key={supplier.id}
												className="rounded-lg border p-3"
											>
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0">
														<p className="font-medium truncate">
															{supplier.name}
														</p>
														<p className="text-xs text-muted-foreground">
															{supplier.phone || "No phone"}
														</p>
													</div>
													<p className="text-xs text-muted-foreground">
														Last: {supplier.lastPurchase}
													</p>
												</div>
												<div className="mt-3 grid grid-cols-2 gap-2 text-sm">
													<div>
														<p className="text-muted-foreground">
															Purchases (90d)
														</p>
														<p>{supplier.purchaseCount}</p>
													</div>
													<div className="text-right">
														<p className="text-muted-foreground">
															Known Costs
														</p>
														<p>{supplier.knownCosts}</p>
													</div>
												</div>
											</div>
										))}
									</div>

									<div className="hidden md:block">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Supplier</TableHead>
													<TableHead>Phone</TableHead>
													<TableHead className="text-right">
														Purchases (90d)
													</TableHead>
													<TableHead className="text-right">
														Known Costs
													</TableHead>
													<TableHead className="text-right">
														Last Purchase
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{supplierSummary.map((supplier) => (
													<TableRow key={supplier.id}>
														<TableCell className="font-medium">
															{supplier.name}
														</TableCell>
														<TableCell>
															{supplier.phone || "-"}
														</TableCell>
														<TableCell className="text-right">
															{supplier.purchaseCount}
														</TableCell>
														<TableCell className="text-right">
															{supplier.knownCosts}
														</TableCell>
														<TableCell className="text-right">
															{supplier.lastPurchase}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="contracts">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between gap-2">
								<CardTitle>
									Supplier Costs
								</CardTitle>
								{isAdmin && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={
											runSupplierCostBackfill
										}
										disabled={backfillLoading}
									>
										{backfillLoading
											? "Backfilling..."
											: "Backfill from Purchases"}
									</Button>
								)}
							</div>
						</CardHeader>
						<CardContent>
							{contractRows.length === 0 ? (
								<EmptyState
									title="No supplier price list yet"
									description="Use Global Quick Actions to set optional supplier prices per product."
								/>
							) : (
								<>
									<div className="space-y-3 md:hidden">
										{contractRows.map((row) => (
											<div
												key={row.id}
												className="rounded-lg border p-3"
											>
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0">
														<p className="font-medium truncate">
															{row.productName}
														</p>
														<p className="text-xs text-muted-foreground">
															{row.supplierName}
														</p>
													</div>
													<p className="font-semibold">
														{formatZAR(row.unitCostCents)}
													</p>
												</div>
												<div className="mt-3 grid grid-cols-2 gap-2 text-sm">
													<div>
														<p className="text-muted-foreground">
															MOQ
														</p>
														<p>{row.moqUnits ?? "-"}</p>
													</div>
													<div className="text-right">
														<p className="text-muted-foreground">
															Lead Time
														</p>
														<p>
															{row.leadTimeDays === undefined
																? "-"
																: `${row.leadTimeDays} days`}
														</p>
													</div>
												</div>
											</div>
										))}
									</div>

									<div className="hidden md:block">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Product</TableHead>
													<TableHead>Supplier</TableHead>
													<TableHead className="text-right">
														Unit Cost
													</TableHead>
													<TableHead className="text-right">
														MOQ Units
													</TableHead>
													<TableHead className="text-right">
														Lead Time
													</TableHead>
													<TableHead className="text-right">
														Effective From
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{contractRows.map((row) => (
													<TableRow key={row.id}>
														<TableCell className="font-medium">
															{row.productName}
														</TableCell>
														<TableCell>
															{row.supplierName}
														</TableCell>
														<TableCell className="text-right">
															{formatZAR(row.unitCostCents)}
														</TableCell>
														<TableCell className="text-right">
															{row.moqUnits ?? "-"}
														</TableCell>
														<TableCell className="text-right">
															{row.leadTimeDays === undefined
																? "-"
																: `${row.leadTimeDays} days`}
														</TableCell>
														<TableCell className="text-right">
															{row.effectiveFrom}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="restock">
					<Card>
						<CardHeader>
							<CardTitle>
								Restock Cost Plan ({date})
							</CardTitle>
						</CardHeader>
						<CardContent>
							{planRows.length === 0 ? (
								<EmptyState
									title="No restock opportunities"
									description="No products are currently recommended for restock."
								/>
							) : (
								<>
									<div className="mb-3 rounded-lg border bg-muted/40 p-3 text-sm">
										Estimated savings using best known supplier costs:{" "}
										<strong>
											{formatZAR(totalPotentialSavings)}
										</strong>
									</div>

									<div className="space-y-3 md:hidden">
										{planRows.map((row) => (
											<div
												key={row.productId}
												className="rounded-lg border p-3"
											>
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0">
														<p className="font-medium truncate">
															{row.productName}
														</p>
														<p className="text-xs text-muted-foreground">
															{row.recommendedUnits} units
														</p>
													</div>
													<p className="font-semibold">
														{formatZAR(row.potentialSavingsCents)}
													</p>
												</div>
												<div className="mt-3 grid grid-cols-2 gap-2 text-sm">
													<div>
														<p className="text-muted-foreground">
															Last
														</p>
														<p>{row.lastSupplierName}</p>
														<p className="text-xs text-muted-foreground">
															{formatOptionalMoney(
																row.lastUnitCostCents,
															)}
														</p>
													</div>
													<div className="text-right">
														<p className="text-muted-foreground">
															Best Cost
														</p>
														<p>{row.bestSupplierName}</p>
														<p className="text-xs text-muted-foreground">
															{row.bestCostSource ===
															"PRICE_LIST"
																? "Price list"
																: row.bestCostSource ===
																		"PURCHASE_HISTORY"
																	? "Purchase history"
																	: "-"}
														</p>
														<p className="text-xs text-muted-foreground">
															{formatOptionalMoney(
																row.bestUnitCostCents,
															)}
														</p>
													</div>
												</div>
											</div>
										))}
									</div>

									<div className="hidden md:block">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Product</TableHead>
													<TableHead className="text-right">
														Units
													</TableHead>
													<TableHead>Last Supplier</TableHead>
													<TableHead className="text-right">
														Last Cost
													</TableHead>
													<TableHead>Best Supplier</TableHead>
													<TableHead className="text-right">
														Best Cost
													</TableHead>
													<TableHead className="text-right">
														Potential Savings
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{planRows.map((row) => (
													<TableRow key={row.productId}>
														<TableCell className="font-medium">
															{row.productName}
														</TableCell>
														<TableCell className="text-right">
															{row.recommendedUnits}
														</TableCell>
														<TableCell>
															{row.lastSupplierName}
														</TableCell>
														<TableCell className="text-right">
															{formatOptionalMoney(
																row.lastUnitCostCents,
															)}
														</TableCell>
														<TableCell>
															{row.bestSupplierName}
														</TableCell>
														<TableCell className="text-right">
															{formatOptionalMoney(
																row.bestUnitCostCents,
															)}
														</TableCell>
														<TableCell className="text-right font-medium">
															{formatZAR(
																row.potentialSavingsCents,
															)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</PageWrapper>
	);
}
