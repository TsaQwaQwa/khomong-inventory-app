"use client"; 

import * as React from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
	CheckCircle2,
	CircleDashed,
	PackageCheck,
	Save,
	Search,
	TriangleAlert,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { EmptyState } from "@/components/empty-state";
import { LoadingCards, LoadingTable } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

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
	return (json?.data ?? json) as StockCountResponse;
};

const normalizeNumberInput = (value: string) => {
	if (value.trim() === "") return "";
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue) || numberValue < 0) return "";
	return String(Math.floor(numberValue));
};

const optionalText = (value: string) => {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

export function StockCountsClient() {
	const params = useSearchParams();
	const date = params.get("date") ?? getTodayJHB();
	const [query, setQuery] = React.useState("");
	const [categoryFilter, setCategoryFilter] = React.useState("all");
	const [dirtyCounts, setDirtyCounts] = React.useState<Record<string, string>>({});
	const [notes, setNotes] = React.useState<Record<string, string>>({});
	const [saving, setSaving] = React.useState(false);

	const { data, error, isLoading, mutate } = useSWR<StockCountResponse>(
		`/api/stock-counts?date=${date}`,
		fetcher,
		{
			onError: (err) => toast.error(err.message),
			revalidateOnFocus: false,
		},
	);

	React.useEffect(() => {
		if (!data) return;
		const nextCounts: Record<string, string> = {};
		const nextNotes: Record<string, string> = {};
		for (const product of data.products) {
			if (!product.count) continue;
			nextCounts[product.id] = String(product.count.countedUnits);
			nextNotes[product.id] = product.count.note ?? "";
		}
		setDirtyCounts(nextCounts);
		setNotes(nextNotes);
	}, [data]);

	const categories = React.useMemo(() => {
		if (!data) return [];
		return Array.from(
			new Set(data.products.map((product) => product.category || "Other")),
		).sort((a, b) => a.localeCompare(b));
	}, [data]);

	const filteredProducts = React.useMemo(() => {
		if (!data) return [];
		const normalized = query.trim().toLowerCase();
		return data.products.filter((product) => {
			if (categoryFilter !== "all" && product.category !== categoryFilter) {
				return false;
			}
			if (!normalized) return true;
			return [product.name, product.category, product.barcode ?? ""]
				.join(" ")
				.toLowerCase()
				.includes(normalized);
		});
	}, [categoryFilter, data, query]);

	const capturedCount = React.useMemo(
		() => Object.values(dirtyCounts).filter((value) => value !== "").length,
		[dirtyCounts],
	);
	const uncapturedCount = Math.max((data?.totalProducts ?? 0) - capturedCount, 0);
	const progress = data?.totalProducts
		? Math.round((capturedCount / data.totalProducts) * 100)
		: 0;
	const sessionId = `morning-${date}`;
	const isCompleted = data?.status === "COMPLETED";

	const setCountForProduct = React.useCallback((productId: string, value: string) => {
		setDirtyCounts((prev) => ({
			...prev,
			[productId]: normalizeNumberInput(value),
		}));
	}, []);

	const setNoteForProduct = React.useCallback((productId: string, value: string) => {
		setNotes((prev) => ({
			...prev,
			[productId]: value,
		}));
	}, []);

	const save = async (status: "IN_PROGRESS" | "COMPLETED") => {
		const counts = Object.entries(dirtyCounts)
			.filter(([, value]) => value !== "")
			.map(([productId, value]) => ({
				productId,
				countedUnits: Number(value),
				note: optionalText(notes[productId] ?? ""),
			}));

		if (counts.length === 0) {
			toast.error("Capture at least one product count.");
			return;
		}

		if (status === "COMPLETED" && data && counts.length < data.totalProducts) {
			toast.error("Capture every active product before finalizing the count.");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch("/api/stock-counts", {
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
			});

			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(
					payload?.error?.message ?? payload?.error ?? "Save failed",
				);
			}

			toast.success(
				status === "COMPLETED"
					? "Morning count completed"
					: "Morning count saved",
			);
			await mutate();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Save failed");
		} finally {
			setSaving(false);
		}
	};

	return (
		<PageWrapper
			title="Morning Count"
			description={`Count opening stock for ${formatDateDisplay(date)} before trading starts.`}
			actions={
				<div className="flex flex-col gap-2 sm:flex-row">
					<Button
						type="button"
						variant="outline"
						disabled={saving || isLoading || !data}
						onClick={() => save("IN_PROGRESS")}
						className="gap-2"
					>
						<Save className="h-4 w-4" />
						Save Draft
					</Button>
					<Button
						type="button"
						disabled={saving || !data || capturedCount < data.totalProducts}
						onClick={() => save("COMPLETED")}
						className="gap-2"
					>
						<PackageCheck className="h-4 w-4" />
						Finalize Count
					</Button>
				</div>
			}
		>
			{isLoading ? (
				<div className="space-y-4">
					<LoadingCards />
					<LoadingTable />
				</div>
			) : error ? (
				<EmptyState title="Could not load stock count" description={error.message} />
			) : !data || data.products.length === 0 ? (
				<EmptyState
					title="No products found"
					description="Add products before starting a morning count."
				/>
			) : (
				<div className="space-y-4">
					<div className="grid gap-4 md:grid-cols-4">
						<StatusCard
							title="Count Status"
							value={data.status.replaceAll("_", " ")}
							detail={isCompleted ? "Finalized and ready for reporting." : "Keep saving as staff count stock."}
							state={isCompleted ? "ok" : "default"}
						/>
						<StatusCard
							title="Products Counted"
							value={`${capturedCount}/${data.totalProducts}`}
							detail={`${progress}% complete`}
							state={uncapturedCount === 0 ? "ok" : "warn"}
						/>
						<StatusCard
							title="Missing"
							value={uncapturedCount.toLocaleString()}
							detail="Products still needing a count."
							state={uncapturedCount > 0 ? "warn" : "ok"}
						/>
						<StatusCard
							title="Visible"
							value={filteredProducts.length.toLocaleString()}
							detail="Products after current filters."
						/>
					</div>

					<Card className="border-primary/20 bg-primary/5 shadow-md">
						<CardContent className="space-y-3 pt-4">
							<Progress value={progress} />
							<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
								<p>
									{capturedCount} of {data.totalProducts} products captured.
								</p>
								{uncapturedCount > 0 ? (
									<p className="flex items-center gap-1 text-amber-700">
										<TriangleAlert className="h-4 w-4" />
										{uncapturedCount} product(s) still need a count.
									</p>
								) : (
									<p className="flex items-center gap-1 text-emerald-700">
										<CheckCircle2 className="h-4 w-4" />
										Ready to finalize.
									</p>
								)}
							</div>
						</CardContent>
					</Card>

					<Card className="shadow-md">
						<CardContent className="grid gap-3 pt-6 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
							<div className="space-y-2">
								<Label htmlFor="stock-count-search">Search</Label>
								<div className="relative">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										id="stock-count-search"
										className="pl-9"
										placeholder="Search product, category, or barcode"
										value={query}
										onChange={(event) => setQuery(event.target.value)}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="stock-count-category">Category</Label>
								<Select value={categoryFilter} onValueChange={setCategoryFilter}>
									<SelectTrigger id="stock-count-category">
										<SelectValue placeholder="All categories" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All categories</SelectItem>
										{categories.map((category) => (
											<SelectItem key={category} value={category}>
												{category}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<Button
								type="button"
								variant="outline"
								disabled={!query && categoryFilter === "all"}
								onClick={() => {
									setQuery("");
									setCategoryFilter("all");
								}}
							>
								Clear Filters
							</Button>
						</CardContent>
					</Card>

					{filteredProducts.length === 0 ? (
						<EmptyState
							title="No matching products"
							description="Clear your search or category filter to continue counting."
						/>
					) : (
						<CountList
							products={filteredProducts}
							dirtyCounts={dirtyCounts}
							notes={notes}
							onCountChange={setCountForProduct}
							onNoteChange={setNoteForProduct}
						/>
					)}
				</div>
			)}
		</PageWrapper>
	);
}

function StatusCard({
	title,
	value,
	detail,
	state = "default",
}: {
	title: string;
	value: string;
	detail: string;
	state?: "default" | "ok" | "warn";
}) {
	return (
		<Card className="h-full shadow-md">
			<CardContent className="flex items-start gap-3 pt-4">
				{state === "ok" ? (
					<CheckCircle2 className="mt-1 h-5 w-5 text-emerald-500" />
				) : state === "warn" ? (
					<TriangleAlert className="mt-1 h-5 w-5 text-amber-500" />
				) : (
					<CircleDashed className="mt-1 h-5 w-5 text-muted-foreground" />
				)}
				<div>
					<p className="text-xs text-muted-foreground">{title}</p>
					<p className="mt-1 text-xl font-semibold">{value}</p>
					<p className="mt-1 text-xs text-muted-foreground">{detail}</p>
				</div>
			</CardContent>
		</Card>
	);
}

function CountList({
	products,
	dirtyCounts,
	notes,
	onCountChange,
	onNoteChange,
}: {
	products: StockCountProduct[];
	dirtyCounts: Record<string, string>;
	notes: Record<string, string>;
	onCountChange: (productId: string, value: string) => void;
	onNoteChange: (productId: string, value: string) => void;
}) {
	return (
		<Card className="shadow-lg">
			<CardHeader className="pb-3">
				<CardTitle>Product counts</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<div className="space-y-3 p-3 md:hidden">
					{products.map((product) => (
						<StockCountCard
							key={product.id}
							product={product}
							countValue={dirtyCounts[product.id] ?? ""}
							noteValue={notes[product.id] ?? ""}
							onCountChange={onCountChange}
							onNoteChange={onNoteChange}
						/>
					))}
				</div>
				<div className="hidden md:block">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Product</TableHead>
								<TableHead>Category</TableHead>
								<TableHead className="text-right">Pack</TableHead>
								<TableHead className="w-44 text-right">Counted units</TableHead>
								<TableHead>Note</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{products.map((product) => (
								<StockCountTableRow
									key={product.id}
									product={product}
									countValue={dirtyCounts[product.id] ?? ""}
									noteValue={notes[product.id] ?? ""}
									onCountChange={onCountChange}
									onNoteChange={onNoteChange}
								/>
							))}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

const StockCountTableRow = React.memo(function StockCountTableRow({
	product,
	countValue,
	noteValue,
	onCountChange,
	onNoteChange,
}: {
	product: StockCountProduct;
	countValue: string;
	noteValue: string;
	onCountChange: (productId: string, value: string) => void;
	onNoteChange: (productId: string, value: string) => void;
}) {
	const captured = countValue !== "";
	return (
		<TableRow className={cn(captured && "bg-emerald-50/40")}>
			<TableCell>
				<div className="min-w-0">
					<p className="font-medium">{product.name}</p>
					{product.barcode ? (
						<p className="text-xs text-muted-foreground">Barcode: {product.barcode}</p>
					) : null}
				</div>
			</TableCell>
			<TableCell>{product.category}</TableCell>
			<TableCell className="text-right">{product.packSize}</TableCell>
			<TableCell>
				<CountInput
					productId={product.id}
					value={countValue}
					onChange={onCountChange}
					className="ml-auto max-w-36 text-right text-lg font-semibold"
				/>
			</TableCell>
			<TableCell>
				<Input
					value={noteValue}
					onChange={(event) => onNoteChange(product.id, event.target.value)}
					placeholder="Optional"
					className="min-w-44"
				/>
			</TableCell>
			<TableCell>
				<CountStatus captured={captured} previousStatus={product.count?.status} />
			</TableCell>
		</TableRow>
	);
});

const StockCountCard = React.memo(function StockCountCard({
	product,
	countValue,
	noteValue,
	onCountChange,
	onNoteChange,
}: {
	product: StockCountProduct;
	countValue: string;
	noteValue: string;
	onCountChange: (productId: string, value: string) => void;
	onNoteChange: (productId: string, value: string) => void;
}) {
	const captured = countValue !== "";
	return (
		<div className={cn("rounded-lg border bg-background p-3 shadow-sm", captured && "border-emerald-200 bg-emerald-50/40")}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate font-medium">{product.name}</p>
					<p className="text-xs text-muted-foreground">
						{product.category} | Pack {product.packSize}
					</p>
					{product.barcode ? (
						<p className="text-xs text-muted-foreground">Barcode: {product.barcode}</p>
					) : null}
				</div>
				<CountStatus captured={captured} previousStatus={product.count?.status} />
			</div>
			<div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
				<div className="space-y-2">
					<Label htmlFor={`count-${product.id}`}>Counted units</Label>
					<CountInput
						productId={product.id}
						value={countValue}
						onChange={onCountChange}
						className="h-12 text-right text-lg font-semibold"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`note-${product.id}`}>Note</Label>
					<Input
						id={`note-${product.id}`}
						value={noteValue}
						onChange={(event) => onNoteChange(product.id, event.target.value)}
						placeholder="Optional"
						className="h-12"
					/>
				</div>
			</div>
		</div>
	);
});

function CountInput({
	productId,
	value,
	onChange,
	className,
}: {
	productId: string;
	value: string;
	onChange: (productId: string, value: string) => void;
	className?: string;
}) {
	return (
		<Input
			id={`count-${productId}`}
			type="number"
			min={0}
			inputMode="numeric"
			value={value}
			onChange={(event) => onChange(productId, event.target.value)}
			className={className}
		/>
	);
}

function CountStatus({
	captured,
	previousStatus,
}: {
	captured: boolean;
	previousStatus?: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
}) {
	return captured ? (
		<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
			<CheckCircle2 className="h-3 w-3" />
			Counted
		</span>
	) : previousStatus === "COMPLETED" ? (
		<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
			<CheckCircle2 className="h-3 w-3" />
			Saved
		</span>
	) : (
		<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
			<CircleDashed className="h-3 w-3" />
			Pending
		</span>
	);
}
