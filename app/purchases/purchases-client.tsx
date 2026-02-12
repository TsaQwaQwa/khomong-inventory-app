"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
	Plus,
	Trash2,
	AlertCircle,
	Edit,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DatePickerYMD } from "@/components/date-picker-ymd";
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
import { getTodayJHB } from "@/lib/date-utils";
import { formatZAR } from "@/lib/money";
import type {
	Product,
	Supplier,
	Purchase,
	PurchaseItem,
} from "@/lib/types";
import { jsonFetcher } from "@/lib/swr";

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
	const [date, setDate] = React.useState(
		getTodayJHB(),
	);
	const [recordDialogOpen, setRecordDialogOpen] =
		React.useState(false);
	const [editingPurchase, setEditingPurchase] =
		React.useState<Purchase | null>(null);

	const {
		data: purchases,
		error,
		isLoading,
		mutate,
	} = useSWR<Purchase[]>(
		`/api/purchases?date=${date}`,
		fetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);

	const { data: products } = useSWR<Product[]>(
		"/api/products",
		fetcher,
	);
	const {
		data: suppliers,
		mutate: mutateSuppliers,
	} = useSWR<Supplier[]>(
		"/api/suppliers",
		fetcher,
	);

	const normalizedProducts = React.useMemo(
		() =>
			Array.isArray(products) ? products : [],
		[products],
	);

	return (
		<PageWrapper
			title="Stock Purchases"
			description="Record stock received from suppliers."
			actions={
				<div className="flex items-center gap-2">
					<DatePickerYMD
						value={date}
						onChange={setDate}
					/>
					<Dialog
						open={recordDialogOpen}
						onOpenChange={setRecordDialogOpen}
					>
						<DialogTrigger asChild>
							<Button className="hidden">
								<Plus className="mr-2 h-4 w-4" />
								Add Purchase
							</Button>
						</DialogTrigger>
						<RecordPurchaseDialog
							products={normalizedProducts}
							suppliers={suppliers || []}
							date={date}
							onSuccess={() => {
								setRecordDialogOpen(false);
								mutate();
							}}
							onSupplierAdded={() =>
								mutateSuppliers()
							}
						/>
					</Dialog>
				</div>
			}
		>
			{isLoading ? (
				<LoadingTable />
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{error.message}
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
							onEditInvoice={() =>
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
					<EditInvoiceDialog
						purchase={editingPurchase}
						products={normalizedProducts}
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
	onEditInvoice,
}: {
	purchase: Purchase;
	products: Product[];
	onEditInvoice?: () => void;
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
	const totalCost = purchase.items.reduce(
		(sum, item) =>
			sum +
			(item.unitCostCents || 0) * item.units,
		0,
	);

	return (
		<Card className="shadow-md">
			<CardHeader>
				<CardTitle className="flex flex-wrap items-center justify-between gap-2">
					<span>
						{purchase.supplierName ||
							"Unknown Supplier"}
					</span>
					{purchase.invoiceNo && (
						<div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
							<span>
								Invoice: {purchase.invoiceNo}
							</span>
							{onEditInvoice && (
								<Button
									variant="ghost"
									size="icon"
									onClick={onEditInvoice}
								>
									<Edit className="h-4 w-4" />
								</Button>
							)}
						</div>
					)}
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
						<div>
							<p className="text-muted-foreground">
								Invoice
							</p>
							<p className="font-medium truncate">
								{purchase.invoiceNo ?? "-"}
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
	unitCostCents: number;
}

function RecordPurchaseDialog({
	products,
	suppliers,
	date,
	onSuccess,
	onSupplierAdded,
}: {
	products: Product[];
	suppliers: Supplier[];
	date: string;
	onSuccess: () => void;
	onSupplierAdded: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [supplierId, setSupplierId] =
		React.useState("");
	const [invoiceNo, setInvoiceNo] =
		React.useState("");
	const [scanBarcode, setScanBarcode] =
		React.useState("");
	const [items, setItems] = React.useState<
		LineItem[]
	>([
		{
			productId: "",
			cases: "",
			singles: "",
			unitCostCents: 0,
		},
	]);
	const [addSupplierOpen, setAddSupplierOpen] =
		React.useState(false);

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

	const addItem = () => {
		setItems([
			...items,
			{
				productId: "",
				cases: "",
				singles: "",
				unitCostCents: 0,
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
							unitCostCents: 0,
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
					(item.cases || item.singles),
			)
			.map((item) => ({
				productId: item.productId,
				cases: parseInt(item.cases) || 0,
				singles: parseInt(item.singles) || 0,
				units: calculateUnits(item),
				unitCostCents:
					item.unitCostCents || undefined,
			}));

		if (validItems.length === 0) {
			toast.error("Please add at least one item");
			setLoading(false);
			return;
		}

		try {
			const res = await fetch("/api/purchases", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					supplierId: supplierId || undefined,
					invoiceNo: invoiceNo || undefined,
					purchaseDate: date,
					items: validItems,
				}),
			});

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
		<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
			<DialogHeader>
				<DialogTitle>Add Purchase</DialogTitle>
				<DialogDescription>
					Record a stock purchase for {date}.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-4 py-4">
					{/* Supplier */}
					<div className="flex gap-2 items-end">
						<div className="flex-1 space-y-2">
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
						<Dialog
							open={addSupplierOpen}
							onOpenChange={setAddSupplierOpen}
						>
							<DialogTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="icon"
								>
									<Plus className="h-4 w-4" />
								</Button>
							</DialogTrigger>
							<AddSupplierDialog
								onSuccess={(newId) => {
									setAddSupplierOpen(false);
									onSupplierAdded();
									setSupplierId(newId);
								}}
							/>
						</Dialog>
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
							{items.map((item, index) => (
								<div
									key={index}
									className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg"
								>
									<div className="col-span-12 sm:col-span-4">
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
									<div className="col-span-4 sm:col-span-2 space-y-1">
										<Label className="text-xs">
											Cases
										</Label>
										<Input
											type="number"
											min="0"
											value={item.cases}
											onChange={(e) =>
												updateItem(index, {
													cases: e.target.value,
												})
											}
											placeholder="0"
										/>
									</div>
									<div className="col-span-4 sm:col-span-2 space-y-1">
										<Label className="text-xs">
											Singles
										</Label>
										<Input
											type="number"
											min="0"
											value={item.singles}
											onChange={(e) =>
												updateItem(index, {
													singles: e.target.value,
												})
											}
											placeholder="0"
										/>
									</div>
									<div className="col-span-4 sm:col-span-2 space-y-1">
										<Label className="text-xs">
											Units
										</Label>
										<Input
											type="number"
											value={calculateUnits(item)}
											disabled
											className="bg-muted"
										/>
									</div>
									<div className="col-span-8 sm:col-span-2 flex gap-1 items-end">
										<MoneyInput
											value={item.unitCostCents}
											onChange={(v) =>
												updateItem(index, {
													unitCostCents: v,
												})
											}
											placeholder="Cost"
										/>
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
							))}
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

function EditInvoiceDialog({
	purchase,
	products,
	onSuccess,
}: {
	purchase: Purchase;
	products: Product[];
	onSuccess: () => void;
}) {
	const [invoiceNo, setInvoiceNo] =
		React.useState(purchase.invoiceNo ?? "");
	const [loading, setLoading] =
		React.useState(false);
	const [itemCosts, setItemCosts] =
		React.useState(
			purchase.items.map((item) => ({
				productId: item.productId,
				unitCostCents: item.unitCostCents ?? 0,
			})),
		);
	const [attachmentFile, setAttachmentFile] =
		React.useState<File | null>(null);

	React.useEffect(() => {
		setInvoiceNo(purchase.invoiceNo ?? "");
		setItemCosts(
			purchase.items.map((item) => ({
				productId: item.productId,
				unitCostCents: item.unitCostCents ?? 0,
			})),
		);
		setAttachmentFile(null);
	}, [purchase]);

	const productMap = React.useMemo(
		() => new Map(products.map((p) => [p.id, p])),
		[products],
	);

	const handleCostChange = (
		productId: string,
		cents: number,
	) => {
		setItemCosts((prev) =>
			prev.map((item) =>
				item.productId === productId
					? { ...item, unitCostCents: cents }
					: item,
			),
		);
	};

	const handleFileChange = (
		file?: File | null,
	) => {
		setAttachmentFile(file ?? null);
	};

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

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
						invoiceNo:
							invoiceNo.trim() || undefined,
						items: itemCosts,
						attachments,
					}),
				},
			);

			toast.success(
				"Invoice updated successfully",
			);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to update invoice",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Edit Invoice</DialogTitle>
				<DialogDescription>
					Update the invoice details for this
					purchase.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="editInvoiceNo">
							Invoice Number
						</Label>
						<Input
							id="editInvoiceNo"
							value={invoiceNo}
							onChange={(e) =>
								setInvoiceNo(e.target.value)
							}
							placeholder="Enter invoice number"
						/>
					</div>
					<div className="space-y-2">
						<Label>Unit Costs</Label>
						<div className="space-y-3">
							{purchase.items.map((item) => {
								const productName =
									productMap.get(item.productId)
										?.name ?? item.productId;
								return (
									<div
										key={item.productId}
										className="flex items-center gap-3"
									>
										<span className="flex-1 text-sm text-muted-foreground">
											{productName}
										</span>
										<MoneyInput
											value={
												itemCosts.find(
													(cost) =>
														cost.productId ===
														item.productId,
												)?.unitCostCents ?? 0
											}
											onChange={(cents) =>
												handleCostChange(
													item.productId,
													cents,
												)
											}
										/>
									</div>
								);
							})}
						</div>
					</div>
					<div className="space-y-2">
						<Label>Upload Invoice Image</Label>
						<Input
							type="file"
							accept="image/*"
							onChange={(e) =>
								handleFileChange(
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

function AddSupplierDialog({
	onSuccess,
}: {
	onSuccess: (id: string) => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [name, setName] = React.useState("");

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		try {
			const res = await fetch("/api/suppliers", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name }),
			});

			if (!res.ok) {
				const error = await res
					.json()
					.catch(() => ({
						error: "Request failed",
					}));
				throw new Error(
					error.error || "Failed to add supplier",
				);
			}

			const data = await res.json();
			toast.success(
				"Supplier added successfully",
			);
			onSuccess(data.id);
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to add supplier",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Add Supplier</DialogTitle>
				<DialogDescription>
					Add a new supplier to your list.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="py-4">
					<Label htmlFor="supplierName">
						Name
					</Label>
					<Input
						id="supplierName"
						value={name}
						onChange={(e) =>
							setName(e.target.value)
						}
						placeholder="SAB Miller"
						required
					/>
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
