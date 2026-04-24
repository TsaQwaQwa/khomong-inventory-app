"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
	CheckCircle2,
	CircleDashed,
	Search,
	TriangleAlert,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { EmptyState } from "@/components/empty-state";
import { LoadingTable } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	formatDateDisplay,
	getTodayJHB,
} from "@/lib/date-utils";
import {
	useEffect,
	useMemo,
	useState,
} from "react";

interface StockCountProduct {
	id: string;
	name: string;
	category: string;
	barcode?: string | null;
	packSize: number;
	count: null | {
		id: string;
		countedUnits: number;
		note?: string;
		status: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
	};
}

interface StockCountResponse {
	date: string;
	status:
		| "NOT_STARTED"
		| "IN_PROGRESS"
		| "COMPLETED";
	totalProducts: number;
	capturedProducts: number;
	completedProducts: number;
	products: StockCountProduct[];
}

const fetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(
			json?.error?.message ??
				json?.error ??
				"Failed to load stock count",
		);
	}
	return (json?.data ??
		json) as StockCountResponse;
};

const normalizeNumberInput = (value: string) => {
	if (value.trim() === "") return "";
	const numberValue = Number(value);
	if (
		!Number.isFinite(numberValue) ||
		numberValue < 0
	)
		return "";
	return String(Math.floor(numberValue));
};

export function StockCountsClient() {
	const params = useSearchParams();
	const date =
		params.get("date") ?? getTodayJHB();
	const [query, setQuery] = useState("");
	const [dirtyCounts, setDirtyCounts] = useState<
		Record<string, string>
	>({});
	const [notes, setNotes] = useState<
		Record<string, string>
	>({});
	const [saving, setSaving] = useState(false);

	const { data, error, isLoading, mutate } =
		useSWR<StockCountResponse>(
			`/api/stock-counts?date=${date}`,
			fetcher,
			{
				onError: (err) =>
					toast.error(err.message),
			},
		);

	useEffect(() => {
		if (!data) return;
		const nextCounts: Record<string, string> = {};
		const nextNotes: Record<string, string> = {};
		for (const product of data.products) {
			if (product.count) {
				nextCounts[product.id] = String(
					product.count.countedUnits,
				);
				nextNotes[product.id] =
					product.count.note ?? "";
			}
		}
		setDirtyCounts(nextCounts);
		setNotes(nextNotes);
	}, [data]);

	const filteredProducts = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!data) return [];
		if (!normalized) return data.products;
		return data.products.filter((product) =>
			[
				product.name,
				product.category,
				product.barcode ?? "",
			]
				.join(" ")
				.toLowerCase()
				.includes(normalized),
		);
	}, [data, query]);

	const capturedCount = useMemo(
		() =>
			Object.values(dirtyCounts).filter(
				(value) => value !== "",
			).length,
		[dirtyCounts],
	);
	const uncapturedCount = Math.max(
		(data?.totalProducts ?? 0) - capturedCount,
		0,
	);
	const progress = data?.totalProducts
		? Math.round(
				(capturedCount / data.totalProducts) *
					100,
			)
		: 0;
	const sessionId = `morning-${date}`;

	const save = async (
		status: "IN_PROGRESS" | "COMPLETED",
	) => {
		const counts = Object.entries(dirtyCounts)
			.filter(([, value]) => value !== "")
			.map(([productId, value]) => ({
				productId,
				countedUnits: Number(value),
				note:
					notes[productId]?.trim() || undefined,
			}));

		if (counts.length === 0) {
			toast.error(
				"Capture at least one product count.",
			);
			return;
		}

		if (
			status === "COMPLETED" &&
			data &&
			counts.length < data.totalProducts
		) {
			toast.error(
				"Capture every active product before finalizing the count.",
			);
			return;
		}

		setSaving(true);
		try {
			const res = await fetch(
				"/api/stock-counts",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						date,
						status,
						sessionId,
						counts,
					}),
				},
			);
			if (!res.ok) {
				const payload = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					payload?.error?.message ??
						payload?.error ??
						"Save failed",
				);
			}
			toast.success(
				status === "COMPLETED"
					? "Morning count completed"
					: "Morning count saved",
			);
			await mutate();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Save failed",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<PageWrapper
			title="Morning Stock Count"
			description={`Count opening stock for ${formatDateDisplay(date)} before the day starts.`}
			actions={
				<div className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={saving}
						onClick={() => save("IN_PROGRESS")}
					>
						Save Draft
					</Button>
					<Button
						type="button"
						disabled={
							saving ||
							!data ||
							capturedCount < data.totalProducts
						}
						onClick={() => save("COMPLETED")}
					>
						Finalize Count
					</Button>
				</div>
			}
		>
			{isLoading ? (
				<LoadingTable />
			) : error ? (
				<EmptyState
					title="Could not load stock count"
					description={error.message}
				/>
			) : !data ? (
				<EmptyState
					title="No products found"
					description="Add products before starting a morning count."
				/>
			) : (
				<div className="space-y-4">
					<Card className="shadow-md">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								{data.status === "COMPLETED" ? (
									<CheckCircle2 className="h-5 w-5 text-emerald-500" />
								) : (
									<CircleDashed className="h-5 w-5 text-muted-foreground" />
								)}
								Day status:{" "}
								{data.status.replaceAll("_", " ")}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<Progress value={progress} />
							<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
								<p>
									{capturedCount} of{" "}
									{data.totalProducts} products
									captured.
								</p>
								{uncapturedCount > 0 && (
									<p className="flex items-center gap-1 text-amber-700">
										<TriangleAlert className="h-4 w-4" />
										{uncapturedCount} product(s)
										still need a count.
									</p>
								)}
							</div>
						</CardContent>
					</Card>

					<div className="relative">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							className="pl-9"
							placeholder="Search product, category, or barcode"
							value={query}
							onChange={(event) =>
								setQuery(event.target.value)
							}
						/>
					</div>

					<Card className="shadow-lg">
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Product</TableHead>
										<TableHead>
											Category
										</TableHead>
										<TableHead className="w-36 text-right">
											Counted units
										</TableHead>
										<TableHead>Note</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredProducts.map(
										(product) => (
											<TableRow key={product.id}>
												<TableCell className="font-medium">
													{product.name}
												</TableCell>
												<TableCell>
													{product.category}
												</TableCell>
												<TableCell>
													<Label
														className="sr-only"
														htmlFor={`count-${product.id}`}
													>
														Counted units
													</Label>
													<Input
														id={`count-${product.id}`}
														type="number"
														min={0}
														inputMode="numeric"
														className="text-right"
														value={
															dirtyCounts[
																product.id
															] ?? ""
														}
														onChange={(event) =>
															setDirtyCounts(
																(prev) => ({
																	...prev,
																	[product.id]:
																		normalizeNumberInput(
																			event.target
																				.value,
																		),
																}),
															)
														}
													/>
												</TableCell>
												<TableCell>
													<Textarea
														rows={1}
														placeholder="Optional note"
														value={
															notes[product.id] ??
															""
														}
														onChange={(event) =>
															setNotes(
																(prev) => ({
																	...prev,
																	[product.id]:
																		event.target
																			.value,
																}),
															)
														}
													/>
												</TableCell>
											</TableRow>
										),
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			)}
		</PageWrapper>
	);
}
