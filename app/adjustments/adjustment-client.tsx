"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
	Plus,
	Trash2,
	AlertCircle,
	Check,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DatePickerYMD } from "@/components/date-picker-ymd";
import { LoadingForm } from "@/components/loading-state";
import { ProductSelect } from "@/components/product-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getTodayJHB } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type {
	Product,
	AdjustmentReason,
	AdjustmentItem,
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

const ADJUSTMENT_REASONS: {
	value: AdjustmentReason;
	label: string;
}[] = [
	{ value: "SPILLAGE", label: "Spillage" },
	{ value: "BREAKAGE", label: "Breakage" },
	{ value: "FREEBIES", label: "Freebies" },
	{
		value: "THEFT_SUSPECTED",
		label: "Theft (Suspected)",
	},
	{
		value: "COUNT_CORRECTION",
		label: "Count Correction",
	},
];

interface FormItem {
	productId: string;
	unitsDelta: string;
	reason: AdjustmentReason | "";
	note: string;
}

export function AdjustmentsClient() {
	const [date, setDate] = React.useState(
		getTodayJHB(),
	);
	const [items, setItems] = React.useState<
		FormItem[]
	>([
		{
			productId: "",
			unitsDelta: "",
			reason: "",
			note: "",
		},
	]);
	const [loading, setLoading] =
		React.useState(false);
	const [submittedItems, setSubmittedItems] =
		React.useState<
			(AdjustmentItem & { productName: string })[]
		>([]);

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

	const productMap = React.useMemo(
		() =>
			new Map(
				products?.map((p) => [p.id, p]) || [],
			),
		[products],
	);

	const addItem = () => {
		setItems([
			...items,
			{
				productId: "",
				unitsDelta: "",
				reason: "",
				note: "",
			},
		]);
	};

	const removeItem = (index: number) => {
		setItems(items.filter((_, i) => i !== index));
	};

	const updateItem = (
		index: number,
		updates: Partial<FormItem>,
	) => {
		setItems(
			items.map((item, i) =>
				i === index
					? { ...item, ...updates }
					: item,
			),
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
					item.unitsDelta &&
					item.reason,
			)
			.map((item) => ({
				productId: item.productId,
				unitsDelta:
					parseInt(item.unitsDelta) || 0,
				reason: item.reason as AdjustmentReason,
				note: item.note || undefined,
			}));

		if (validItems.length === 0) {
			toast.error(
				"Please add at least one valid adjustment item",
			);
			setLoading(false);
			return;
		}

		try {
			const res = await fetch(
				"/api/adjustments",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						date,
						items: validItems,
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
						"Failed to submit adjustments",
				);
			}

			toast.success(
				"Adjustments submitted successfully",
			);

			// Store submitted items for confirmation display
			setSubmittedItems(
				validItems.map((item) => ({
					...item,
					productName:
						productMap.get(item.productId)
							?.name || item.productId,
				})),
			);

			// Reset form
			setItems([
				{
					productId: "",
					unitsDelta: "",
					reason: "",
					note: "",
				},
			]);
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to submit adjustments",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<PageWrapper
			title="Adjustments"
			description="Record stock adjustments for spillage, breakage, freebies, etc."
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
				<div className="space-y-6 max-w-3xl mx-auto">
					{/* Submitted Confirmation */}
					{submittedItems.length > 0 && (
						<Alert className="border-primary/50 bg-primary/5">
							<Check className="h-4 w-4 text-primary" />
							<AlertTitle>
								Adjustments Submitted
							</AlertTitle>
							<AlertDescription>
								<ul className="mt-2 space-y-1 text-sm">
									{submittedItems.map(
										(item, i) => (
											<li key={i}>
												<strong>
													{item.productName}
												</strong>
												:{" "}
												{item.unitsDelta > 0
													? "+"
													: ""}
												{item.unitsDelta} units (
												{item.reason
													.replace("_", " ")
													.toLowerCase()}
												)
												{item.note &&
													` - ${item.note}`}
											</li>
										),
									)}
								</ul>
							</AlertDescription>
						</Alert>
					)}

					<form onSubmit={handleSubmit}>
						<Card className="shadow-lg">
							<CardHeader>
								<CardTitle>
									Adjustment Items
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{items.map((item, index) => (
									<div
										key={index}
										className="p-4 rounded-lg border bg-muted/30 space-y-4"
									>
										<div className="flex justify-between items-start gap-2">
											<span className="text-sm font-medium text-muted-foreground">
												Item {index + 1}
											</span>
											{items.length > 1 && (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() =>
														removeItem(index)
													}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>

										<div className="grid gap-4 sm:grid-cols-2">
											<ProductSelect
												products={products || []}
												value={item.productId}
												onChange={(v) =>
													updateItem(index, {
														productId: v,
													})
												}
												label="Product"
											/>

											<div className="space-y-2">
												<Label>Reason</Label>
												<Select
													value={item.reason}
													onValueChange={(
														v:
															| AdjustmentReason
															| "",
													) =>
														updateItem(index, {
															reason: v,
														})
													}
												>
													<SelectTrigger>
														<SelectValue placeholder="Select reason" />
													</SelectTrigger>
													<SelectContent>
														{ADJUSTMENT_REASONS.map(
															(r) => (
																<SelectItem
																	key={r.value}
																	value={r.value}
																>
																	{r.label}
																</SelectItem>
															),
														)}
													</SelectContent>
												</Select>
											</div>
										</div>

										<div className="grid gap-4 sm:grid-cols-2">
											<div className="space-y-2">
												<Label>Units Delta</Label>
												<Input
													type="number"
													value={item.unitsDelta}
													onChange={(e) =>
														updateItem(index, {
															unitsDelta:
																e.target.value,
														})
													}
													placeholder="-5 for loss, +3 for gain"
												/>
												<p className="text-xs text-muted-foreground">
													Use negative numbers for
													losses (e.g., -5)
												</p>
											</div>

											<div className="space-y-2">
												<Label>
													Note (optional)
												</Label>
												<Textarea
													value={item.note}
													onChange={(e) =>
														updateItem(index, {
															note: e.target
																.value,
														})
													}
													placeholder="Additional details..."
													rows={2}
												/>
											</div>
										</div>
									</div>
								))}

								<Button
									type="button"
									variant="outline"
									onClick={addItem}
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Item
								</Button>
							</CardContent>
						</Card>

						<div className="mt-6 flex justify-end">
							<Button
								type="submit"
								size="lg"
								disabled={loading}
							>
								{loading
									? "Submitting..."
									: "Submit Adjustments"}
							</Button>
						</div>
					</form>
				</div>
			)}
		</PageWrapper>
	);
}
