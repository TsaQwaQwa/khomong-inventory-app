"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
	Plus,
	DollarSign,
	AlertCircle,
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
import type { Product } from "@/lib/types";

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

const CATEGORIES = [
	"Beer",
	"Cider",
	"Spirits",
	"Wine",
	"Mixers",
	"Snacks",
	"Other",
];

export function ProductsClient() {
	const {
		data: products,
		error,
		isLoading,
		mutate,
	} = useSWR<Product[]>(
		"/api/products",
		fetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);

	const [addDialogOpen, setAddDialogOpen] =
		React.useState(false);
	const [priceDialogOpen, setPriceDialogOpen] =
		React.useState(false);
	const [selectedProduct, setSelectedProduct] =
		React.useState<Product | null>(null);

	const handlePriceClick = (product: Product) => {
		setSelectedProduct(product);
		setPriceDialogOpen(true);
	};

	return (
		<PageWrapper
			title="Products"
			description="Manage your product catalog"
			actions={
				<Dialog
					open={addDialogOpen}
					onOpenChange={setAddDialogOpen}
				>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							Add Product
						</Button>
					</DialogTrigger>
					<AddProductDialog
						onSuccess={() => {
							setAddDialogOpen(false);
							mutate();
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
					action={
						<Button
							onClick={() =>
								setAddDialogOpen(true)
							}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Product
						</Button>
					}
				/>
			) : (
				<Card className="shadow-lg">
					<CardContent className="pt-6">
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
										Current Price
									</TableHead>
									<TableHead className="text-right">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{products.map((product) => (
									<TableRow key={product.id}>
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
										<TableCell className="text-right">
											{product.currentPriceCents
												? formatZAR(
														product.currentPriceCents,
													)
												: "-"}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handlePriceClick(
														product,
													)
												}
											>
												<DollarSign className="mr-1 h-3 w-3" />
												Set Price
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

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
	onSuccess,
}: {
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [formData, setFormData] = React.useState({
		name: "",
		category: "",
		barcode: "",
		packSize: "",
		reorderLevelUnits: "",
	});

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		try {
			const res = await fetch("/api/products", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: formData.name,
					category: formData.category,
					barcode: formData.barcode || undefined,
					packSize:
						parseInt(formData.packSize) || 1,
					reorderLevelUnits:
						parseInt(
							formData.reorderLevelUnits,
						) || 0,
				}),
			});

			if (!res.ok) {
				const error = await res
					.json()
					.catch(() => ({
						error: "Request failed",
					}));
				throw new Error(
					error.error || "Failed to add product",
				);
			}

			toast.success("Product added successfully");
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
					<Button
						type="submit"
						disabled={loading}
					>
						{loading
							? "Adding..."
							: "Add Product"}
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
					<Button
						type="submit"
						disabled={loading}
					>
						{loading ? "Saving..." : "Save Price"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}
