"use client";
/* eslint-disable max-len */

import * as React from "react";
import useSWR from "swr";
import { AlertCircle } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DateRangeControls } from "@/components/date-range-controls";
import { LoadingTable } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	usePathname,
	useSearchParams,
} from "next/navigation";
import { formatZAR } from "@/lib/money";
import type {
	DailyReport,
	Product,
	Purchase,
	Supplier,
	SupplierPrice,
} from "@/lib/types";
import { useGlobalDateRangeQuery } from "@/lib/use-global-date-range-query";

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

const formatOptionalMoney = (
	cents: number | null,
) => (cents === null ? "-" : formatZAR(cents));

const isValidDateParam = (
	value: string | null,
): value is string =>
	Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

interface PlanRow {
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

interface SupplierRollupRow {
	supplierName: string;
	items: number;
	estimatedOrderCostCents: number;
}

export function PurchaseAssistantClient() {
	const {
		from,
		to: date,
		preset,
		onPresetChange,
		onFromChange,
		onToChange,
		onRangeChange,
	} = useGlobalDateRangeQuery();

	const {
		data: suppliers = [],
		error,
		isLoading,
	} = useSWR<Supplier[]>(
		"/api/suppliers",
		fetcher,
	);
	const { data: products = [] } = useSWR<Product[]>(
		"/api/products",
		fetcher,
	);
	const { data: report } = useSWR<DailyReport>(
		`/api/reports/daily?from=${from}&to=${date}`,
		fetcher,
	);
	const { data: purchases = [] } = useSWR<Purchase[]>(
		`/api/purchases?from=${from}&to=${date}&fields=lite`,
		fetcher,
	);
	const { data: supplierPrices = [] } = useSWR<
		SupplierPrice[]
	>(
		`/api/supplier-prices?asOf=${date}&fields=lite`,
		fetcher,
	);

	const productNameById = React.useMemo(
		() =>
			new Map(products.map((p) => [p.id, p.name])),
		[products],
	);
	const supplierNameById = React.useMemo(
		() =>
			new Map(suppliers.map((s) => [s.id, s.name])),
		[suppliers],
	);

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
		for (const supplierPrice of supplierPrices) {
			if (!knownOptionsByProduct.has(supplierPrice.productId)) {
				knownOptionsByProduct.set(
					supplierPrice.productId,
					[],
				);
			}
			knownOptionsByProduct
				.get(supplierPrice.productId)
				?.push({
					supplierId: supplierPrice.supplierId,
					unitCostCents: supplierPrice.unitCostCents,
					source: "PRICE_LIST",
				});
		}

		const recommendations = (
			report?.stockRecommendations ?? []
		).filter(
			(item) => item.recommendedOrderUnits > 0,
		);

		const rows: PlanRow[] = [];
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

	const supplierRollup = React.useMemo(() => {
		const bySupplier = new Map<
			string,
			{ items: number; cost: number }
		>();
		for (const row of planRows) {
			if (
				row.bestSupplierName === "No known cost" ||
				row.bestUnitCostCents === null
			) {
				continue;
			}
			const key = row.bestSupplierName;
			const existing = bySupplier.get(key) ?? {
				items: 0,
				cost: 0,
			};
			bySupplier.set(key, {
				items: existing.items + 1,
				cost:
					existing.cost +
					row.bestUnitCostCents *
						row.recommendedUnits,
			});
		}
		return Array.from(bySupplier.entries())
			.map(([supplierName, data]) => ({
				supplierName,
				items: data.items,
				estimatedOrderCostCents: data.cost,
			}))
			.sort(
				(a, b) =>
					b.estimatedOrderCostCents -
					a.estimatedOrderCostCents,
			);
	}, [planRows]);

	const totalPotentialSavings = planRows.reduce(
		(sum, row) => sum + row.potentialSavingsCents,
		0,
	);

	return (
		<PageWrapper
			title="Purchase Assistant"
			description="Supplier-focused restock assistant. Use best known supplier costs and recent purchasing patterns to reduce restock spend."
			actions={
				<DateRangeControls
					from={from}
					to={date}
					preset={preset}
					onPresetChange={onPresetChange}
					onFromChange={onFromChange}
					onToChange={onToChange}
					onRangeChange={onRangeChange}
				/>
			}
		>
			{error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{error.message}
					</AlertDescription>
				</Alert>
			) : isLoading ? (
				<LoadingTable />
			) : (
				<div className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-3">
						<Card>
							<CardContent className="pt-4">
								<p className="text-xs text-muted-foreground">
									Recommended Items
								</p>
								<p className="text-2xl font-semibold">
									{planRows.length}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-4">
								<p className="text-xs text-muted-foreground">
									Supplier Groups
								</p>
								<p className="text-2xl font-semibold">
									{supplierRollup.length}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-4">
								<p className="text-xs text-muted-foreground">
									Potential Savings
								</p>
								<p className="text-2xl font-semibold">
									{formatZAR(totalPotentialSavings)}
								</p>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>
								Suggested Supplier Orders
							</CardTitle>
						</CardHeader>
						<CardContent>
							{supplierRollup.length === 0 ? (
								<EmptyState
									title="No supplier order groups yet"
									description="No cost-backed restock recommendations are available for this date."
								/>
							) : (
								<>
									<div className="space-y-3 md:hidden">
										{supplierRollup.map((row) => (
											<div
												key={row.supplierName}
												className="rounded-lg border p-3"
											>
												<p className="font-medium">
													{row.supplierName}
												</p>
												<p className="text-xs text-muted-foreground">
													{row.items} recommended items
												</p>
												<p className="mt-1 text-sm">
													Estimated cost:{" "}
													{formatZAR(
														row.estimatedOrderCostCents,
													)}
												</p>
											</div>
										))}
									</div>
									<div className="hidden md:block">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Supplier</TableHead>
													<TableHead className="text-right">
														Items
													</TableHead>
													<TableHead className="text-right">
														Estimated Order Cost
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{supplierRollup.map((row) => (
													<TableRow key={row.supplierName}>
														<TableCell className="font-medium">
															{row.supplierName}
														</TableCell>
														<TableCell className="text-right">
															{row.items}
														</TableCell>
														<TableCell className="text-right">
															{formatZAR(
																row.estimatedOrderCostCents,
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

					<Card>
						<CardHeader>
							<CardTitle>
								Item-Level Cost Opportunities
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
															Best
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
														Savings
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
				</div>
			)}
		</PageWrapper>
	);
}
