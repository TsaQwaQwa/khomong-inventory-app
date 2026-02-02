"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertCircle, Check } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DatePickerYMD } from "@/components/date-picker-ymd";
import { LoadingForm } from "@/components/loading-state";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getTodayJHB } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
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

export function CloseStockClient() {
	const [date, setDate] = React.useState(
		getTodayJHB(),
	);
	const [counts, setCounts] = React.useState<
		Record<string, string>
	>({});
	const [isOpenCount, setIsOpenCount] =
		React.useState(false);
	const [loading, setLoading] =
		React.useState(false);
	const [selectedCategory, setSelectedCategory] =
		React.useState<string | null>(null);

	const {
		data: products,
		error,
		isLoading,
	} = useSWR<Product[]>(
		"/api/products",
		fetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);

	// Get unique categories
	const categories = React.useMemo(() => {
		if (!products) return [];
		const cats = new Set(
			products.map((p) => p.category || "Other"),
		);
		return Array.from(cats).sort();
	}, [products]);

	// Filter products by category
	const filteredProducts = React.useMemo(() => {
		if (!products) return [];
		if (!selectedCategory) return products;
		return products.filter(
			(p) =>
				(p.category || "Other") ===
				selectedCategory,
		);
	}, [products, selectedCategory]);

	const handleCountChange = (
		productId: string,
		value: string,
	) => {
		setCounts((prev) => ({
			...prev,
			[productId]: value,
		}));
	};

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		const countsArray = Object.entries(counts)
			.filter(
				([_, value]) =>
					value !== "" && value !== undefined,
			)
			.map(([productId, units]) => ({
				productId,
				units: parseInt(units) || 0,
			}));

		if (countsArray.length === 0) {
			toast.error(
				"Please enter at least one stock count",
			);
			setLoading(false);
			return;
		}

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
						type: isOpenCount ? "OPEN" : "CLOSE",
						counts: countsArray,
					}),
				},
			);

			if (!res.ok) {
				const error = await res
					.json()
					.catch(() => ({
						error: "Request failed",
					}));
				throw new Error(
					error.error ||
						"Failed to submit stock count",
				);
			}

			toast.success(
				`${isOpenCount ? "Opening" : "Closing"} stock count submitted successfully`,
			);
			setCounts({});
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to submit stock count",
			);
		} finally {
			setLoading(false);
		}
	};

	const filledCount = Object.values(
		counts,
	).filter((v) => v !== "").length;

	return (
		<PageWrapper
			title="Close Stock"
			description="Record your end-of-day stock count"
			actions={
				<DatePickerYMD
					value={date}
					onChange={setDate}
				/>
			}
		>
			{isLoading ? (
				<LoadingForm />
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{error.message}
					</AlertDescription>
				</Alert>
			) : (
				<form onSubmit={handleSubmit}>
					{/* Count Type Toggle */}
					<Card className="shadow-md mb-6">
						<CardContent className="pt-6">
							<div className="flex items-center justify-between">
								<div>
									<Label
										htmlFor="count-type"
										className="text-base font-medium"
									>
										Count Type
									</Label>
									<p className="text-sm text-muted-foreground">
										{isOpenCount
											? "Recording opening stock for the day"
											: "Recording closing stock for the day"}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<span
										className={cn(
											"text-sm",
											!isOpenCount &&
												"font-medium",
										)}
									>
										Close
									</span>
									<Switch
										id="count-type"
										checked={isOpenCount}
										onCheckedChange={
											setIsOpenCount
										}
									/>
									<span
										className={cn(
											"text-sm",
											isOpenCount &&
												"font-medium",
										)}
									>
										Open
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Category Filters */}
					<div className="flex flex-wrap gap-2 mb-4">
						<Button
							type="button"
							variant={
								selectedCategory === null
									? "default"
									: "outline"
							}
							size="sm"
							onClick={() =>
								setSelectedCategory(null)
							}
						>
							All
						</Button>
						{categories.map((cat) => (
							<Button
								key={cat}
								type="button"
								variant={
									selectedCategory === cat
										? "default"
										: "outline"
								}
								size="sm"
								onClick={() =>
									setSelectedCategory(cat)
								}
							>
								{cat}
							</Button>
						))}
					</div>

					{/* Stock Count Form */}
					<Card className="shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								<span>Stock Count</span>
								<Badge variant="secondary">
									{filledCount} /{" "}
									{products?.length || 0} entered
								</Badge>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{filteredProducts.map(
									(product) => (
										<div
											key={product.id}
											className={cn(
												"flex items-center gap-3 p-3 rounded-lg border transition-colors",
												counts[product.id] !==
													"" &&
													counts[product.id] !==
														undefined
													? "border-primary/50 bg-primary/5"
													: "border-border",
											)}
										>
											<div className="flex-1 min-w-0">
												<p className="font-medium truncate">
													{product.name}
												</p>
												<p className="text-xs text-muted-foreground">
													{product.category}
												</p>
											</div>
											<div className="w-20">
												<Input
													type="number"
													min="0"
													placeholder="Units"
													value={
														counts[product.id] ||
														""
													}
													onChange={(e) =>
														handleCountChange(
															product.id,
															e.target.value,
														)
													}
												/>
											</div>
											{counts[product.id] !==
												"" &&
												counts[product.id] !==
													undefined && (
													<Check className="h-4 w-4 text-primary shrink-0" />
												)}
										</div>
									),
								)}
							</div>
						</CardContent>
					</Card>

					{/* Submit Button */}
					<div className="mt-6 flex justify-end">
						<Button
							type="submit"
							size="lg"
							disabled={
								loading || filledCount === 0
							}
						>
							{loading
								? "Submitting..."
								: `Submit ${isOpenCount ? "Opening" : "Closing"} Count`}
						</Button>
					</div>
				</form>
			)}
		</PageWrapper>
	);
}
