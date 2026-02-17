"use client";
/* eslint-disable max-len */

import * as React from "react";
import { toast } from "sonner";
import {
	Plus,
	Trash2,
	AlertCircle,
	Pencil,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DateRangeControls } from "@/components/date-range-controls";
import { LoadingForm } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { ProductSelect } from "@/components/product-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useOfflineCachedArraySWR } from "@/lib/use-offline-cached-swr";
import type {
	Product,
	AdjustmentReason,
	AdjustmentItem,
} from "@/lib/types";
import { useGlobalDateRangeQuery } from "@/lib/use-global-date-range-query";
import { postAdjustmentWithOfflineQueue } from "@/lib/offline-sales-queue";

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

const getApiErrorMessage = (
	payload: unknown,
	fallback: string,
) => {
	if (!payload || typeof payload !== "object")
		return fallback;

	const maybePayload = payload as Record<
		string,
		unknown
	>;
	const maybeError = maybePayload.error;

	if (typeof maybeError === "string")
		return maybeError;

	if (
		maybeError &&
		typeof maybeError === "object"
	) {
		const maybeErrorObj = maybeError as Record<
			string,
			unknown
		>;
		if (
			typeof maybeErrorObj.message === "string"
		) {
			return maybeErrorObj.message;
		}
	}

	return fallback;
};

const ADJUSTMENT_REASONS: {
	value: AdjustmentReason;
	label: string;
}[] = [
	{
		value: "OPENING_STOCK",
		label: "Existing Stock",
	},
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

interface AdjustmentHistory {
	id: string;
	date: string;
	items: AdjustmentItem[];
	createdAt?: string;
}

export function AdjustmentsClient() {
	const {
		from,
		to: date,
		preset,
		onPresetChange,
		onFromChange,
		onToChange,
		onRangeChange,
	} = useGlobalDateRangeQuery();
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
	const [isFormOpen, setIsFormOpen] =
		React.useState(false);
	const [
		editingAdjustmentId,
		setEditingAdjustmentId,
	] = React.useState<string | null>(null);

	const {
		items: products,
		error: productsError,
		isLoading: productsLoading,
		mutate: mutateProducts,
		usingCachedData: usingCachedProducts,
	} = useOfflineCachedArraySWR<Product>({
		key: "/api/products",
		cacheKey: "products:list",
		fetcher,
		onError: (err) => toast.error(err.message),
	});
	const {
		items: adjustmentsHistory,
		error: adjustmentsError,
		isLoading: adjustmentsLoading,
		mutate: mutateHistory,
		usingCachedData: usingCachedHistory,
	} = useOfflineCachedArraySWR<AdjustmentHistory>({
		key: `/api/adjustments?from=${from}&to=${date}`,
		cacheKey: `adjustments:${from}:${date}`,
		fetcher,
		onError: (err) => toast.error(err.message),
	});
	const usingCachedData = usingCachedProducts || usingCachedHistory;
	const effectiveLoading =
		productsLoading || adjustmentsLoading;
	const effectiveError = productsError ?? adjustmentsError;

	const productMap = React.useMemo(
		() =>
			new Map(
				products?.map((p) => [p.id, p]) || [],
			),
		[products],
	);
	const adjustmentReasonOptions = React.useMemo(
		() =>
			ADJUSTMENT_REASONS.map((reasonOption) => (
				<SelectItem
					key={reasonOption.value}
					value={reasonOption.value}
				>
					{reasonOption.label}
				</SelectItem>
			)),
		[],
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

	const openHistoryInForm = React.useCallback(
		(
			history: AdjustmentHistory,
			options?: { forEdit?: boolean },
		) => {
			const loadedItems = history.items.map(
				(item) => ({
					productId: item.productId,
					unitsDelta: String(
						item.unitsDelta ?? 0,
					),
					reason: item.reason,
					note: item.note ?? "",
				}),
			);

			setItems(
				loadedItems.length > 0
					? loadedItems
					: [
							{
								productId: "",
								unitsDelta: "",
								reason: "",
								note: "",
							},
						],
			);
			setEditingAdjustmentId(
				options?.forEdit ? history.id : null,
			);
			setIsFormOpen(true);
		},
		[],
	);

	const handleEditHistory = React.useCallback(
		(history: AdjustmentHistory) => {
			openHistoryInForm(history, {
				forEdit: true,
			});
			toast.success(
				"Adjustment loaded for editing",
			);
		},
		[openHistoryInForm],
	);
	const handleRepeatLastAdjustment =
		React.useCallback(() => {
			const latest =
				adjustmentsHistory &&
				adjustmentsHistory.length > 0
					? adjustmentsHistory[0]
					: null;
			if (!latest) {
				toast.error(
					"No previous adjustment to repeat",
				);
				return;
			}
			openHistoryInForm(latest, {
				forEdit: false,
			});
			toast.success("Last adjustment copied");
		}, [adjustmentsHistory, openHistoryInForm]);

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
			let res: Response;
			if (editingAdjustmentId) {
				res = await fetch(
					`/api/adjustments/${editingAdjustmentId}`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							items: validItems,
						}),
					},
				);
			} else {
				const queueResult =
					await postAdjustmentWithOfflineQueue({
						date,
						items: validItems,
					});
				if (queueResult.queued) {
					toast.success(
						"Offline: adjustment queued and will sync automatically.",
					);
					setItems([
						{
							productId: "",
							unitsDelta: "",
							reason: "",
							note: "",
						},
					]);
					setEditingAdjustmentId(null);
					setIsFormOpen(false);
					return;
				}
				res = queueResult.response;
			}

			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to submit adjustments",
					),
				);
			}

			toast.success(
				editingAdjustmentId
					? "Adjustment updated successfully"
					: "Adjustments submitted successfully",
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
			setEditingAdjustmentId(null);
			setIsFormOpen(false);
			mutateHistory();
			mutateProducts();
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
			title="Stock Adjustments"
			description="Record stock losses, gains, or corrections."
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
						onClick={handleRepeatLastAdjustment}
						disabled={
							!(
								adjustmentsHistory &&
								adjustmentsHistory.length > 0
							)
						}
					>
						Repeat Last Adjustment
					</Button>
					<Button
						type="button"
						className="hidden"
						onClick={() => {
							setItems([
								{
									productId: "",
									unitsDelta: "",
									reason: "",
									note: "",
								},
							]);
							setEditingAdjustmentId(null);
							setIsFormOpen(true);
						}}
					>
						Add Adjustment
					</Button>
				</div>
			}
		>
			{usingCachedData &&
				(products.length > 0 ||
					adjustmentsHistory.length > 0) && (
					<p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
						Offline mode: showing cached adjustments data from this
						device.
					</p>
				)}
			{effectiveLoading ? (
				<LoadingForm />
			) : effectiveError ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{effectiveError
							?.message ??
							"Failed to load adjustments"}
					</AlertDescription>
				</Alert>
			) : (
				<div className="space-y-6">
					<Dialog
						open={isFormOpen}
						onOpenChange={setIsFormOpen}
					>
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
							<DialogHeader>
								<DialogTitle>
									{editingAdjustmentId
										? "Edit Stock Adjustment"
										: "Stock Adjustments"}
								</DialogTitle>
								<DialogDescription>
									{editingAdjustmentId
										? "Update the saved adjustment items."
										: `Add one or more stock adjustments for ${date}.`}
								</DialogDescription>
							</DialogHeader>

							<form
								onSubmit={handleSubmit}
								className="space-y-6"
							>
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
														products={
															products || []
														}
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
																updateItem(
																	index,
																	{
																		reason: v,
																	},
																)
															}
														>
															<SelectTrigger>
																<SelectValue placeholder="Select reason" />
															</SelectTrigger>
															<SelectContent>
																{
																	adjustmentReasonOptions
																}
															</SelectContent>
														</Select>
													</div>
												</div>

												<div className="grid gap-4 sm:grid-cols-2">
													<div className="space-y-2">
														<Label>
															Stock Change (Units)
														</Label>
														<Input
															type="number"
															value={
																item.unitsDelta
															}
															onChange={(e) =>
																updateItem(
																	index,
																	{
																		unitsDelta:
																			e.target
																				.value,
																	},
																)
															}
															placeholder="-5 for loss, +3 for gain"
														/>
														<p className="text-xs text-muted-foreground">
															Use a minus for
															losses and a plus
															for gains.
														</p>
													</div>

													<div className="space-y-2">
														<Label>
															Note (optional)
														</Label>
														<Textarea
															value={item.note}
															onChange={(e) =>
																updateItem(
																	index,
																	{
																		note: e.target
																			.value,
																	},
																)
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
											: editingAdjustmentId
												? "Save"
												: "Save"}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>

					{!adjustmentsHistory?.length ? (
						<EmptyState
							title="No adjustments for this date"
							description="Add an adjustment to track stock losses or corrections."
						/>
					) : (
						<Card className="shadow-md">
							<CardHeader>
								<CardTitle>
									Adjustment History
								</CardTitle>
							</CardHeader>
							<CardContent>
								<>
									<div className="space-y-3 md:hidden">
										{adjustmentsHistory.map(
											(history) => {
												const netUnits =
													history.items.reduce(
														(sum, item) =>
															sum +
															item.unitsDelta,
														0,
													);

												return (
													<div
														key={history.id}
														className="rounded-lg border p-3"
													>
														<div className="flex items-start justify-between gap-2">
															<div>
																<p className="font-medium">
																	{history.createdAt
																		? new Date(
																				history.createdAt,
																			).toLocaleTimeString()
																		: "-"}
																</p>
																<p className="text-xs text-muted-foreground">
																	{
																		history.items
																			.length
																	}{" "}
																	items
																</p>
															</div>
															<p
																className={cn(
																	"font-semibold",
																	netUnits < 0 &&
																		"text-destructive",
																)}
															>
																{netUnits > 0
																	? `+${netUnits}`
																	: netUnits}{" "}
																net
															</p>
														</div>
														<div className="mt-2 space-y-1 text-sm text-muted-foreground">
															{history.items.map(
																(item, index) => {
																	const productName =
																		productMap.get(
																			item.productId,
																		)?.name ??
																		item.productId;
																	const signedUnits =
																		item.unitsDelta >
																		0
																			? `+${item.unitsDelta}`
																			: String(
																					item.unitsDelta,
																				);
																	return (
																		<p
																			key={`${history.id}-${index}`}
																		>
																			{
																				productName
																			}
																			:{" "}
																			{
																				signedUnits
																			}{" "}
																			(
																			{item.reason
																				.replaceAll(
																					"_",
																					" ",
																				)
																				.toLowerCase()}
																			)
																		</p>
																	);
																},
															)}
														</div>
														<div className="mt-3 flex justify-end">
															<Button
																type="button"
																size="sm"
																variant="outline"
																onClick={() =>
																	handleEditHistory(
																		history,
																	)
																}
															>
																<Pencil className="mr-2 h-3.5 w-3.5" />
																Edit
															</Button>
														</div>
													</div>
												);
											},
										)}
									</div>

									<div className="hidden md:block">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>
														Time
													</TableHead>
													<TableHead>
														Items
													</TableHead>
													<TableHead className="text-right">
														Net Units
													</TableHead>
													<TableHead>
														Details
													</TableHead>
													<TableHead className="text-right">
														Actions
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{adjustmentsHistory.map(
													(history) => {
														const netUnits =
															history.items.reduce(
																(sum, item) =>
																	sum +
																	item.unitsDelta,
																0,
															);
														const details =
															history.items
																.map((item) => {
																	const productName =
																		productMap.get(
																			item.productId,
																		)?.name ??
																		item.productId;
																	const signedUnits =
																		item.unitsDelta >
																		0
																			? `+${item.unitsDelta}`
																			: String(
																					item.unitsDelta,
																				);
																	return `${productName}: ${signedUnits}`;
																})
																.join(", ");

														return (
															<TableRow
																key={history.id}
															>
																<TableCell className="text-muted-foreground">
																	{history.createdAt
																		? new Date(
																				history.createdAt,
																			).toLocaleTimeString()
																		: "-"}
																</TableCell>
																<TableCell>
																	{
																		history.items
																			.length
																	}
																</TableCell>
																<TableCell
																	className={cn(
																		"text-right",
																		netUnits <
																			0 &&
																			"text-destructive",
																	)}
																>
																	{netUnits > 0
																		? `+${netUnits}`
																		: netUnits}
																</TableCell>
																<TableCell className="text-muted-foreground max-w-105 truncate">
																	{details || "-"}
																</TableCell>
																<TableCell className="text-right">
																	<Button
																		type="button"
																		size="sm"
																		variant="outline"
																		onClick={() =>
																			handleEditHistory(
																				history,
																			)
																		}
																	>
																		<Pencil className="mr-2 h-3.5 w-3.5" />
																		Edit
																	</Button>
																</TableCell>
															</TableRow>
														);
													},
												)}
											</TableBody>
										</Table>
									</div>
								</>
							</CardContent>
						</Card>
					)}
				</div>
			)}
		</PageWrapper>
	);
}
