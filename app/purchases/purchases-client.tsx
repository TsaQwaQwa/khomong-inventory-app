"use client";
/* eslint-disable max-len */

import * as React from "react";
import { toast } from "sonner";
import {
	Plus,
	Trash2,
	AlertCircle,
	Edit,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DateRangeControls } from "@/components/date-range-controls";
import { LoadingTable } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { ProductSelect } from "@/components/product-select";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
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
import Image from "next/image";
import { formatZAR } from "@/lib/money";
import type {
	Product,
	Supplier,
	Purchase,
	PurchaseItem,
} from "@/lib/types";
import { jsonFetcher } from "@/lib/swr";
import { useGlobalDateRangeQuery } from "@/lib/use-global-date-range-query";
import { postPurchaseWithOfflineQueue } from "@/lib/offline-sales-queue";
import { useOfflineCachedArraySWR } from "@/lib/use-offline-cached-swr";

const fetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		const message =
			json?.error?.message ??
			json?.error ??
			"Failed to fetch data";
		throw new Error(message);
	}
	return json?.data ?? json;
};

export function PurchasesClient() {
	const {
		from,
		to: date,
		preset,
		onPresetChange,
		onFromChange,
		onToChange,
		onRangeChange,
	} = useGlobalDateRangeQuery();
	const [recordDialogOpen, setRecordDialogOpen] =
		React.useState(false);
	const [repeatPurchaseSeed, setRepeatPurchaseSeed] =
		React.useState<Purchase | null>(null);
	const [editingPurchase, setEditingPurchase] =
		React.useState<Purchase | null>(null);

	const {
		items: purchases,
		error: effectiveError,
		isLoading: effectiveLoading,
		mutate,
		usingCachedData: usingCachedPurchases,
	} = useOfflineCachedArraySWR<Purchase>({
		key: `/api/purchases?from=${from}&to=${date}`,
		cacheKey: `purchases:${from}:${date}`,
		fetcher,
		onError: (err) => toast.error(err.message),
	});
	const { items: products } = useOfflineCachedArraySWR<Product>({
		key: "/api/products",
		cacheKey: "products:list",
		fetcher,
	});
	const { items: suppliers } = useOfflineCachedArraySWR<Supplier>({
		key: "/api/suppliers",
		cacheKey: "suppliers:list",
		fetcher,
	});

	const normalizedProducts = React.useMemo(
		() => (Array.isArray(products) ? products : []),
		[products],
	);
	const latestPurchase = React.useMemo(
		() =>
			Array.isArray(purchases) && purchases.length > 0
				? purchases[0]
				: null,
		[purchases],
	);

	return (
		<PageWrapper
			title="Stock Purchases"
			description="Record stock received from suppliers."
			actions={
				<div className="flex flex-wrap items-start gap-2">
					<DateRangeControls
						from={from}
						to={date}
						preset={preset}
						onPresetChange={onPresetChange}
						onFromChange={onFromChange}
						onToChange={onToChange}
						onRangeChange={onRangeChange}
					/>
					<Button
						type="button"
						variant="outline"
						className="self-start"
						disabled={!latestPurchase}
						onClick={() => {
							if (!latestPurchase) return;
							setRepeatPurchaseSeed(
								latestPurchase,
							);
							setRecordDialogOpen(true);
						}}
					>
						Repeat Last Purchase
					</Button>
					<Dialog
						open={recordDialogOpen}
						onOpenChange={(open) => {
							setRecordDialogOpen(open);
							if (!open) {
								setRepeatPurchaseSeed(
									null,
								);
							}
						}}
					>
						<DialogTrigger asChild>
							<Button className="hidden">
								<Plus className="mr-2 h-4 w-4" />
								Add Purchase
							</Button>
						</DialogTrigger>
						<RecordPurchaseDialog
							key={
								repeatPurchaseSeed
									? `repeat-purchase-${repeatPurchaseSeed.id}`
									: "purchase-default"
							}
							products={normalizedProducts}
							suppliers={suppliers || []}
							date={date}
							initialData={
								repeatPurchaseSeed ??
								undefined
							}
							onSuccess={() => {
								setRecordDialogOpen(false);
								setRepeatPurchaseSeed(null);
								mutate();
							}}
						/>
					</Dialog>
				</div>
			}
		>
			{usingCachedPurchases && purchases.length > 0 && (
				<p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
					Offline mode: showing cached purchases from this device.
				</p>
			)}
			{effectiveLoading ? (
				<LoadingTable />
			) : effectiveError ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{effectiveError.message}
					</AlertDescription>
				</Alert>
			) : !purchases?.length ? (
				<EmptyState
					title="No purchases for this date"
					description="Record a purchase to track stock received."
				/>
			) : (
				<div className="space-y-4">
					{purchases.map((purchase) => (
						<PurchaseCard
							key={purchase.id}
							purchase={purchase}
							products={normalizedProducts}
							onEditPurchase={() =>
								setEditingPurchase(purchase)
							}
						/>
					))}
				</div>
			)}

			<Dialog
				open={Boolean(editingPurchase)}
				onOpenChange={(open) => {
					if (!open) setEditingPurchase(null);
				}}
			>
				{editingPurchase && (
					<EditPurchaseDialog
						purchase={editingPurchase}
						products={normalizedProducts}
						suppliers={suppliers || []}
						onSuccess={() => {
							setEditingPurchase(null);
							mutate();
						}}
					/>
				)}
			</Dialog>
		</PageWrapper>
	);
}

function PurchaseCard({
	purchase,
	products,
	onEditPurchase,
}: {
	purchase: Purchase;
	products: Product[];
	onEditPurchase?: () => void;
}) {
	const attachments =
		purchase.attachmentIds?.filter(Boolean) ?? [];
	const productMap = React.useMemo(
		() => new Map(products.map((p) => [p.id, p])),
		[products],
	);

	const totalUnits = purchase.items.reduce(
		(sum, item) => sum + item.units,
		0,
	);
	const subtotalCost = purchase.items.reduce(
		(sum, item) =>
			sum +
			(item.lineTotalCostCents ??
				(item.unitCostCents || 0) * item.units),
		0,
	);
	const totalCost =
		typeof purchase.totalCostCents === "number"
			? purchase.totalCostCents
			: subtotalCost;

	return (
		<Card className="shadow-md">
			<CardHeader>
				<CardTitle className="flex flex-wrap items-center justify-between gap-2">
					<span>
						{purchase.supplierName ||
							"Unknown Supplier"}
					</span>
					<div className="flex items-center gap-2">
						{purchase.invoiceNo && (
							<span className="text-sm font-normal text-muted-foreground">
								Invoice: {purchase.invoiceNo}
							</span>
						)}
						{onEditPurchase && (
							<Button
								variant="outline"
								size="sm"
								onClick={onEditPurchase}
							>
								<Edit className="mr-2 h-4 w-4" />
								Edit Purchase
							</Button>
						)}
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3 md:hidden">
					<div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
						<div>
							<p className="text-muted-foreground">
								Items
							</p>
							<p className="font-medium">
								{purchase.items.length}
							</p>
						</div>
						<div className="text-right">
							<p className="text-muted-foreground">
								Units
							</p>
							<p className="font-medium">
								{totalUnits}
							</p>
						</div>
						<div className="text-right">
							<p className="text-muted-foreground">
								Total
							</p>
							<p className="font-semibold">
								{formatZAR(totalCost)}
							</p>
						</div>
					</div>
					<div className="space-y-2">
						{purchase.items.slice(0, 3).map(
							(item, i) => {
								const product =
									productMap.get(
										item.productId,
									);
								return (
									<div
										key={i}
										className="flex items-start justify-between gap-2 rounded border p-2 text-sm"
									>
										<div className="min-w-0">
											<p className="font-medium truncate">
												{product?.name ??
													item.productId}
											</p>
											<p className="text-xs text-muted-foreground">
												{item.units} units
											</p>
										</div>
										<p className="font-medium">
											{item.unitCostCents
												? formatZAR(
														item.unitCostCents *
															item.units,
													)
												: "-"}
										</p>
									</div>
								);
							},
						)}
						{purchase.items.length > 3 && (
							<p className="text-xs text-muted-foreground">
								+{purchase.items.length - 3} more
								items
							</p>
						)}
					</div>
				</div>

				<div className="hidden md:block">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Product</TableHead>
								<TableHead className="text-right">
									Cases
								</TableHead>
								<TableHead className="text-right">
									Singles
								</TableHead>
								<TableHead className="text-right">
									Units
								</TableHead>
								<TableHead className="text-right">
									Unit Cost
								</TableHead>
								<TableHead className="text-right">
									Total
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{purchase.items.map((item, i) => {
								const product = productMap.get(
									item.productId,
								);
								return (
									<TableRow key={i}>
										<TableCell>
											{product?.name ||
												item.productId}
										</TableCell>
										<TableCell className="text-right">
											{item.cases}
										</TableCell>
										<TableCell className="text-right">
											{item.singles}
										</TableCell>
										<TableCell className="text-right">
											{item.units}
										</TableCell>
										<TableCell className="text-right">
											{item.unitCostCents
												? formatZAR(
														item.unitCostCents,
													)
												: "-"}
										</TableCell>
										<TableCell className="text-right">
											{item.unitCostCents
												? formatZAR(
														item.unitCostCents *
															item.units,
													)
												: "-"}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
					<div className="mt-4 flex justify-end gap-6 text-sm">
						<span>
							<strong>Total Units:</strong>{" "}
							{totalUnits}
						</span>
						<span>
							<strong>Total Cost:</strong>{" "}
							{formatZAR(totalCost)}
						</span>
					</div>
				</div>
			</CardContent>
			{attachments.length > 0 && (
				<div className="px-6 pb-6 pt-2">
					<div className="flex flex-col gap-2">
						<span className="text-sm font-semibold text-muted-foreground">
							Attachments
						</span>
						<div className="flex flex-wrap gap-2">
							{attachments.map((attachment) => (
								<a
									key={attachment}
									href={`/${attachment}`}
									target="_blank"
									rel="noreferrer"
									className="block overflow-hidden rounded border border-input bg-card transition hover:opacity-90"
								>
									<div className="relative h-24 w-32">
										<Image
											src={`/${attachment}`}
											alt="Invoice attachment"
											fill
											sizes="140px"
											className="object-cover"
											priority={false}
										/>
									</div>
								</a>
							))}
						</div>
					</div>
				</div>
			)}
		</Card>
	);
}

interface LineItem {
	productId: string;
	cases: string;
	singles: string;
	lineSubtotalCents: number;
}

function RecordPurchaseDialog({
	products,
	suppliers,
	date,
	initialData,
	onSuccess,
}: {
	products: Product[];
	suppliers: Supplier[];
	date: string;
	initialData?: Purchase;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [supplierId, setSupplierId] =
		React.useState(
			initialData?.supplierId ?? "",
		);
	const [invoiceNo, setInvoiceNo] =
		React.useState(
			initialData?.invoiceNo ?? "",
		);
	const [scanBarcode, setScanBarcode] =
		React.useState("");
	const [items, setItems] = React.useState<
		LineItem[]
	>(
		initialData?.items.length
			? initialData.items.map((item) => ({
					productId: item.productId,
					cases: String(item.cases ?? 0),
					singles: String(item.singles ?? 0),
					lineSubtotalCents:
						item.lineTotalCostCents ??
						(item.unitCostCents ?? 0) *
							item.units,
				}))
			: [
					{
						productId: "",
						cases: "",
						singles: "",
						lineSubtotalCents: 0,
					},
				],
	);
	const normalizedProducts = React.useMemo(
		() =>
			Array.isArray(products) ? products : [],
		[products],
	);

	const productMap = React.useMemo(
		() =>
			new Map(
				normalizedProducts.map((p) => [p.id, p]),
			),
		[normalizedProducts],
	);

	const productByBarcode = React.useMemo(() => {
		return new Map(
			normalizedProducts
				.filter(
					(product) =>
						Boolean(product.barcode),
				)
				.map((product) => [
					String(product.barcode)
						.trim()
						.toLowerCase(),
					product,
				]),
		);
	}, [normalizedProducts]);
	React.useEffect(() => {
		setSupplierId(initialData?.supplierId ?? "");
		setInvoiceNo(initialData?.invoiceNo ?? "");
		setItems(
			initialData?.items.length
				? initialData.items.map((item) => ({
						productId: item.productId,
						cases: String(item.cases ?? 0),
						singles: String(item.singles ?? 0),
						lineSubtotalCents:
							item.lineTotalCostCents ??
							(item.unitCostCents ?? 0) *
								item.units,
					}))
				: [
						{
							productId: "",
							cases: "",
							singles: "",
							lineSubtotalCents: 0,
						},
					],
		);
	}, [initialData]);

	const addItem = () => {
		setItems([
			...items,
			{
				productId: "",
				cases: "",
				singles: "",
				lineSubtotalCents: 0,
			},
		]);
	};

	const removeItem = (index: number) => {
		setItems(items.filter((_, i) => i !== index));
	};

	const updateItem = React.useCallback(
		(index: number, updates: Partial<LineItem>) => {
			setItems((prevItems) =>
				prevItems.map((item, i) =>
					i === index
						? { ...item, ...updates }
						: item,
				),
			);
		},
		[],
	);

	const calculateUnits = (
		item: LineItem,
	): number => {
		const product = productMap.get(
			item.productId,
		);
		const packSize = product?.packSize || 1;
		const cases = parseInt(item.cases) || 0;
		const singles = parseInt(item.singles) || 0;
		return cases * packSize + singles;
	};

	const addProductByBarcode = React.useCallback(
		(rawBarcode: string) => {
			const normalizedBarcode = rawBarcode
				.trim()
				.toLowerCase();

			if (!normalizedBarcode) return;

			const matchedProduct =
				productByBarcode.get(
					normalizedBarcode,
				);

			if (!matchedProduct) {
				toast.error(
					`No product found for barcode "${rawBarcode.trim()}"`,
				);
				return;
			}

			const existingIndex = items.findIndex(
				(item) =>
					item.productId === matchedProduct.id,
			);

			if (existingIndex >= 0) {
				const existingItem = items[existingIndex];
				const currentSingles =
					parseInt(existingItem.singles) || 0;
				updateItem(existingIndex, {
					singles: String(
						currentSingles + 1,
					),
				});
			} else {
				const emptyIndex = items.findIndex(
					(item) =>
						!item.productId &&
						!item.cases &&
						!item.singles,
				);

				if (emptyIndex >= 0) {
					updateItem(emptyIndex, {
						productId: matchedProduct.id,
						cases: "0",
						singles: "1",
					});
				} else {
					setItems([
						...items,
						{
							productId: matchedProduct.id,
							cases: "0",
							singles: "1",
							lineSubtotalCents: 0,
						},
					]);
				}
			}

			setScanBarcode("");
		},
		[items, productByBarcode, updateItem],
	);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		const validItems = items
			.filter(
				(item) =>
					item.productId &&
					(item.cases || item.singles) &&
					item.lineSubtotalCents > 0,
			)
			.map((item) => ({
				productId: item.productId,
				cases: parseInt(item.cases) || 0,
				singles: parseInt(item.singles) || 0,
				units: calculateUnits(item),
				lineSubtotalCents:
					item.lineSubtotalCents || undefined,
			}));

		if (validItems.length === 0) {
			toast.error("Please add at least one item");
			setLoading(false);
			return;
		}

		try {
			const payload = {
				supplierId: supplierId || undefined,
				invoiceNo: invoiceNo || undefined,
				purchaseDate: date,
				items: validItems,
			};
			const queueResult =
				await postPurchaseWithOfflineQueue(
					payload,
				);
			if (queueResult.queued) {
				toast.success(
					"Offline: purchase queued and will sync automatically.",
				);
				onSuccess();
				return;
			}
			const res = queueResult.response;

			if (!res.ok) {
				const error = await res
					.json()
					.catch(() => ({
						error: "Request failed",
					}));
				throw new Error(
					error.error ||
						"Failed to record purchase",
				);
			}

			toast.success(
				"Purchase recorded successfully",
			);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to record purchase",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
			<DialogHeader>
				<DialogTitle>
					{initialData
						? "Repeat Purchase"
						: "Add Purchase"}
				</DialogTitle>
				<DialogDescription>
					{initialData
						? `Loaded from your last purchase for ${date}.`
						: `Record a stock purchase for ${date}.`}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-4 py-4">
					{/* Supplier */}
					<div className="space-y-2">
						<Label>Supplier</Label>
						<Select
							value={supplierId}
							onValueChange={setSupplierId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select supplier (optional)" />
							</SelectTrigger>
							<SelectContent>
								{suppliers.map((s) => (
									<SelectItem
										key={s.id}
										value={s.id}
									>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Use Global Quick Actions to add new suppliers.
						</p>
					</div>

					{/* Invoice No */}
					<div className="space-y-2">
						<Label htmlFor="invoiceNo">
							Invoice Number (optional)
						</Label>
						<Input
							id="invoiceNo"
							value={invoiceNo}
							onChange={(e) =>
								setInvoiceNo(e.target.value)
							}
							placeholder="INV-12345"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="scanBarcode">
							Scan Barcode
						</Label>
						<div className="flex gap-2">
							<Input
								id="scanBarcode"
								value={scanBarcode}
								onChange={(e) =>
									setScanBarcode(
										e.target.value,
									)
								}
								onKeyDown={(e) => {
									if (e.key !== "Enter")
										return;
									e.preventDefault();
									addProductByBarcode(
										scanBarcode,
									);
								}}
								placeholder="Scan or type barcode, then press Enter"
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									addProductByBarcode(
										scanBarcode,
									)
								}
							>
								Add
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Each scan adds one single unit to the
							purchase items.
						</p>
					</div>

					{/* Line Items */}
					<div className="space-y-2">
						<Label>Items</Label>
						<div className="space-y-3">
							{items.map((item, index) => {
								const units =
									calculateUnits(item);
								const subtotalCents =
									item.lineSubtotalCents ?? 0;
								const estimatedUnitCost =
									units > 0
										? Math.round(
												subtotalCents / units,
										  )
										: 0;
								return (
									<div
										key={index}
										className="space-y-1 rounded-lg bg-muted/50 p-3"
									>
										<div className="grid grid-cols-12 gap-2 items-end">
											<div className="col-span-12 lg:col-span-4">
												<ProductSelect
													products={
														normalizedProducts
													}
													value={item.productId}
													onChange={(v) =>
														updateItem(index, {
															productId: v,
														})
													}
													placeholder="Select product"
												/>
											</div>
											<div className="col-span-4 lg:col-span-1 space-y-1">
												<Label className="text-xs">
													Cases
												</Label>
												<Input
													type="number"
													min="0"
													value={item.cases}
													onChange={(e) =>
														updateItem(index, {
															cases:
																e.target.value,
														})
													}
													placeholder="0"
												/>
											</div>
											<div className="col-span-4 lg:col-span-1 space-y-1">
												<Label className="text-xs">
													Singles
												</Label>
												<Input
													type="number"
													min="0"
													value={item.singles}
													onChange={(e) =>
														updateItem(index, {
															singles:
																e.target.value,
														})
													}
													placeholder="0"
												/>
											</div>
											<div className="col-span-4 lg:col-span-1 space-y-1">
												<Label className="text-xs">
													Units
												</Label>
												<Input
													type="number"
													value={units}
													disabled
													className="bg-muted"
												/>
											</div>
											<div className="col-span-6 lg:col-span-2 min-w-0 space-y-1">
												<Label className="text-xs">
													Total
												</Label>
												<MoneyInput
													value={
														item.lineSubtotalCents
													}
													onChange={(v) =>
														updateItem(index, {
															lineSubtotalCents: v,
														})
													}
													placeholder="0.00"
													className="space-y-0"
												/>
											</div>
											<div className="col-span-12 lg:col-span-1 flex justify-end">
												{items.length > 1 && (
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() =>
															removeItem(index)
														}
														className="shrink-0"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</div>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Subtotal {formatZAR(subtotalCents)}
										</p>
										<p className="text-[11px] text-muted-foreground">
											Estimated unit cost:{" "}
											{formatZAR(estimatedUnitCost)}
										</p>
									</div>
								);
							})}
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={addItem}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Item
						</Button>
					</div>
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</DialogClose>
					<Button
						type="submit"
						disabled={loading}
					>
						{loading
							? "Saving..."
							: "Save"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

function EditPurchaseDialog({
	purchase,
	products,
	suppliers,
	onSuccess,
}: {
	purchase: Purchase;
	products: Product[];
	suppliers: Supplier[];
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [supplierId, setSupplierId] =
		React.useState(purchase.supplierId ?? "");
	const [invoiceNo, setInvoiceNo] =
		React.useState(purchase.invoiceNo ?? "");
	const [purchaseDate, setPurchaseDate] =
		React.useState(purchase.purchaseDate);
	const [items, setItems] = React.useState<
		LineItem[]
	>(
		purchase.items.map((item) => ({
			productId: item.productId,
			cases: String(item.cases ?? 0),
			singles: String(item.singles ?? 0),
			lineSubtotalCents:
				item.lineTotalCostCents ??
				(item.unitCostCents ?? 0) * item.units,
		})),
	);
	const [attachmentFile, setAttachmentFile] =
		React.useState<File | null>(null);

	React.useEffect(() => {
		setSupplierId(purchase.supplierId ?? "");
		setInvoiceNo(purchase.invoiceNo ?? "");
		setPurchaseDate(purchase.purchaseDate);
		setItems(
			purchase.items.map((item) => ({
				productId: item.productId,
				cases: String(item.cases ?? 0),
				singles: String(item.singles ?? 0),
				lineSubtotalCents:
					item.lineTotalCostCents ??
					(item.unitCostCents ?? 0) * item.units,
			})),
		);
		setAttachmentFile(null);
	}, [purchase]);

	const normalizedProducts = React.useMemo(
		() =>
			Array.isArray(products) ? products : [],
		[products],
	);
	const productMap = React.useMemo(
		() =>
			new Map(
				normalizedProducts.map((p) => [p.id, p]),
			),
		[normalizedProducts],
	);

	const calculateUnits = (
		item: LineItem,
	): number => {
		const product = productMap.get(
			item.productId,
		);
		const packSize = product?.packSize || 1;
		const cases = parseInt(item.cases) || 0;
		const singles = parseInt(item.singles) || 0;
		return cases * packSize + singles;
	};

	const updateItem = React.useCallback(
		(index: number, updates: Partial<LineItem>) => {
			setItems((prevItems) =>
				prevItems.map((item, i) =>
					i === index
						? { ...item, ...updates }
						: item,
				),
			);
		},
		[],
	);

	const addItem = () => {
		setItems((prev) => [
			...prev,
			{
				productId: "",
				cases: "",
				singles: "",
				lineSubtotalCents: 0,
			},
		]);
	};

	const removeItem = (index: number) => {
		setItems((prev) =>
			prev.filter((_, i) => i !== index),
		);
	};

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		const validItems = items
			.filter(
				(item) =>
					item.productId &&
					(item.cases || item.singles) &&
					item.lineSubtotalCents > 0,
			)
			.map((item) => ({
				productId: item.productId,
				cases: parseInt(item.cases) || 0,
				singles: parseInt(item.singles) || 0,
				units: calculateUnits(item),
				lineSubtotalCents:
					item.lineSubtotalCents || undefined,
			}));

		if (validItems.length === 0) {
			toast.error("Please add at least one item");
			setLoading(false);
			return;
		}

		try {
			const attachments = attachmentFile
				? [
						await readFileAsDataURL(
							attachmentFile,
						),
					]
				: undefined;

			await jsonFetcher<Purchase>(
				`/api/purchases/${purchase.id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						supplierId:
							supplierId || undefined,
						invoiceNo:
							invoiceNo || undefined,
						purchaseDate,
						items: validItems,
						attachments,
					}),
				},
			);
			toast.success(
				"Purchase updated successfully",
			);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to update purchase",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
			<DialogHeader>
				<DialogTitle>Edit Purchase</DialogTitle>
				<DialogDescription>
					Update supplier, date, line items, and invoice details.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<Label>Supplier</Label>
						<Select
							value={supplierId}
							onValueChange={setSupplierId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select supplier (optional)" />
							</SelectTrigger>
							<SelectContent>
								{suppliers.map((s) => (
									<SelectItem
										key={s.id}
										value={s.id}
									>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="editPurchaseDate">
							Purchase Date
						</Label>
						<Input
							id="editPurchaseDate"
							type="date"
							value={purchaseDate}
							onChange={(e) =>
								setPurchaseDate(e.target.value)
							}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="editInvoiceNo">
							Invoice Number (optional)
						</Label>
						<Input
							id="editInvoiceNo"
							value={invoiceNo}
							onChange={(e) =>
								setInvoiceNo(e.target.value)
							}
							placeholder="INV-12345"
						/>
					</div>
					<div className="space-y-2">
						<Label>Items</Label>
						<div className="space-y-3">
							{items.map((item, index) => {
								const units =
									calculateUnits(item);
								const subtotalCents =
									item.lineSubtotalCents ?? 0;
								const estimatedUnitCost =
									units > 0
										? Math.round(
												subtotalCents / units,
										  )
										: 0;
								return (
									<div
										key={index}
										className="space-y-1 rounded-lg bg-muted/50 p-3"
									>
										<div className="grid grid-cols-12 gap-2 items-end">
											<div className="col-span-12 lg:col-span-4">
												<ProductSelect
													products={
														normalizedProducts
													}
													value={item.productId}
													onChange={(v) =>
														updateItem(index, {
															productId: v,
														})
													}
													placeholder="Select product"
												/>
											</div>
											<div className="col-span-4 lg:col-span-1 space-y-1">
												<Label className="text-xs">
													Cases
												</Label>
												<Input
													type="number"
													min="0"
													value={item.cases}
													onChange={(e) =>
														updateItem(index, {
															cases:
																e.target.value,
														})
													}
												/>
											</div>
											<div className="col-span-4 lg:col-span-1 space-y-1">
												<Label className="text-xs">
													Singles
												</Label>
												<Input
													type="number"
													min="0"
													value={item.singles}
													onChange={(e) =>
														updateItem(index, {
															singles:
																e.target.value,
														})
													}
												/>
											</div>
											<div className="col-span-4 lg:col-span-1 space-y-1">
												<Label className="text-xs">
													Units
												</Label>
												<Input
													type="number"
													value={units}
													disabled
													className="bg-muted"
												/>
											</div>
											<div className="col-span-6 lg:col-span-2 min-w-0 space-y-1">
												<Label className="text-xs">
													Total
												</Label>
												<MoneyInput
													value={
														item.lineSubtotalCents
													}
													onChange={(v) =>
														updateItem(index, {
															lineSubtotalCents: v,
														})
													}
													placeholder="0.00"
													className="space-y-0"
												/>
											</div>
											<div className="col-span-12 lg:col-span-1 flex justify-end">
												{items.length > 1 && (
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() =>
															removeItem(index)
														}
														className="shrink-0"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</div>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Subtotal {formatZAR(subtotalCents)}
										</p>
										<p className="text-[11px] text-muted-foreground">
											Estimated unit cost:{" "}
											{formatZAR(estimatedUnitCost)}
										</p>
									</div>
								);
							})}
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={addItem}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Item
						</Button>
					</div>
					<div className="space-y-2">
						<Label>Upload Invoice Image</Label>
						<Input
							type="file"
							accept="image/*"
							onChange={(e) =>
								setAttachmentFile(
									e.target.files?.[0] ?? null,
								)
							}
						/>
					</div>
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</DialogClose>
					<Button
						type="submit"
						disabled={loading}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

function readFileAsDataURL(file: File) {
	return new Promise<string>(
		(resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === "string")
					resolve(reader.result);
				else
					reject(
						new Error("Unexpected file result"),
					);
			};
			reader.onerror = () => {
				reject(new Error("Failed to read file"));
			};
			reader.readAsDataURL(file);
		},
	);
}
