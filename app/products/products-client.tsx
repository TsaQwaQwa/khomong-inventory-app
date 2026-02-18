"use client";
/* eslint-disable max-len */

import * as React from "react";
import {
	usePathname,
	useRouter,
	useSearchParams,
} from "next/navigation";
import { type KeyedMutator } from "swr";
import { toast } from "sonner";
import {
	Plus,
	DollarSign,
	AlertCircle,
	Edit,
	ClipboardEdit,
	Trash2,
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
import { useOfflineCachedArraySWR } from "@/lib/use-offline-cached-swr";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import useSWR from "swr";

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
	currentUnits?: number;
	stockStatus?: "OUT" | "LOW" | "OK";
}
type ProductWithStock = Product & CurrentStockRow;

export function ProductsClient({
	showFilters = true,
}: {
	showFilters?: boolean;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const focusedProductId =
		searchParams.get("productId");
	const stockStatusFilter = searchParams.get(
		"stockStatus",
	);
	const priceFilter = searchParams.get("priceFilter");
	const stockStatusUiValue =
		stockStatusFilter === "OUT" ||
		stockStatusFilter === "LOW" ||
		stockStatusFilter === "OK"
			? stockStatusFilter
			: "all";
	const priceFilterUiValue =
		priceFilter === "missing" ||
		priceFilter === "set"
			? priceFilter
			: "all";
	const {
		items: products,
		error: effectiveError,
		isLoading: effectiveLoading,
		mutate,
		usingCachedData: usingCachedProducts,
	} = useOfflineCachedArraySWR<ProductWithStock>({
		key: "/api/products?includeStock=1",
		cacheKey: "products:includeStock=1",
		fetcher: (url) => jsonFetcher<ProductWithStock[]>(url),
		onError: (err) => toast.error(err.message),
	});
	const { data: access } = useSWR<{
		isAdmin: boolean;
	}>("/api/session/access", (url: string) =>
		jsonFetcher<{ isAdmin: boolean }>(url),
	);
	const isAdmin = access?.isAdmin ?? false;
	const visibleProducts = React.useMemo(() => {
		if (!products) return [];
		let filtered = products;
		if (
			stockStatusFilter === "OUT" ||
			stockStatusFilter === "LOW" ||
			stockStatusFilter === "OK"
		) {
			filtered = filtered.filter(
				(product) =>
					product.stockStatus === stockStatusFilter,
			);
		}
		if (priceFilter === "missing") {
			filtered = filtered.filter(
				(product) =>
					!product.currentPriceCents ||
					product.currentPriceCents <= 0,
			);
		}
		if (priceFilter === "set") {
			filtered = filtered.filter(
				(product) =>
					(product.currentPriceCents ?? 0) > 0,
			);
		}
		if (!focusedProductId) return filtered;
		const focused = filtered.find(
			(product) =>
				product.id === focusedProductId,
		);
		return focused ? [focused] : filtered;
	}, [
		focusedProductId,
		products,
		priceFilter,
		stockStatusFilter,
	]);

	const [addDialogOpen, setAddDialogOpen] =
		React.useState(false);
	const [priceDialogOpen, setPriceDialogOpen] =
		React.useState(false);
	const [selectedProduct, setSelectedProduct] =
		React.useState<Product | null>(null);
	const [editingProduct, setEditingProduct] =
		React.useState<Product | null>(null);
	const [
		pendingDeleteProduct,
		setPendingDeleteProduct,
	] = React.useState<ProductWithStock | null>(null);
	const [deletingProductId, setDeletingProductId] =
		React.useState<string | null>(null);

	const handlePriceClick = (product: Product) => {
		setSelectedProduct(product);
		setPriceDialogOpen(true);
	};
	const setFilterParam = (
		key: "stockStatus" | "priceFilter",
		value: string,
	) => {
		const params = new URLSearchParams(
			searchParams.toString(),
		);
		params.delete("productId");
		if (value === "all") {
			params.delete(key);
		} else {
			params.set(key, value);
		}
		const query = params.toString();
		router.push(
			query ? `${pathname}?${query}` : pathname,
		);
	};
	const clearFilters = () => {
		const params = new URLSearchParams(
			searchParams.toString(),
		);
		params.delete("productId");
		params.delete("stockStatus");
		params.delete("priceFilter");
		const query = params.toString();
		router.push(
			query ? `${pathname}?${query}` : pathname,
		);
	};
	const hasActiveFilters =
		stockStatusUiValue !== "all" ||
		priceFilterUiValue !== "all" ||
		Boolean(focusedProductId);
	const deleteProduct = React.useCallback(
		async (product: ProductWithStock) => {
			setDeletingProductId(product.id);
			try {
				await mutate(
					async (current = []) => {
						const deleted = await jsonFetcher<Product>(
							`/api/products/${product.id}`,
							{
								method: "DELETE",
							},
						);
						return current.filter(
							(item) => item.id !== deleted.id,
						);
					},
					{
						optimisticData: (current = []) =>
							current.filter(
								(item) => item.id !== product.id,
							),
						rollbackOnError: true,
					},
				);
				toast.success("Product deleted");
				setPendingDeleteProduct(null);
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to delete product",
				);
			} finally {
				setDeletingProductId(null);
			}
		},
		[mutate],
	);

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
			{usingCachedProducts && products.length > 0 && (
				<p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
					Offline mode: showing cached products from this device.
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
			) : !products?.length ? (
				<EmptyState
					title="No products"
					description="Get started by adding your first product."
				/>
			) : (
				<div className="space-y-3">
					{showFilters ? (
						<Card>
							<CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
								<div className="space-y-1">
									<Label htmlFor="stock-filter">
										Stock Filter
									</Label>
									<Select
										value={stockStatusUiValue}
										onValueChange={(value) =>
											setFilterParam(
												"stockStatus",
												value,
											)
										}
									>
										<SelectTrigger id="stock-filter">
											<SelectValue placeholder="All stock levels" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												All stock levels
											</SelectItem>
											<SelectItem value="OUT">
												Out of stock
											</SelectItem>
											<SelectItem value="LOW">
												Low stock
											</SelectItem>
											<SelectItem value="OK">
												In stock
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1">
									<Label htmlFor="price-filter">
										Price Filter
									</Label>
									<Select
										value={priceFilterUiValue}
										onValueChange={(value) =>
											setFilterParam(
												"priceFilter",
												value,
											)
										}
									>
										<SelectTrigger id="price-filter">
											<SelectValue placeholder="All prices" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												All prices
											</SelectItem>
											<SelectItem value="missing">
												Missing price
											</SelectItem>
											<SelectItem value="set">
												Price set
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={clearFilters}
										disabled={!hasActiveFilters}
									>
										Clear Filters
									</Button>
									<p className="text-xs text-muted-foreground">
										{visibleProducts.length} of{" "}
										{products.length} shown
									</p>
								</div>
							</CardContent>
						</Card>
					) : null}
					<Card className="shadow-lg">
					<CardContent className="pt-6">
						<div className="space-y-3 md:hidden">
							{visibleProducts.map((product) => {
								const priceDisplay =
									product.currentPriceCents
										? formatZAR(
												product.currentPriceCents,
										  )
										: "-";
								const canDeleteProduct =
									isAdmin &&
									(product.currentUnits ?? 0) <= 0;
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
														product.stockStatus ===
															"OUT" &&
															"text-destructive font-semibold",
														product.stockStatus ===
															"LOW" &&
															"text-amber-700 font-medium",
														product.stockStatus ===
															"OK" &&
															"text-emerald-700 font-medium",
													)}
												>
													{product.currentUnits ??
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
											{canDeleteProduct && (
												<Button
													variant="destructive"
													size="sm"
													onClick={() =>
														setPendingDeleteProduct(
															product,
														)
													}
												>
													<Trash2 className="mr-1 h-3 w-3" />
													Delete
												</Button>
											)}
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
									{visibleProducts.map((product) => {
										const priceDisplay =
											product.currentPriceCents
												? formatZAR(
														product.currentPriceCents,
												  )
												: "-";
										const canDeleteProduct =
											isAdmin &&
											(product.currentUnits ?? 0) <= 0;
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
														product.stockStatus ===
															"OUT" &&
															"text-destructive font-semibold",
														product.stockStatus ===
															"LOW" &&
															"text-amber-700 font-medium",
														product.stockStatus ===
															"OK" &&
															"text-emerald-700 font-medium",
													)}
												>
													{product.currentUnits ??
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
														{canDeleteProduct && (
															<Button
																variant="destructive"
																size="sm"
																onClick={() =>
																	setPendingDeleteProduct(
																		product,
																	)
																}
															>
																<Trash2 className="mr-1 h-3 w-3" />
																Delete
															</Button>
														)}
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
				</div>
			)}

			{/* Edit Product Dialog */}
			<Dialog
				open={Boolean(pendingDeleteProduct)}
				onOpenChange={(open) => {
					if (!open) {
						setPendingDeleteProduct(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Delete Product
						</DialogTitle>
						<DialogDescription>
							Delete{" "}
							<strong>
								{pendingDeleteProduct?.name}
							</strong>
							? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
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
							type="button"
							variant="destructive"
							disabled={
								!pendingDeleteProduct ||
								deletingProductId ===
									pendingDeleteProduct.id
							}
							onClick={() => {
								if (!pendingDeleteProduct)
									return;
								void deleteProduct(
									pendingDeleteProduct,
								);
							}}
						>
							{pendingDeleteProduct &&
							deletingProductId ===
								pendingDeleteProduct.id
								? "Deleting..."
								: "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
	mutateProducts: KeyedMutator<ProductWithStock[]>;
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
	mutateProducts: KeyedMutator<ProductWithStock[]>;
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
