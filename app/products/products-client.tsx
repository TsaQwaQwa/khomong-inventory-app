"use client";
/* eslint-disable max-len */

import * as React from "react";
import useSWR, { type KeyedMutator } from "swr";
import { toast } from "sonner";
import {
	Plus,
	DollarSign,
	AlertCircle,
	Edit,
	ClipboardEdit,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { LoadingTable } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
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
import {
	Card,
	CardContent,
} from "@/components/ui/card";
import { MoneyInput } from "@/components/money-input";
import { formatZAR } from "@/lib/money";
import { getTodayJHB } from "@/lib/date-utils";
import { jsonFetcher } from "@/lib/swr";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const CATEGORIES = [
	"Beer",
	"Cider",
	"Spirits",
	"Wine",
	"Mixers",
	"Snacks",
	"Other",
];

const INITIAL_FORM_STATE = {
	name: "",
	category: "",
	barcode: "",
	packSize: "",
	reorderLevelUnits: "",
};

interface CurrentStockRow {
	productId: string;
	currentUnits: number;
	reorderLevelUnits: number;
	status: "OUT" | "LOW" | "OK";
}

export function ProductsClient() {
	const {
		data: products,
		error,
		isLoading,
		mutate,
	} = useSWR<Product[]>("/api/products", {
		onError: (err) => toast.error(err.message),
	});
	const { data: currentStock = [] } = useSWR<
		CurrentStockRow[]
	>("/api/stock/current", jsonFetcher, {
		onError: (err) =>
			toast.error(
				err?.message ??
					"Failed to load current stock",
			),
	});
	const stockByProductId = React.useMemo(
		() =>
			new Map(
				currentStock.map((row) => [
					row.productId,
					row,
				]),
			),
		[currentStock],
	);

	const [addDialogOpen, setAddDialogOpen] =
		React.useState(false);
	const [priceDialogOpen, setPriceDialogOpen] =
		React.useState(false);
	const [selectedProduct, setSelectedProduct] =
		React.useState<Product | null>(null);
	const [editingProduct, setEditingProduct] =
		React.useState<Product | null>(null);

	const handlePriceClick = (product: Product) => {
		setSelectedProduct(product);
		setPriceDialogOpen(true);
	};

	return (
		<PageWrapper
			title="Products & Prices"
			description="Set your product list, pack sizes, and selling prices."
			actions={
				<Dialog
					open={addDialogOpen}
					onOpenChange={setAddDialogOpen}
				>
						<DialogTrigger asChild>
							<Button className="hidden">
								<Plus className="mr-2 h-4 w-4" />
								Add Product
							</Button>
						</DialogTrigger>
					<AddProductDialog
						mutateProducts={mutate}
						onSuccess={() => {
							setAddDialogOpen(false);
						}}
					/>
				</Dialog>
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
			) : !products?.length ? (
				<EmptyState
					title="No products"
					description="Get started by adding your first product."
				/>
			) : (
				<Card className="shadow-lg">
					<CardContent className="pt-6">
						<div className="space-y-3 md:hidden">
							{products.map((product) => {
								const priceDisplay =
									product.currentPriceCents
										? formatZAR(
												product.currentPriceCents,
										  )
										: "-";
								const stock =
									stockByProductId.get(
										product.id,
									);
								return (
									<div
										key={product.id}
										className="rounded-lg border p-3"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<p className="font-medium truncate">
													{product.name}
												</p>
												<p className="text-xs text-muted-foreground">
													{product.category}
												</p>
											</div>
											<p className="font-semibold">
												{priceDisplay}
											</p>
										</div>
										<div className="mt-3 grid grid-cols-2 gap-2 text-sm">
											<div>
												<p className="text-muted-foreground">
													Pack Size
												</p>
												<p>{product.packSize}</p>
											</div>
											<div className="text-right">
												<p className="text-muted-foreground">
													Reorder
												</p>
												<p>
													{
														product.reorderLevelUnits
													}
												</p>
											</div>
											<div>
												<p className="text-muted-foreground">
													Current Stock
												</p>
												<p
													className={cn(
														stock?.status ===
															"OUT" &&
															"text-destructive font-semibold",
														stock?.status ===
															"LOW" &&
															"text-amber-700 font-medium",
														stock?.status ===
															"OK" &&
															"text-emerald-700 font-medium",
													)}
												>
													{stock?.currentUnits ??
														0}
												</p>
											</div>
										</div>
										<div className="mt-3 flex justify-end gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handlePriceClick(
														product,
													)
												}
											>
												<ClipboardEdit className="mr-1 h-3 w-3" />
												Set Price
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													setEditingProduct(
														product,
													)
												}
											>
												<Edit className="mr-1 h-3 w-3" />
												Edit
											</Button>
										</div>
									</div>
								);
							})}
						</div>

						<div className="hidden md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Category</TableHead>
										<TableHead className="text-right">
											Pack Size
										</TableHead>
										<TableHead className="text-right">
											Reorder Level
										</TableHead>
										<TableHead className="text-right">
											Current Stock
										</TableHead>
										<TableHead className="text-right">
											Current Price
										</TableHead>
										<TableHead className="text-right">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{products.map((product) => {
										const priceDisplay =
											product.currentPriceCents
												? formatZAR(
														product.currentPriceCents,
												  )
												: "-";
										const stock =
											stockByProductId.get(
												product.id,
											);
										return (
											<TableRow
												key={product.id}
											>
												<TableCell className="font-medium">
													{product.name}
												</TableCell>
												<TableCell>
													{product.category}
												</TableCell>
												<TableCell className="text-right">
													{product.packSize}
												</TableCell>
												<TableCell className="text-right">
													{product.reorderLevelUnits}
												</TableCell>
												<TableCell
													className={cn(
														"text-right",
														stock?.status ===
															"OUT" &&
															"text-destructive font-semibold",
														stock?.status ===
															"LOW" &&
															"text-amber-700 font-medium",
														stock?.status ===
															"OK" &&
															"text-emerald-700 font-medium",
													)}
												>
													{stock?.currentUnits ??
														0}
												</TableCell>
												<TableCell className="text-right">
													{priceDisplay}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-2">
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																handlePriceClick(
																	product,
																)
															}
														>
															<ClipboardEdit className="mr-1 h-3 w-3" />
															Set Price
														</Button>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																setEditingProduct(
																	product,
																)
															}
														>
															<Edit className="mr-1 h-3 w-3" />
															Edit
														</Button>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Edit Product Dialog */}
			<Dialog
				open={Boolean(editingProduct)}
				onOpenChange={(open) => {
					if (!open) setEditingProduct(null);
				}}
			>
				{editingProduct && (
					<EditProductDialog
						product={editingProduct}
						mutateProducts={mutate}
						onSuccess={() =>
							setEditingProduct(null)
						}
					/>
				)}
			</Dialog>

			{/* Set Price Dialog */}
			<Dialog
				open={priceDialogOpen}
				onOpenChange={setPriceDialogOpen}
			>
				{selectedProduct && (
					<SetPriceDialog
						product={selectedProduct}
						onSuccess={() => {
							setPriceDialogOpen(false);
							setSelectedProduct(null);
							mutate();
						}}
					/>
				)}
			</Dialog>
		</PageWrapper>
	);
}

function AddProductDialog({
	mutateProducts,
	onSuccess,
}: {
	mutateProducts: KeyedMutator<Product[]>;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [formData, setFormData] = React.useState(
		INITIAL_FORM_STATE,
	);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		const packSize =
			parseInt(formData.packSize, 10) || 1;
		const reorderLevelUnits =
			parseInt(formData.reorderLevelUnits, 10) ||
			0;

		const optimisticProduct: Product = {
			id: `optimistic-${crypto.randomUUID()}`,
			name: formData.name,
			category: formData.category,
			barcode: formData.barcode || undefined,
			packSize,
			reorderLevelUnits,
		};

		try {
			await mutateProducts(
				async (current = []) => {
					const created =
						await jsonFetcher<Product>(
							"/api/products",
							{
								method: "POST",
								headers: {
									"Content-Type":
										"application/json",
								},
								body: JSON.stringify({
									name: formData.name,
									category: formData.category,
									barcode:
										formData.barcode || undefined,
									packSize,
									reorderLevelUnits,
								}),
							},
						);

					return [...current, created];
				},
				{
					optimisticData: (current = []) => [
						...current,
						optimisticProduct,
					],
					rollbackOnError: true,
				},
			);

			toast.success("Product added successfully");
			setFormData(INITIAL_FORM_STATE);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to add product",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Add Product</DialogTitle>
				<DialogDescription>
					Add a new product to your catalog.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) =>
								setFormData({
									...formData,
									name: e.target.value,
								})
							}
							placeholder="Castle Lager 500ml"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="category">
							Category
						</Label>
						<Select
							value={formData.category}
							onValueChange={(v) =>
								setFormData({
									...formData,
									category: v,
								})
							}
						>
							<SelectTrigger id="category">
								<SelectValue placeholder="Select category" />
							</SelectTrigger>
							<SelectContent>
								{CATEGORIES.map((cat) => (
									<SelectItem
										key={cat}
										value={cat}
									>
										{cat}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="barcode">
							Barcode (optional)
						</Label>
						<Input
							id="barcode"
							value={formData.barcode}
							onChange={(e) =>
								setFormData({
									...formData,
									barcode: e.target.value,
								})
							}
							placeholder="6001234567890"
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="packSize">
								Pack Size
							</Label>
							<Input
								id="packSize"
								type="number"
								min="1"
								value={formData.packSize}
								onChange={(e) =>
									setFormData({
										...formData,
										packSize: e.target.value,
									})
								}
								placeholder="24"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="reorderLevel">
								Reorder Level
							</Label>
							<Input
								id="reorderLevel"
								type="number"
								min="0"
								value={formData.reorderLevelUnits}
								onChange={(e) =>
									setFormData({
										...formData,
										reorderLevelUnits:
											e.target.value,
									})
								}
								placeholder="48"
							/>
						</div>
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

function EditProductDialog({
	product,
	mutateProducts,
	onSuccess,
}: {
	product: Product;
	mutateProducts: KeyedMutator<Product[]>;
	onSuccess: () => void;
}) {
	const initialForm = React.useMemo(
		() => ({
			name: product.name,
			category: product.category,
			barcode: product.barcode ?? "",
			packSize: String(product.packSize),
			reorderLevelUnits: String(
				product.reorderLevelUnits,
			),
		}),
		[product],
	);

	const [formData, setFormData] =
		React.useState(initialForm);
	const [loading, setLoading] =
		React.useState(false);

	React.useEffect(() => {
		setFormData(initialForm);
	}, [initialForm]);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		const packSize =
			parseInt(formData.packSize, 10) || 1;
		const reorderLevelUnits =
			parseInt(
				formData.reorderLevelUnits,
				10,
			) || 0;

		try {
			await mutateProducts(
				async (current = []) => {
					const updated = await jsonFetcher<Product>(
						`/api/products/${product.id}`,
						{
							method: "PATCH",
							headers: {
								"Content-Type":
									"application/json",
							},
							body: JSON.stringify({
								name: formData.name,
								category: formData.category,
								barcode:
									formData.barcode ||
									undefined,
								packSize,
								reorderLevelUnits,
							}),
						},
					);

					return current.map((p) =>
						p.id === updated.id
							? updated
							: p,
					);
				},
				{
					optimisticData: (current = []) =>
						current.map((p) =>
							p.id === product.id
								? {
										...p,
										name: formData.name,
										category:
											formData.category,
										barcode:
											formData.barcode ||
											undefined,
										packSize,
										reorderLevelUnits,
								  }
								: p,
						),
					rollbackOnError: true,
				},
			);

			toast.success("Product updated");
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to update product",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Edit Product</DialogTitle>
				<DialogDescription>
					Update the product details.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="edit-name">Name</Label>
						<Input
							id="edit-name"
							value={formData.name}
							onChange={(e) =>
								setFormData({
									...formData,
									name: e.target.value,
								})
							}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-category">
							Category
						</Label>
						<Select
							value={formData.category}
							onValueChange={(v) =>
								setFormData({
									...formData,
									category: v,
								})
							}
						>
							<SelectTrigger id="edit-category">
								<SelectValue placeholder="Category" />
							</SelectTrigger>
							<SelectContent>
								{CATEGORIES.map((cat) => (
									<SelectItem
										key={cat}
										value={cat}
									>
										{cat}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-barcode">
							Barcode (optional)
						</Label>
						<Input
							id="edit-barcode"
							value={formData.barcode}
							onChange={(e) =>
								setFormData({
									...formData,
									barcode: e.target.value,
								})
							}
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="edit-packSize">
								Pack Size
							</Label>
							<Input
								id="edit-packSize"
								type="number"
								min="1"
								value={formData.packSize}
								onChange={(e) =>
									setFormData({
										...formData,
										packSize:
											e.target.value,
									})
								}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="edit-reorderLevel">
								Reorder Level
							</Label>
							<Input
								id="edit-reorderLevel"
								type="number"
								min="0"
								value={
									formData.reorderLevelUnits
								}
								onChange={(e) =>
									setFormData({
										...formData,
										reorderLevelUnits:
											e.target.value,
									})
								}
							/>
						</div>
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

function SetPriceDialog({
	product,
	onSuccess,
}: {
	product: Product;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [priceCents, setPriceCents] =
		React.useState(
			product.currentPriceCents || 0,
		);
	const [effectiveFrom, setEffectiveFrom] =
		React.useState(getTodayJHB());

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		try {
			const res = await fetch("/api/prices", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					productId: product.id,
					priceCents,
					effectiveFrom:
						effectiveFrom || undefined,
				}),
			});

			if (!res.ok) {
				const error = await res
					.json()
					.catch(() => ({
						error: "Request failed",
					}));
				throw new Error(
					error.error || "Failed to set price",
				);
			}

			toast.success("Price updated successfully");
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to set price",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>
					Set Price for {product.name}
				</DialogTitle>
				<DialogDescription>
					Update the selling price for this
					product.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-4 py-4">
					<MoneyInput
						label="Price"
						value={priceCents}
						onChange={setPriceCents}
						placeholder="25.00"
					/>
					<div className="space-y-2">
						<Label htmlFor="effectiveFrom">
							Effective From
						</Label>
						<Input
							id="effectiveFrom"
							type="date"
							value={effectiveFrom}
							onChange={(e) =>
								setEffectiveFrom(e.target.value)
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
