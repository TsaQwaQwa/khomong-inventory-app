"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
	Plus,
	Trash2,
	AlertCircle,
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
import { getTodayJHB } from "@/lib/date-utils";
import { formatZAR, toCents } from "@/lib/money";
import type {
	Product,
	Supplier,
	Purchase,
	PurchaseItem,
} from "@/lib/types";

const fetcher = async (url: string) => {
	const res = await fetch(url);
	if (!res.ok) {
		const error = await res
			.json()
			.catch(() => ({ error: "Request failed" }));
		throw new Error(
			error.error || "Failed to fetch data",
		);
	}
	return res.json();
};

export function PurchasesClient() {
	const [date, setDate] = React.useState(
		getTodayJHB(),
	);
	const [recordDialogOpen, setRecordDialogOpen] =
		React.useState(false);

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

	return (
		<PageWrapper
			title="Purchases"
			description="Record stock purchases from suppliers"
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
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Record Purchase
							</Button>
						</DialogTrigger>
						<RecordPurchaseDialog
							products={products || []}
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
					action={
						<Button
							onClick={() =>
								setRecordDialogOpen(true)
							}
						>
							<Plus className="mr-2 h-4 w-4" />
							Record Purchase
						</Button>
					}
				/>
			) : (
				<div className="space-y-4">
					{purchases.map((purchase) => (
						<PurchaseCard
							key={purchase.id}
							purchase={purchase}
							products={products || []}
						/>
					))}
				</div>
			)}
		</PageWrapper>
	);
}

function PurchaseCard({
	purchase,
	products,
}: {
	purchase: Purchase;
	products: Product[];
}) {
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
						<span className="text-sm font-normal text-muted-foreground">
							Invoice: {purchase.invoiceNo}
						</span>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent>
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
			</CardContent>
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

	const productMap = React.useMemo(
		() => new Map(products.map((p) => [p.id, p])),
		[products],
	);

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

	const updateItem = (
		index: number,
		updates: Partial<LineItem>,
	) => {
		setItems(
			items.map((item, i) =>
				i === index
					? { ...item, ...updates }
					: item,
			),
		);
	};

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
				<DialogTitle>Record Purchase</DialogTitle>
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
											products={products}
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
					<Button
						type="submit"
						disabled={loading}
					>
						{loading
							? "Recording..."
							: "Record Purchase"}
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
					<Button
						type="submit"
						disabled={loading}
					>
						{loading
							? "Adding..."
							: "Add Supplier"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}
