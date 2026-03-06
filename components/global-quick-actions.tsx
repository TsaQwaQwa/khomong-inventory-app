"use client";
/* eslint-disable max-len */

import * as React from "react";
import { usePathname } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ProductSelect } from "@/components/product-select";
import { CustomerSelect } from "@/components/customer-select";
import { MoneyInput } from "@/components/money-input";
import { CashChangeCalculator } from "@/components/cash-change-calculator";
import {
	Box,
	ChevronDown,
	ChevronUp,
	CreditCard,
	DollarSign,
	PackageMinus,
	Plus,
	Receipt,
	ShoppingCart,
	Star,
	Trash2,
	Truck,
	Users,
} from "lucide-react";
import {
	formatDateDisplay,
	getTodayJHB,
} from "@/lib/date-utils";
import { formatZAR } from "@/lib/money";
import {
	postSaleWithOfflineQueue,
	postPurchaseWithOfflineQueue,
	postAdjustmentWithOfflineQueue,
	postTabExpenseWithOfflineQueue,
	postTabPaymentWithOfflineQueue,
} from "@/lib/offline-sales-queue";
import type {
	AdjustmentReason,
	Customer,
	PaymentMethod,
	Product,
	Supplier,
} from "@/lib/types";

declare global {
	interface Window {
		__quickAddLogs?: unknown[];
	}
}

function pushQuickAddDebugLog(
	event: string,
	meta?: Record<string, unknown>,
) {
	if (process.env.NODE_ENV !== "development") return;
	if (typeof window === "undefined") return;
	if (!Array.isArray(window.__quickAddLogs)) {
		window.__quickAddLogs = [];
	}
	const payload = {
		at: new Date().toISOString(),
		event,
		meta: meta ?? {},
	};
	window.__quickAddLogs.push(payload);
	if (window.__quickAddLogs.length > 500) {
		window.__quickAddLogs.shift();
	}
	console.log("[QuickAddDebug]", payload);
}

const ENABLED_PATHS = [
	"/dashboard",
	"/reports",
	"/products",
	"/purchases",
	"/suppliers",
	"/purchase-assistant",
	"/adjustments",
	"/tabs",
	"/transactions",
];

const MODAL_CONTENT_CLASS =
	"h-[70vh] w-[90vw] max-w-[90vw] overflow-hidden p-0 md:max-w-3xl";

type QuickAction =
	| "quick-checkout"
	| "quick-top-sellers"
	| "quick-fast-repeat"
	| "account-sale"
	| "account-payment"
	| "expense"
	| "restock"
	| "opening-stock"
	| "customer"
	| "supplier"
	| "supplier-price"
	| "product"
	| "purchase"
	| "adjustment";

const QUICK_ACTION_STORAGE_KEY =
	"kgomong.quickActions.favorites";
const QUICK_ACTION_ALL: QuickAction[] = [
	"quick-checkout",
	"quick-top-sellers",
	"quick-fast-repeat",
	"account-sale",
	"account-payment",
	"expense",
	"restock",
	"opening-stock",
	"customer",
	"supplier",
	"supplier-price",
	"product",
	"purchase",
	"adjustment",
];
const QUICK_ACTION_DEFAULT_FAVORITES: QuickAction[] = [
	"quick-checkout",
	"quick-fast-repeat",
	"account-sale",
	"purchase",
];

interface ChargeItem {
	productId: string;
	units: string;
}

interface PurchaseItemForm {
	productId: string;
	cases: string;
	singles: string;
	lineSubtotalCents: number;
}

interface AdjustmentItemForm {
	productId: string;
	unitsDelta: string;
	reason: AdjustmentReason | "";
	note: string;
}

interface DailyReportLite {
	trends?: {
		topProducts?: {
			productId: string;
			productName: string;
		}[];
	};
	stockRecommendations: {
		productId: string;
		recommendedOrderUnits: number;
	}[];
}

interface PurchaseHistoryLite {
	supplierId?: string;
	items: {
		productId: string;
		unitCostCents?: number;
	}[];
}

interface SupplierPriceLite {
	supplierId: string;
	productId: string;
	unitCostCents: number;
}

const CATEGORIES = [
	"Beer",
	"Cider",
	"Spirits",
	"Wine",
	"Mixers",
	"Snacks",
	"Other",
];

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
		value: "OPENING_STOCK",
		label: "Existing Stock",
	},
	{
		value: "COUNT_CORRECTION",
		label: "Count Correction",
	},
];

interface QuickProductLite {
	id: string;
	name: string;
}

interface DirectSaleHistoryLite {
	id: string;
	type: "DIRECT_SALE";
	paymentMethod?: PaymentMethod;
	items?: {
		productId: string;
		units: number;
	}[];
	isReversal?: boolean;
	isReversed?: boolean;
}

const fetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(
			json?.error?.message ??
				json?.error ??
				"Failed to fetch data",
		);
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

const getApiErrorCode = (
	payload: unknown,
): string | null => {
	if (!payload || typeof payload !== "object")
		return null;
	const maybePayload = payload as Record<
		string,
		unknown
	>;
	const maybeError = maybePayload.error;
	if (
		maybeError &&
		typeof maybeError === "object"
	) {
		const maybeErrorObj = maybeError as Record<
			string,
			unknown
		>;
		return typeof maybeErrorObj.code === "string"
			? maybeErrorObj.code
			: null;
	}
	return null;
};

const getQuickActionLabel = (
	action: QuickAction,
	restockCount: number,
) => {
	switch (action) {
		case "quick-checkout":
			return "Quick Checkout";
		case "quick-top-sellers":
			return "Top Sellers Sale";
		case "quick-fast-repeat":
			return "Fast Repeat Sale";
		case "account-sale":
			return "Add Sale to Account";
		case "account-payment":
			return "Add Account Payment";
		case "expense":
			return "Add Expense";
		case "restock":
			return `Restock Low Stock (${restockCount})`;
		case "opening-stock":
			return "Add Existing Stock";
		case "customer":
			return "Add Customer";
		case "supplier":
			return "Add Supplier";
		case "supplier-price":
			return "Set Supplier Cost";
		case "product":
			return "Add Product";
		case "purchase":
			return "Add Purchase";
		case "adjustment":
			return "Add Adjustment";
	}
};

const getQuickActionIcon = (
	action: QuickAction,
) => {
	switch (action) {
		case "quick-checkout":
		case "quick-top-sellers":
		case "quick-fast-repeat":
		case "account-sale":
			return <Receipt className="mr-2 h-4 w-4" />;
		case "account-payment":
		case "expense":
			return <CreditCard className="mr-2 h-4 w-4" />;
		case "restock":
		case "purchase":
			return <ShoppingCart className="mr-2 h-4 w-4" />;
		case "opening-stock":
			return <Box className="mr-2 h-4 w-4" />;
		case "customer":
			return <Users className="mr-2 h-4 w-4" />;
		case "supplier":
			return <Truck className="mr-2 h-4 w-4" />;
		case "supplier-price":
			return <DollarSign className="mr-2 h-4 w-4" />;
		case "product":
			return <Box className="mr-2 h-4 w-4" />;
		case "adjustment":
			return <PackageMinus className="mr-2 h-4 w-4" />;
	}
};

export function GlobalQuickActions() {
	const pathname = usePathname();
	const show = ENABLED_PATHS.some((path) =>
		pathname.startsWith(path),
	);
	const [open, setOpen] = React.useState(false);
	const [activeAction, setActiveAction] =
		React.useState<QuickAction | null>(null);
	const [showMoreActions, setShowMoreActions] =
		React.useState(false);
	const [showPinShortcuts, setShowPinShortcuts] =
		React.useState(false);
	const [favoriteActions, setFavoriteActions] =
		React.useState<QuickAction[]>(
			QUICK_ACTION_DEFAULT_FAVORITES,
		);
	const date = React.useMemo(() => getTodayJHB(), []);
	const { mutate } = useSWRConfig();
	const enableQuickData =
		show && (open || activeAction !== null);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		pushQuickAddDebugLog("global_quick_actions_mounted", {
			pathname,
			innerWidth: window.innerWidth,
			innerHeight: window.innerHeight,
			devicePixelRatio: window.devicePixelRatio,
			userAgent: navigator.userAgent,
		});
	}, [pathname]);

	const { data: products = [] } = useSWR<
		Product[]
	>(
		enableQuickData ? "/api/products" : null,
		fetcher,
	);
	const { data: customers = [] } = useSWR<
		Customer[]
	>(
		enableQuickData ? "/api/customers" : null,
		fetcher,
	);
	const { data: suppliers = [] } = useSWR<
		Supplier[]
	>(
		enableQuickData ? "/api/suppliers" : null,
		fetcher,
	);
	const { data: report } = useSWR<DailyReportLite>(
		enableQuickData
			? `/api/reports/daily?date=${date}`
			: null,
		fetcher,
	);
	const { data: purchaseHistory = [] } = useSWR<
		PurchaseHistoryLite[]
	>(
		enableQuickData
			? `/api/purchases?date=${date}&lookbackDays=60&fields=lite`
			: null,
		fetcher,
	);
	const { data: supplierPrices = [] } = useSWR<
		SupplierPriceLite[]
	>(
		enableQuickData
			? `/api/supplier-prices?asOf=${date}&fields=lite`
			: null,
		fetcher,
	);
	const restockSeed = React.useMemo(
		() => {
			const recommendations = (
				report?.stockRecommendations ?? []
			).filter(
				(item) => item.recommendedOrderUnits > 0,
			);
			const productPackSizeById = new Map(
				products.map((product) => [
					product.id,
					Math.max(product.packSize || 1, 1),
				]),
			);

			const perProductRecentMeta = new Map<
				string,
				{ supplierId: string; unitCostCents: number }
			>();
			const bestContractByProduct = new Map<
				string,
				{ supplierId: string; unitCostCents: number }
			>();

			for (const supplierPrice of supplierPrices) {
				if (
					!supplierPrice.productId ||
					!supplierPrice.supplierId ||
					supplierPrice.unitCostCents <= 0
				) {
					continue;
				}
				const existing = bestContractByProduct.get(
					supplierPrice.productId,
				);
				if (
					!existing ||
					supplierPrice.unitCostCents <
						existing.unitCostCents
				) {
					bestContractByProduct.set(
						supplierPrice.productId,
						{
							supplierId:
								supplierPrice.supplierId,
							unitCostCents:
								supplierPrice.unitCostCents,
						},
					);
				}
			}

			for (const purchase of purchaseHistory) {
				for (const item of purchase.items ?? []) {
					if (
						!item.productId ||
						perProductRecentMeta.has(
							item.productId,
						)
					) {
						continue;
					}
					perProductRecentMeta.set(item.productId, {
						supplierId:
							purchase.supplierId ?? "",
						unitCostCents:
							item.unitCostCents ?? 0,
					});
				}
			}

			const restockItems = recommendations.map(
				(item) => {
					const contractBest =
						bestContractByProduct.get(
							item.productId,
						);
					const recent =
						perProductRecentMeta.get(
							item.productId,
						);
					const selectedMeta =
						contractBest ?? recent;
					const packSize =
						productPackSizeById.get(
							item.productId,
						) ?? 1;
					const recommendedUnits =
						item.recommendedOrderUnits;
					const cases = Math.floor(
						recommendedUnits / packSize,
					);
					const singles =
						recommendedUnits % packSize;
					return {
						productId: item.productId,
						cases:
							cases > 0 ? String(cases) : "",
						singles:
							singles > 0
								? String(singles)
								: "",
						lineSubtotalCents:
							Math.max(
								0,
								recommendedUnits *
									(selectedMeta?.unitCostCents ??
										0),
							),
						suggestedSupplierId:
							selectedMeta?.supplierId ?? "",
					};
				},
			);

			const supplierFrequency = new Map<
				string,
				number
			>();
			for (const item of restockItems) {
				if (!item.suggestedSupplierId) continue;
				supplierFrequency.set(
					item.suggestedSupplierId,
					(supplierFrequency.get(
						item.suggestedSupplierId,
					) ?? 0) + 1,
				);
			}
			const sortedSuppliers = Array.from(
				supplierFrequency.entries(),
			).sort((a, b) => b[1] - a[1]);
			const initialSupplierId =
				sortedSuppliers[0]?.[0] ?? "";

			return {
				items: restockItems.map(
					({ suggestedSupplierId, ...rest }) =>
						rest,
				),
				initialSupplierId,
			};
		},
		[report, purchaseHistory, products, supplierPrices],
	);

	React.useEffect(() => {
		try {
			const raw = localStorage.getItem(
				QUICK_ACTION_STORAGE_KEY,
			);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return;
			const next = parsed
				.filter((value): value is QuickAction =>
					QUICK_ACTION_ALL.includes(
						value as QuickAction,
					),
				)
				.slice(0, 5);
			if (next.length > 0) {
				setFavoriteActions(next);
			}
		} catch {
			// Ignore invalid local preference payloads.
		}
	}, []);

	const persistFavorites = React.useCallback(
		(next: QuickAction[]) => {
			setFavoriteActions(next);
			try {
				localStorage.setItem(
					QUICK_ACTION_STORAGE_KEY,
					JSON.stringify(next),
				);
			} catch {
				// Ignore localStorage write failures.
			}
		},
		[],
	);

	const onSaved = async () => {
		await Promise.all([
			mutate(
				(key) =>
					typeof key === "string" &&
					key.startsWith("/api/products"),
			),
			mutate(
				(key) =>
					typeof key === "string" &&
					key.startsWith("/api/purchases"),
			),
			mutate(
				(key) =>
					typeof key === "string" &&
					key.startsWith("/api/adjustments"),
			),
			mutate(
				(key) =>
					typeof key === "string" &&
					key.startsWith("/api/transactions"),
			),
			mutate(
				(key) =>
					typeof key === "string" &&
					key.startsWith("/api/customers"),
			),
			mutate(
				(key) =>
					typeof key === "string" &&
					key.startsWith("/api/suppliers"),
			),
			mutate(
				(key) =>
					typeof key === "string" &&
					key.startsWith("/api/supplier-prices"),
			),
			mutate(
				(key) =>
					typeof key === "string" &&
					key.startsWith("/api/reports"),
			),
		]);
		setActiveAction(null);
	};

	const openAction = React.useCallback(
		(action: QuickAction) => {
			pushQuickAddDebugLog("open_action_clicked", {
				action,
				pathname,
			});
			setActiveAction(action);
			setOpen(false);
		},
		[pathname],
	);

	const toggleFavoriteAction = React.useCallback(
		(action: QuickAction) => {
			const isFavorite =
				favoriteActions.includes(action);
			if (isFavorite) {
				const next = favoriteActions.filter(
					(value) => value !== action,
				);
				persistFavorites(next);
				return;
			}
			if (favoriteActions.length >= 5) {
				toast.error(
					"You can pin up to 5 quick actions.",
				);
				return;
			}
			persistFavorites([...favoriteActions, action]);
		},
		[favoriteActions, persistFavorites],
	);

	const renderQuickActionButton = (
		action: QuickAction,
		variant?: "outline" | "secondary",
	) => (
		<ActionBtn
			label={getQuickActionLabel(
				action,
				restockSeed.items.length,
			)}
			icon={getQuickActionIcon(action)}
			variant={variant}
			onClick={() => openAction(action)}
			disabled={
				action === "restock" &&
				restockSeed.items.length === 0
			}
		/>
	);
	const showInMoreActions = (action: QuickAction) =>
		!favoriteActions.includes(action) &&
		!pagePrimaryActions.includes(action);
	const pagePrimaryActions = React.useMemo<
		QuickAction[]
	>(() => {
		if (pathname.startsWith("/products")) {
			return ["product"];
		}
		if (pathname.startsWith("/purchases")) {
			return ["purchase"];
		}
		if (pathname.startsWith("/suppliers")) {
			return ["supplier"];
		}
		if (
			pathname.startsWith("/purchase-assistant")
		) {
			return ["restock"];
		}
		if (pathname.startsWith("/adjustments")) {
			return ["adjustment"];
		}
		if (pathname.startsWith("/tabs")) {
			return ["customer"];
		}
		if (pathname.startsWith("/transactions")) {
			return ["quick-checkout"];
		}
		if (pathname.startsWith("/reports")) {
			return ["quick-top-sellers"];
		}
		if (pathname.startsWith("/dashboard")) {
			return ["quick-checkout"];
		}
		return [];
	}, [pathname]);
	const visiblePagePrimaryActions = pagePrimaryActions;
	const visiblePinnedActions = React.useMemo(
		() =>
			favoriteActions.filter(
				(action) =>
					!pagePrimaryActions.includes(action),
			),
		[favoriteActions, pagePrimaryActions],
	);

	if (!show) return null;

	return (
		<>
			<div className="fixed bottom-4 right-4 z-40">
				<Popover
					open={open}
					onOpenChange={(isOpen) => {
						setOpen(isOpen);
						if (!isOpen) {
							setShowMoreActions(false);
							setShowPinShortcuts(false);
						}
					}}
				>
					<PopoverTrigger asChild>
						<Button
							size="icon"
							className="h-12 w-12 rounded-full shadow-lg"
						>
							<Plus className="h-5 w-5" />
							<span className="sr-only">
								Open quick actions
							</span>
						</Button>
					</PopoverTrigger>
					<PopoverContent
						side="top"
						align="end"
						className="w-[calc(100vw-2rem)] max-w-sm p-2 md:w-80"
					>
						<div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
							{visiblePagePrimaryActions.length > 0 && (
								<>
									<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
										This Page
									</p>
									{visiblePagePrimaryActions.map(
										(action, index) => (
											<React.Fragment
												key={`${action}-${index}`}
											>
												{renderQuickActionButton(
													action,
													"secondary",
												)}
											</React.Fragment>
										),
									)}
								</>
							)}
							<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
								Pinned
							</p>
							{visiblePinnedActions.length === 0 ? (
								<p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
									No pinned actions. Use Pin Shortcuts to manage pins.
								</p>
							) : (
								visiblePinnedActions.map((action) => (
									<React.Fragment key={action}>
										{renderQuickActionButton(
											action,
											action === "quick-checkout"
												? "secondary"
												: "outline",
										)}
									</React.Fragment>
								))
							)}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="justify-between px-2"
								onClick={() =>
									setShowPinShortcuts((prev) => !prev)
								}
							>
								<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									Pin Shortcuts
								</span>
								{showPinShortcuts ? (
									<ChevronUp className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								)}
							</Button>
							{showPinShortcuts && (
								<div className="rounded-md border p-2">
									<div className="grid grid-cols-1 gap-1">
										{QUICK_ACTION_ALL.map((action) => {
											const pinned =
												favoriteActions.includes(
													action,
												);
											return (
												<Button
													key={action}
													type="button"
													variant="ghost"
													size="sm"
													className="justify-between"
													onClick={() =>
														toggleFavoriteAction(
															action,
														)
													}
												>
													<span className="truncate text-sm">
														{getQuickActionLabel(
															action,
															restockSeed.items.length,
														)}
													</span>
													<Star
														className={`h-4 w-4 ${
															pinned
																? "fill-current text-amber-500"
																: "text-muted-foreground"
														}`}
													/>
												</Button>
											);
										})}
									</div>
								</div>
							)}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="justify-between px-2"
								onClick={() =>
									setShowMoreActions((prev) => !prev)
								}
							>
								<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									More Actions
								</span>
								{showMoreActions ? (
									<ChevronUp className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								)}
							</Button>
							{showMoreActions && (
								<div className="space-y-2 rounded-md border p-2">
									<div className="space-y-2 pt-1">
										<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
											Sales
										</p>
										<div className="space-y-2">
											{showInMoreActions(
												"quick-checkout",
											) &&
												renderQuickActionButton(
													"quick-checkout",
												)}
											{showInMoreActions(
												"quick-top-sellers",
											) &&
												renderQuickActionButton(
													"quick-top-sellers",
												)}
											{showInMoreActions(
												"quick-fast-repeat",
											) &&
												renderQuickActionButton(
													"quick-fast-repeat",
												)}
											{showInMoreActions(
												"account-sale",
											) &&
												renderQuickActionButton(
													"account-sale",
												)}
										</div>
									</div>
									<div className="space-y-2">
										<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
											Customers
										</p>
										<div className="space-y-2">
											{showInMoreActions(
												"customer",
											) &&
												renderQuickActionButton(
													"customer",
												)}
											{showInMoreActions(
												"account-payment",
											) &&
												renderQuickActionButton(
													"account-payment",
												)}
											{showInMoreActions(
												"expense",
											) &&
												renderQuickActionButton(
													"expense",
												)}
										</div>
									</div>
									<div className="space-y-2 pt-1">
										<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
											Suppliers
										</p>
										<div className="space-y-2">
											{showInMoreActions(
												"supplier",
											) &&
												renderQuickActionButton(
													"supplier",
												)}
											{showInMoreActions(
												"supplier-price",
											) &&
												renderQuickActionButton(
													"supplier-price",
												)}
										</div>
									</div>
									<div className="space-y-2 pt-1">
										<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
											Inventory
										</p>
										<div className="space-y-2">
											{showInMoreActions(
												"opening-stock",
											) &&
												renderQuickActionButton(
													"opening-stock",
												)}
											{showInMoreActions(
												"product",
											) &&
												renderQuickActionButton(
													"product",
												)}
											{showInMoreActions(
												"adjustment",
											) &&
												renderQuickActionButton(
													"adjustment",
												)}
										</div>
									</div>
								</div>
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>

			<Dialog
				open={activeAction !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setActiveAction(null);
				}}
			>
				{activeAction === "quick-checkout" && (
					<ActionDialog
						title="Quick Checkout"
						description={`Search, select, or scan and save paid sale for ${formatDateDisplay(date)}.`}
					>
						<QuickCheckoutForm
							products={products}
							quickProducts={
								(report?.trends
									?.topProducts ?? []
								)
									.map((item) =>
										products.find(
											(product) =>
												product.id ===
												item.productId,
										),
									)
									.filter(
										(
											product,
										): product is Product =>
											Boolean(
												product,
											),
									)
									.map((product) => ({
										id: product.id,
										name: product.name,
									}))
							}
							date={date}
							mode="default"
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "quick-top-sellers" && (
					<ActionDialog
						title="Top Sellers Sale"
						description={`Quick add from top sellers for ${formatDateDisplay(date)}.`}
					>
						<QuickCheckoutForm
							products={products}
							quickProducts={
								(report?.trends
									?.topProducts ?? []
								)
									.map((item) =>
										products.find(
											(product) =>
												product.id ===
												item.productId,
										),
									)
									.filter(
										(
											product,
										): product is Product =>
											Boolean(
												product,
											),
									)
									.map((product) => ({
										id: product.id,
										name: product.name,
									}))
							}
							date={date}
							mode="top-sellers"
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "quick-fast-repeat" && (
					<ActionDialog
						title="Fast Repeat Sale"
						description={`Repeat recent sales quickly for ${formatDateDisplay(date)}.`}
					>
						<QuickCheckoutForm
							products={products}
							quickProducts={
								(report?.trends
									?.topProducts ?? []
								)
									.map((item) =>
										products.find(
											(product) =>
												product.id ===
												item.productId,
										),
									)
									.filter(
										(
											product,
										): product is Product =>
											Boolean(
												product,
											),
									)
									.map((product) => ({
										id: product.id,
										name: product.name,
									}))
							}
							date={date}
							mode="fast-repeat"
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "account-sale" && (
					<ActionDialog
						title="Add Sale to Account"
						description={`Record a customer account sale for ${formatDateDisplay(date)}.`}
					>
						<AccountSaleForm
							products={products}
							customers={customers}
							date={date}
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "account-payment" && (
					<ActionDialog
						title="Record Account Payment"
						description={`Save a customer payment for ${formatDateDisplay(date)}.`}
					>
						<AccountPaymentForm
							customers={customers}
							date={date}
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "expense" && (
					<ActionDialog
						title="Record Expense"
						description={`Save a business expense for ${formatDateDisplay(date)}.`}
					>
						<ExpenseForm
							date={date}
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "customer" && (
					<ActionDialog
						title="Add Customer"
						description="Create a customer account for credit purchases and payments."
					>
						<AddCustomerForm
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "product" && (
					<ActionDialog
						title="Add Product"
						description="Add a new product to your catalog."
					>
						<AddProductForm onSuccess={onSaved} />
					</ActionDialog>
				)}
				{activeAction === "supplier" && (
					<ActionDialog
						title="Add Supplier"
						description="Create a supplier with contact details for purchase planning."
					>
						<AddSupplierForm onSuccess={onSaved} />
					</ActionDialog>
				)}
				{activeAction === "supplier-price" && (
					<ActionDialog
						title="Set Supplier Cost"
						description="Set a supplier-specific unit cost for a product."
					>
						<AddSupplierPriceForm
							products={products}
							suppliers={suppliers}
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "purchase" && (
					<ActionDialog
						title="Add Purchase"
						description={`Record stock purchase for ${formatDateDisplay(date)}.`}
					>
						<AddPurchaseForm
							products={products}
							suppliers={suppliers}
							date={date}
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "restock" && (
					<ActionDialog
						title="Restock Low Stock"
						description={`Prefilled from stock recommendations for ${formatDateDisplay(date)}.`}
					>
						<AddPurchaseForm
							products={products}
							suppliers={suppliers}
							date={date}
							initialItems={restockSeed.items}
							initialSupplierId={
								restockSeed.initialSupplierId
							}
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "adjustment" && (
					<ActionDialog
						title="Stock Adjustment"
						description={`Add one or more stock adjustments for ${formatDateDisplay(date)}.`}
					>
						<AddAdjustmentForm
							products={products}
							date={date}
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "opening-stock" && (
					<ActionDialog
						title="Add Existing Stock"
						description={`Capture existing on-hand stock for ${formatDateDisplay(date)}.`}
					>
						<AddAdjustmentForm
							products={products}
							date={date}
							fixedReason="OPENING_STOCK"
							positiveOnly
							successMessage="Existing stock captured successfully"
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
			</Dialog>
		</>
	);
}

function ActionBtn({
	label,
	icon,
	onClick,
	variant = "outline",
	disabled = false,
}: {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	variant?: "outline" | "secondary";
	disabled?: boolean;
}) {
	return (
		<Button
			type="button"
			variant={variant}
			className="justify-start"
			onClick={onClick}
			disabled={disabled}
		>
			{icon}
			{label}
		</Button>
	);
}

function ActionDialog({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<DialogContent
			className={MODAL_CONTENT_CLASS}
		>
			<DialogHeader className="h-16 shrink-0 space-y-0.5 border-b px-4 py-1.5">
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription className="text-xs leading-tight">
					{description}
				</DialogDescription>
			</DialogHeader>
			{children}
		</DialogContent>
	);
}

function SaveFooter({
	disabled,
	loading,
	label = "Save",
}: {
	disabled: boolean;
	loading: boolean;
	label?: string;
}) {
	return (
		<div className="shrink-0 border-t px-4 py-3">
			<Button
				type="submit"
				className="w-full"
				disabled={disabled}
			>
				{loading ? "Saving..." : label}
			</Button>
		</div>
	);
}

function QuickCheckoutForm({
	products,
	quickProducts,
	mode = "default",
	date,
	onSuccess,
}: {
	products: Product[];
	quickProducts: QuickProductLite[];
	mode?: "default" | "top-sellers" | "fast-repeat";
	date: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [scanInput, setScanInput] =
		React.useState("");
	const [isMobilePicker, setIsMobilePicker] =
		React.useState(false);
	const [items, setItems] = React.useState<
		ChargeItem[]
	>([]);
	const [paymentMethod, setPaymentMethod] =
		React.useState<PaymentMethod>("CASH");
	const [cashReceivedCents, setCashReceivedCents] =
		React.useState(0);
	const scanInputRef =
		React.useRef<HTMLInputElement | null>(null);
	const lastScanKeyTsRef = React.useRef(0);
	const fastKeyStreakRef = React.useRef(0);
	const autoAddTimerRef = React.useRef<
		ReturnType<typeof setTimeout> | null
	>(null);
	const { data: txnHistory = [] } = useSWR<
		DirectSaleHistoryLite[]
	>(
		`/api/transactions?date=${date}&limit=60&type=DIRECT_SALE&fields=quick`,
		fetcher,
	);
	React.useEffect(() => {
		pushQuickAddDebugLog("quick_checkout_form_mounted", {
			mode,
			date,
			productsCount: products.length,
		});
	}, [mode, date, products.length]);

	const productMap = React.useMemo(
		() => new Map(products.map((p) => [p.id, p])),
		[products],
	);
	const productByBarcode = React.useMemo(
		() =>
			new Map(
				products
					.filter((p) => Boolean(p.barcode))
					.map((p) => [
						String(p.barcode)
							.trim()
							.toLowerCase(),
						p.id,
					]),
			),
		[products],
	);
	const repeatTemplates = React.useMemo(() => {
		const unique = new Map<
			string,
			DirectSaleHistoryLite
		>();
		for (const txn of txnHistory) {
			if (
				txn.type !== "DIRECT_SALE" ||
				txn.isReversal ||
				txn.isReversed
			) {
				continue;
			}
			const validItems = (txn.items ?? []).filter(
				(item) =>
					item.productId &&
					(item.units ?? 0) > 0,
			);
			if (!validItems.length) continue;
			const signature = [
				txn.paymentMethod ?? "CASH",
				...validItems
					.map((item) =>
						[item.productId, item.units].join(":"),
					)
					.sort(),
			].join("|");
			if (!unique.has(signature)) {
				unique.set(signature, txn);
			}
			if (unique.size >= 8) break;
		}
		return Array.from(unique.values());
	}, [txnHistory]);
	const isJourneyMode = mode !== "default";
	const [journeyStep, setJourneyStep] =
		React.useState<1 | 2 | 3>(
			isJourneyMode ? 1 : 2,
		);
	const [
		selectedTopSellerIds,
		setSelectedTopSellerIds,
	] = React.useState<string[]>([]);
	const [selectedTemplateId, setSelectedTemplateId] =
		React.useState<string | null>(null);

	const applyFastRepeat = React.useCallback(
		(template: DirectSaleHistoryLite) => {
			const nextItems = (template.items ?? [])
				.filter(
					(item) =>
						item.productId &&
						(item.units ?? 0) > 0,
				)
				.map((item) => ({
					productId: item.productId,
					units: String(item.units),
				}));
			if (!nextItems.length) {
				toast.error(
					"That sale has no valid items to repeat",
				);
				return;
			}
			setItems(nextItems);
			setPaymentMethod(
				template.paymentMethod ?? "CASH",
			);
			requestAnimationFrame(() =>
				scanInputRef.current?.focus(),
			);
		},
		[],
	);

	React.useEffect(() => {
		if (mode === "default") {
			setJourneyStep(2);
			return;
		}
		setJourneyStep(1);
		setSelectedTopSellerIds([]);
		setSelectedTemplateId(null);
	}, [mode]);

	React.useEffect(() => {
		if (!scanInputRef.current) return;
		scanInputRef.current.focus();
	}, []);

	React.useEffect(() => {
		return () => {
			if (autoAddTimerRef.current) {
				clearTimeout(autoAddTimerRef.current);
			}
		};
	}, []);

	const resolveProductIdFromInput = React.useCallback(
		(rawInput: string) => {
			const query = rawInput.trim().toLowerCase();
			if (!query) return null;
			const barcodeMatch = productByBarcode.get(query);
			if (barcodeMatch) return barcodeMatch;
			const exactNameMatch = products.find(
				(product) =>
					product.name.trim().toLowerCase() ===
						query ||
					product.id.toLowerCase() === query,
			);
			if (exactNameMatch) return exactNameMatch.id;
			const startsWithMatch = products.find((product) =>
				product.name.toLowerCase().startsWith(query),
			);
			if (startsWithMatch) return startsWithMatch.id;
			const includesMatch = products.find((product) =>
				product.name.toLowerCase().includes(query),
			);
			return includesMatch?.id ?? null;
		},
		[products, productByBarcode],
	);
	const resolveExactProductId = React.useCallback(
		(rawInput: string) => {
			const query = rawInput.trim().toLowerCase();
			if (!query) return null;
			const barcodeMatch = productByBarcode.get(query);
			if (barcodeMatch) return barcodeMatch;
			const exactNameMatch = products.find(
				(product) =>
					product.name.trim().toLowerCase() ===
						query ||
					product.id.toLowerCase() === query,
			);
			return exactNameMatch?.id ?? null;
		},
		[products, productByBarcode],
	);
	const matchedProductId = React.useMemo(
		() => resolveProductIdFromInput(scanInput),
		[resolveProductIdFromInput, scanInput],
	);
	const matchedProductName = matchedProductId
		? productMap.get(matchedProductId)?.name ??
			matchedProductId
		: "";

	const addByInput = React.useCallback(
		(rawInput: string, unitsToAdd?: number) => {
			const productId =
				resolveProductIdFromInput(rawInput);
			pushQuickAddDebugLog("quick_checkout_add_by_input", {
				rawInput,
				resolvedProductId: productId,
				unitsToAdd: unitsToAdd ?? 1,
			});
			if (!productId) {
				toast.error(
					`No product match for "${rawInput.trim()}"`,
				);
				pushQuickAddDebugLog("quick_checkout_no_match", {
					rawInput,
				});
				return;
			}
			const qty =
				Math.max(
					1,
					unitsToAdd ?? 1,
				) || 1;
			setItems((prev) => {
				const existingIndex = prev.findIndex(
					(item) => item.productId === productId,
				);
				if (existingIndex >= 0) {
					return prev.map((item, index) =>
						index === existingIndex
							? {
									...item,
									units: String(
										(parseInt(
											item.units,
											10,
										) || 0) + qty,
									),
							  }
							: item,
					);
				}
				return [
					...prev,
					{
						productId,
						units: String(qty),
					},
				];
			});
			setScanInput("");
			requestAnimationFrame(() =>
				scanInputRef.current?.focus(),
			);
		},
		[resolveProductIdFromInput],
	);
	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia(
			"(max-width: 768px), (pointer: coarse)",
		);
		const apply = () => {
			setIsMobilePicker(mq.matches);
			pushQuickAddDebugLog("quick_checkout_mobile_state", {
				matches: mq.matches,
				innerWidth: window.innerWidth,
				innerHeight: window.innerHeight,
				devicePixelRatio: window.devicePixelRatio,
				userAgent: navigator.userAgent,
			});
		};
		apply();
		mq.addEventListener("change", apply);
		return () =>
			mq.removeEventListener("change", apply);
	}, []);
	React.useEffect(() => {
		if (!isMobilePicker) return;
		if (!scanInput.trim()) return;
		const exactProductId =
			resolveExactProductId(scanInput);
		pushQuickAddDebugLog("quick_checkout_mobile_debounce_check", {
			scanInput,
			exactProductId,
			isMobilePicker,
		});
		if (!exactProductId) return;
		const timer = setTimeout(() => {
			pushQuickAddDebugLog(
				"quick_checkout_mobile_debounce_auto_add",
				{
					scanInput,
					exactProductId,
				},
			);
			addByInput(scanInput);
		}, 120);
		return () => clearTimeout(timer);
	}, [
		isMobilePicker,
		scanInput,
		resolveExactProductId,
		addByInput,
	]);

	const adjustUnits = (
		productId: string,
		delta: number,
	) => {
		setItems((prev) =>
			prev
				.map((item) => {
					if (item.productId !== productId)
						return item;
					const nextUnits =
						(parseInt(item.units, 10) || 0) + delta;
					return {
						...item,
						units: String(nextUnits),
					};
				})
				.filter(
					(item) =>
						(parseInt(item.units, 10) || 0) > 0,
				),
		);
	};

	const setUnits = (
		productId: string,
		nextUnits: number,
	) => {
		setItems((prev) =>
			prev
				.map((item) =>
					item.productId === productId
						? {
								...item,
								units: String(nextUnits),
						  }
						: item,
				)
				.filter(
					(item) =>
						(parseInt(item.units, 10) || 0) > 0,
				),
		);
	};

	const removeItem = (productId: string) => {
		setItems((prev) =>
			prev.filter(
				(item) => item.productId !== productId,
			),
		);
	};

	const addProductUnits = React.useCallback(
		(productId: string, unitsToAdd: number) => {
			if (!productId || unitsToAdd <= 0) return;
			setItems((prev) => {
				const existingIndex = prev.findIndex(
					(item) => item.productId === productId,
				);
				if (existingIndex >= 0) {
					return prev.map((item, index) =>
						index === existingIndex
							? {
									...item,
									units: String(
										(parseInt(
											item.units,
											10,
										) || 0) + unitsToAdd,
									),
							  }
							: item,
					);
				}
				return [
					...prev,
					{
						productId,
						units: String(unitsToAdd),
					},
				];
			});
			requestAnimationFrame(() =>
				scanInputRef.current?.focus(),
			);
		},
		[],
	);
	const toggleTopSellerSelection = React.useCallback(
		(productId: string) => {
			setSelectedTopSellerIds((prev) =>
				prev.includes(productId)
					? prev.filter((id) => id !== productId)
					: [...prev, productId],
			);
		},
		[],
	);
	const continueTopSellersJourney = () => {
		if (selectedTopSellerIds.length === 0) {
			toast.error("Select at least one top seller");
			return;
		}
		setItems(
			selectedTopSellerIds.map((productId) => ({
				productId,
				units: "1",
			})),
		);
		setJourneyStep(2);
		requestAnimationFrame(() =>
			scanInputRef.current?.focus(),
		);
	};
	const startFastRepeatJourney = (
		template: DirectSaleHistoryLite,
	) => {
		applyFastRepeat(template);
		setSelectedTemplateId(template.id);
		setJourneyStep(2);
	};

	const scheduleAutoAdd = React.useCallback(
		(rawCode: string) => {
			if (autoAddTimerRef.current) {
				clearTimeout(autoAddTimerRef.current);
			}
			autoAddTimerRef.current = setTimeout(() => {
				addByInput(rawCode);
			}, 80);
		},
		[addByInput],
	);

	const totalCents = React.useMemo(
		() =>
			items.reduce((sum, item) => {
				const units = parseInt(item.units, 10) || 0;
				const unitPrice =
					productMap.get(item.productId)
						?.currentPriceCents ?? 0;
				return sum + units * unitPrice;
			}, 0),
		[items, productMap],
	);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		if (
			paymentMethod === "CASH" &&
			journeyStep !== 3
		) {
			setJourneyStep(3);
			return;
		}
		if (
			paymentMethod === "CASH" &&
			cashReceivedCents < totalCents
		) {
			toast.error(
				"Cash received is less than the sale total.",
			);
			return;
		}
		setLoading(true);

		const validItems = items
			.map((item) => ({
				productId: item.productId,
				units: parseInt(item.units, 10) || 0,
			}))
			.filter((item) => item.units > 0);

		if (!validItems.length) {
			toast.error("Scan at least one item");
			setLoading(false);
			return;
		}

		try {
			const payload: Record<string, unknown> = {
				date,
				paymentMethod,
				cashReceivedCents:
					paymentMethod === "CASH"
						? cashReceivedCents
						: undefined,
				items: validItems,
			};
			let queueResult = await postSaleWithOfflineQueue(
				"/api/sales",
				payload,
			);
			if (queueResult.queued) {
				toast.success(
					"Offline: checkout queued and will sync automatically.",
				);
				setItems([]);
				setScanInput("");
				setCashReceivedCents(0);
				fastKeyStreakRef.current = 0;
				setJourneyStep(isJourneyMode ? 1 : 2);
				requestAnimationFrame(() =>
					scanInputRef.current?.focus(),
				);
				onSuccess();
				return;
			}
			let res = queueResult.response;
			if (!res.ok) {
				let errorBody = await res
					.json()
					.catch(() => ({}));
				const errorCode =
					getApiErrorCode(errorBody);
				if (errorCode === "BELOW_COST") {
					const proceed = window.confirm(
						`${getApiErrorMessage(
							errorBody,
							"Below-cost sale detected.",
						)}\n\nProceed with override?`,
					);
					if (proceed) {
						payload.belowCostApproved = true;
						payload.belowCostReason =
							"User override from quick checkout";
						queueResult =
							await postSaleWithOfflineQueue(
								"/api/sales",
								payload,
							);
						if (queueResult.queued) {
							toast.success(
								"Offline: checkout queued and will sync automatically.",
							);
							setItems([]);
							setScanInput("");
							setCashReceivedCents(0);
							fastKeyStreakRef.current = 0;
							setJourneyStep(
								isJourneyMode
									? 1
									: 2,
							);
							requestAnimationFrame(() =>
								scanInputRef.current?.focus(),
							);
							onSuccess();
							return;
						}
						res = queueResult.response;
						if (!res.ok) {
							errorBody =
								await res
									.json()
									.catch(
										() => ({}),
									);
						}
					}
				}
				if (!res.ok) {
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to complete checkout",
					),
				);
				}
			}
			toast.success("Checkout saved");
			setItems([]);
			setScanInput("");
			setCashReceivedCents(0);
			fastKeyStreakRef.current = 0;
			setJourneyStep(isJourneyMode ? 1 : 2);
			requestAnimationFrame(() =>
				scanInputRef.current?.focus(),
			);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to complete checkout",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				{isJourneyMode && journeyStep === 1 ? (
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
						<div className="rounded-md border p-3">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Step 1 of 2
							</p>
							<p className="text-sm font-medium">
								{mode === "fast-repeat"
									? "Choose a recent sale"
									: "Choose top-seller items"}
							</p>
							<p className="text-xs text-muted-foreground">
								{mode === "fast-repeat"
									? "Select one sale template, then review and adjust items."
									: "Pick items to start from, then review and adjust quantities."}
							</p>
						</div>

						{mode === "fast-repeat" ? (
							repeatTemplates.length === 0 ? (
								<p className="rounded-md border p-3 text-sm text-muted-foreground">
									No repeatable sales yet.
								</p>
							) : (
								repeatTemplates.map((template) => {
									const itemCount =
										(template.items ?? []).length;
									const firstItemName =
										productMap.get(
											template.items?.[0]
												?.productId ?? "",
										)?.name ?? "Sale";
									const selected =
										selectedTemplateId === template.id;
									return (
										<button
											key={template.id}
											type="button"
											className={`w-full rounded-md border p-3 text-left ${
												selected
													? "border-amber-500 bg-amber-50/40"
													: "hover:bg-accent/40"
											}`}
											onClick={() =>
												startFastRepeatJourney(
													template,
												)
											}
										>
											<p className="font-medium">
												{firstItemName}
												{itemCount > 1
													? ` +${itemCount - 1}`
													: ""}
											</p>
											<p className="text-xs text-muted-foreground">
												{template.paymentMethod ?? "CASH"} |{" "}
												{itemCount} item
												{itemCount === 1 ? "" : "s"}
											</p>
										</button>
									);
								})
							)
						) : quickProducts.length === 0 ? (
							<p className="rounded-md border p-3 text-sm text-muted-foreground">
								No top sellers found for this date.
							</p>
						) : (
							<div className="space-y-2">
								{quickProducts.map((product) => {
									const selected =
										selectedTopSellerIds.includes(
											product.id,
										);
									return (
										<button
											key={product.id}
											type="button"
											className={`w-full rounded-md border px-3 py-2 text-left ${
												selected
													? "border-amber-500 bg-amber-50/40"
													: "hover:bg-accent/40"
											}`}
											onClick={() =>
												toggleTopSellerSelection(
													product.id,
												)
											}
										>
											{product.name}
										</button>
									);
								})}
							</div>
						)}
						{mode === "top-sellers" && (
							<div className="shrink-0 border-t pt-3">
								<Button
									type="button"
									className="w-full"
									onClick={continueTopSellersJourney}
								>
									Continue to Edit
								</Button>
							</div>
						)}
					</div>
				) : journeyStep === 3 ? (
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
						<div className="rounded-md border p-3">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Cash Settlement
							</p>
							<p className="text-sm font-medium">
								Enter cash received
							</p>
							<p className="text-xs text-muted-foreground">
								Total due: {formatZAR(totalCents)}
							</p>
						</div>
						<CashChangeCalculator
							totalCents={totalCents}
							cashReceivedCents={cashReceivedCents}
							onCashReceivedChange={setCashReceivedCents}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setJourneyStep(2)}
						>
							Back to Items
						</Button>
					</div>
				) : (
					<>
				<div className="space-y-2">
					<Label>Search / Select / Scan Product</Label>
					<div className="flex gap-2">
						<Input
							ref={scanInputRef}
							value={scanInput}
							list="quick-checkout-product-options"
							onChange={(e) => {
								const nextValue =
									e.target.value;
								const nativeEvent =
									e.nativeEvent as Event & {
										inputType?: string;
									};
								const inputType =
									nativeEvent.inputType ?? "";
								const now = Date.now();
								const addedChars =
									nextValue.length -
									scanInput.length;
								const exactProductId =
									resolveExactProductId(
										nextValue,
									);
								const cameFromPickerLikeAction =
									inputType ===
										"insertReplacementText" ||
									inputType ===
										"insertFromPaste" ||
									addedChars > 1 ||
									(scanInput.length > 0 &&
										nextValue.length > 0 &&
										!nextValue.startsWith(
											scanInput,
										));
								pushQuickAddDebugLog(
									"quick_checkout_input_change",
									{
										prevValue: scanInput,
										nextValue,
										inputType,
										addedChars,
										exactProductId,
										isMobilePicker,
										cameFromPickerLikeAction,
										fastKeyStreak:
											fastKeyStreakRef.current,
									},
								);

								if (addedChars === 1) {
									const delta =
										now -
										lastScanKeyTsRef.current;
									if (delta > 0 && delta < 35) {
										fastKeyStreakRef.current += 1;
									} else {
										fastKeyStreakRef.current = 0;
									}
									if (
										fastKeyStreakRef.current >=
											5 &&
										nextValue.trim().length >=
											6
									) {
										pushQuickAddDebugLog(
											"quick_checkout_scan_burst_detected",
											{
												nextValue,
												fastKeyStreak:
													fastKeyStreakRef.current,
											},
										);
										scheduleAutoAdd(
											nextValue,
										);
									}
								} else if (
									nextValue.length === 0
								) {
									fastKeyStreakRef.current = 0;
								}

								lastScanKeyTsRef.current = now;
								setScanInput(nextValue);
								if (
									(isMobilePicker ||
										cameFromPickerLikeAction) &&
									exactProductId &&
									nextValue.trim().length > 0
								) {
									pushQuickAddDebugLog(
										"quick_checkout_immediate_auto_add",
										{
											nextValue,
											exactProductId,
											isMobilePicker,
											cameFromPickerLikeAction,
										},
									);
									addByInput(nextValue);
								}
							}}
							onKeyDown={(e) => {
								if (e.key !== "Enter") return;
								e.preventDefault();
								pushQuickAddDebugLog(
									"quick_checkout_enter_pressed",
									{ scanInput },
								);
								addByInput(scanInput);
							}}
							placeholder="Type name or scan barcode, then Enter"
						/>
						<datalist id="quick-checkout-product-options">
							{products.flatMap((product) => [
								<option
									key={`${product.id}-name`}
									value={product.name}
								/>,
								...(product.barcode
									? [
											<option
												key={`${product.id}-barcode`}
												value={String(
													product.barcode,
												)}
											/>,
									  ]
									: []),
							])}
						</datalist>
					</div>
					{scanInput.trim().length > 0 &&
						(matchedProductId ? (
							<p className="text-xs text-emerald-700">
								Selected:{" "}
								<span className="font-medium">
									{matchedProductName}
								</span>
								{" - "}Press Enter to add.
							</p>
						) : (
							<p className="text-xs text-muted-foreground">
								No product match yet.
							</p>
						))}
					{items.length > 0 && (
						<p className="text-xs text-muted-foreground">
							Type, select, or scan to add.
						</p>
					)}
				</div>

				<div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
					<Label>Items</Label>
					{items.length === 0 ? (
						<p className="rounded-md border p-3 text-sm text-muted-foreground">
							No items yet. Scan a barcode to add.
						</p>
					) : (
						items.map((item) => {
							const product =
								productMap.get(item.productId);
							const units =
								parseInt(item.units, 10) || 0;
							const subtotalCents =
								(product?.currentPriceCents ??
									0) * units;
							return (
								<div
									key={item.productId}
									className="rounded-md border p-2"
								>
									<div className="mb-2 flex items-start justify-between gap-2">
										<p className="font-medium">
											{product?.name ??
												item.productId}
										</p>
										<p className="text-sm font-semibold">
											{formatZAR(subtotalCents)}
										</p>
									</div>
									<div className="grid grid-cols-4 gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												adjustUnits(
													item.productId,
													-1,
												)
											}
										>
											-
										</Button>
										<Input
											value={units}
											onChange={(e) => {
												const next =
													parseInt(
														e.target.value,
														10,
													) || 0;
												setUnits(
													item.productId,
													next,
												);
											}}
											className="text-center"
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												adjustUnits(
													item.productId,
													1,
												)
											}
										>
											+
										</Button>
										<Button
											type="button"
											variant="destructive"
											size="sm"
											onClick={() =>
												removeItem(
													item.productId,
												)
											}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
									<p className="mt-2 text-[11px] text-muted-foreground">
										Subtotal {formatZAR(subtotalCents)}
									</p>
								</div>
							);
						})
					)}
				</div>
				{isJourneyMode && (
					<div className="flex justify-start">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setJourneyStep(1)}
						>
							Back to Selection
						</Button>
					</div>
				)}
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-2">
						<Label>Payment Method</Label>
						<Select
							value={paymentMethod}
							onValueChange={(v) =>
								setPaymentMethod(
									v as PaymentMethod,
								)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Method" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="CASH">
									Cash
								</SelectItem>
								<SelectItem value="CARD">
									Card
								</SelectItem>
								<SelectItem value="EFT">
									EFT
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="rounded-md border p-3">
						<p className="text-xs text-muted-foreground">
							Total
						</p>
						<p className="text-lg font-semibold">
							{formatZAR(totalCents)}
						</p>
					</div>
				</div>
					</>
				)}
			</div>
			<SaveFooter
				disabled={
					loading || items.length === 0
				}
				loading={loading}
				label={
					journeyStep === 3 &&
					paymentMethod === "CASH"
						? "Confirm Cash Checkout"
						: "Checkout"
				}
			/>
		</form>
	);
}

function QuickAddSaleItems({
	items,
	setItems,
	products,
}: {
	items: ChargeItem[];
	setItems: React.Dispatch<
		React.SetStateAction<ChargeItem[]>
	>;
	products: Product[];
}) {
	const [scanInput, setScanInput] =
		React.useState("");
	const [isMobilePicker, setIsMobilePicker] =
		React.useState(false);
	const lastScanKeyTsRef =
		React.useRef<number>(0);
	const fastKeyStreakRef =
		React.useRef(0);
	const autoAddTimerRef = React.useRef<
		ReturnType<typeof setTimeout> | undefined
	>(undefined);
	const scanInputRef =
		React.useRef<HTMLInputElement | null>(null);
	const logQuickAdd = React.useCallback(
		(
			event: string,
			meta?: Record<string, unknown>,
		) => {
			pushQuickAddDebugLog(event, meta);
		},
		[],
	);
	React.useEffect(() => {
		logQuickAdd("quick_add_sale_items_mounted", {
			productsCount: products.length,
			itemsCount: items.length,
		});
	}, [logQuickAdd, products.length, items.length]);

	const productMap = React.useMemo(
		() => new Map(products.map((p) => [p.id, p])),
		[products],
	);
	const productByBarcode = React.useMemo(
		() =>
			new Map(
				products
					.filter((p) => Boolean(p.barcode))
					.map((p) => [
						String(p.barcode)
							.trim()
							.toLowerCase(),
						p.id,
					]),
			),
		[products],
	);

	const addUnits = React.useCallback(
		(productId: string, unitsToAdd: number) => {
			if (!productId || unitsToAdd <= 0) return;
			logQuickAdd("add_units_called", {
				productId,
				unitsToAdd,
			});
			setItems((prev) => {
				const existingIndex = prev.findIndex(
					(item) => item.productId === productId,
				);
				if (existingIndex >= 0) {
					return prev.map((item, index) =>
						index === existingIndex
							? {
									...item,
									units: String(
										(parseInt(
											item.units,
											10,
										) || 0) + unitsToAdd,
									),
							  }
							: item,
					);
				}
				return [
					...prev,
					{
						productId,
						units: String(unitsToAdd),
					},
				];
			});
		},
		[setItems, logQuickAdd],
	);

	const resolveProductIdFromInput = React.useCallback(
		(rawInput: string) => {
			const query = rawInput.trim().toLowerCase();
			if (!query) return null;
			const barcodeMatch = productByBarcode.get(query);
			if (barcodeMatch) return barcodeMatch;
			const exactNameMatch = products.find(
				(product) =>
					product.name.trim().toLowerCase() ===
						query ||
					product.id.toLowerCase() === query,
			);
			if (exactNameMatch) return exactNameMatch.id;
			const startsWithMatch = products.find((product) =>
				product.name.toLowerCase().startsWith(query),
			);
			if (startsWithMatch) return startsWithMatch.id;
			const includesMatch = products.find((product) =>
				product.name.toLowerCase().includes(query),
			);
			return includesMatch?.id ?? null;
		},
		[products, productByBarcode],
	);
	const resolveExactProductId = React.useCallback(
		(rawInput: string) => {
			const query = rawInput.trim().toLowerCase();
			if (!query) return null;
			const barcodeMatch = productByBarcode.get(query);
			if (barcodeMatch) return barcodeMatch;
			const exactNameMatch = products.find(
				(product) =>
					product.name.trim().toLowerCase() ===
						query ||
					product.id.toLowerCase() === query,
			);
			return exactNameMatch?.id ?? null;
		},
		[products, productByBarcode],
	);
	const matchedProductId = React.useMemo(
		() => resolveProductIdFromInput(scanInput),
		[resolveProductIdFromInput, scanInput],
	);
	const matchedProductName = matchedProductId
		? productMap.get(matchedProductId)?.name ??
			matchedProductId
		: "";

	const addByInput = React.useCallback(
		(rawInput: string) => {
			const productId =
				resolveProductIdFromInput(rawInput);
			logQuickAdd("add_by_input_attempt", {
				rawInput,
				resolvedProductId: productId,
			});
			if (!productId) {
				toast.error(
					`No product match for "${rawInput.trim()}"`,
				);
				logQuickAdd("add_by_input_no_match", {
					rawInput,
				});
				return;
			}
			const qty =
				1;
			addUnits(productId, qty);
			setScanInput("");
			fastKeyStreakRef.current = 0;
			requestAnimationFrame(() =>
				scanInputRef.current?.focus(),
			);
		},
		[
			addUnits,
			resolveProductIdFromInput,
			logQuickAdd,
		],
	);

	React.useEffect(() => {
		return () => {
			if (autoAddTimerRef.current) {
				clearTimeout(autoAddTimerRef.current);
			}
		};
	}, []);
	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia(
			"(max-width: 768px), (pointer: coarse)",
		);
		const apply = () => {
			setIsMobilePicker(mq.matches);
			logQuickAdd("mobile_picker_state", {
				matches: mq.matches,
				innerWidth: window.innerWidth,
				innerHeight: window.innerHeight,
				screenWidth: window.screen.width,
				screenHeight: window.screen.height,
				devicePixelRatio:
					window.devicePixelRatio,
				maxTouchPoints:
					navigator.maxTouchPoints,
				userAgent: navigator.userAgent,
			});
		};
		logQuickAdd("mobile_picker_init", {
			query:
				"(max-width: 768px), (pointer: coarse)",
		});
		apply();
		mq.addEventListener("change", apply);
		return () =>
			mq.removeEventListener("change", apply);
	}, [logQuickAdd]);
	React.useEffect(() => {
		if (!isMobilePicker) return;
		if (!scanInput.trim()) return;
		const exactProductId =
			resolveExactProductId(scanInput);
		logQuickAdd("mobile_debounce_check", {
			isMobilePicker,
			scanInput,
			exactProductId,
		});
		if (!exactProductId) return;

		const timer = setTimeout(() => {
			logQuickAdd("mobile_debounce_auto_add", {
				scanInput,
				exactProductId,
			});
			addUnits(exactProductId, 1);
			setScanInput("");
			fastKeyStreakRef.current = 0;
		}, 120);

		return () => clearTimeout(timer);
	}, [
		isMobilePicker,
		scanInput,
		resolveExactProductId,
		addUnits,
		logQuickAdd,
	]);

	const scheduleAutoAdd = React.useCallback(
		(rawCode: string) => {
			if (autoAddTimerRef.current) {
				clearTimeout(autoAddTimerRef.current);
			}
			autoAddTimerRef.current = setTimeout(() => {
				addByInput(rawCode);
			}, 80);
		},
		[addByInput],
	);

	const adjustUnits = (productId: string, delta: number) => {
		setItems((prev) =>
			prev
				.map((item) => {
					if (item.productId !== productId) return item;
					const next =
						(parseInt(item.units, 10) || 0) + delta;
					return { ...item, units: String(next) };
				})
				.filter(
					(item) =>
						(parseInt(item.units, 10) || 0) > 0,
				),
		);
	};

	const setUnits = (productId: string, nextUnits: number) => {
		setItems((prev) =>
			prev
				.map((item) =>
					item.productId === productId
						? {
								...item,
								units: String(nextUnits),
						  }
						: item,
				)
				.filter(
					(item) =>
						(parseInt(item.units, 10) || 0) > 0,
				),
		);
	};

	const removeItem = (productId: string) => {
		setItems((prev) =>
			prev.filter(
				(item) => item.productId !== productId,
			),
		);
	};

	return (
		<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
			<div className="space-y-2">
				<Label>Search / Select / Scan Product</Label>
				<div className="flex gap-2">
					<Input
						ref={scanInputRef}
						value={scanInput}
						list="quick-sale-product-options"
						onChange={(e) => {
							const nextValue =
								e.target.value;
							const nativeEvent =
								e.nativeEvent as Event & {
									inputType?: string;
								};
							const inputType =
								nativeEvent.inputType ?? "";
							const now = Date.now();
							const addedChars =
								nextValue.length -
								scanInput.length;
							const exactProductId =
								resolveExactProductId(
									nextValue,
								);
							const cameFromPickerLikeAction =
								inputType ===
									"insertReplacementText" ||
								inputType ===
									"insertFromPaste" ||
								addedChars > 1 ||
								(scanInput.length > 0 &&
									nextValue.length > 0 &&
									!nextValue.startsWith(
										scanInput,
									));
							logQuickAdd("input_change", {
								prevValue: scanInput,
								nextValue,
								inputType,
								addedChars,
								exactProductId,
								isMobilePicker,
								cameFromPickerLikeAction,
								fastKeyStreak:
									fastKeyStreakRef.current,
								lastScanDeltaMs:
									lastScanKeyTsRef.current > 0
										? now -
											lastScanKeyTsRef.current
										: null,
							});

							if (addedChars === 1) {
								const delta =
									now -
									lastScanKeyTsRef.current;
								if (delta > 0 && delta < 35) {
									fastKeyStreakRef.current += 1;
								} else {
									fastKeyStreakRef.current = 0;
								}
								if (
									fastKeyStreakRef.current >=
										5 &&
									nextValue.trim().length >= 6
								) {
									logQuickAdd(
										"scan_burst_detected",
										{
											nextValue,
											fastKeyStreak:
												fastKeyStreakRef.current,
										},
									);
									scheduleAutoAdd(
										nextValue,
									);
								}
							} else if (
								nextValue.length === 0
							) {
								fastKeyStreakRef.current = 0;
							}

							lastScanKeyTsRef.current = now;
							setScanInput(nextValue);
							if (
								(isMobilePicker ||
									cameFromPickerLikeAction) &&
								exactProductId &&
								nextValue.trim().length > 0
							) {
								logQuickAdd(
									"immediate_auto_add_from_picker",
									{
										nextValue,
										exactProductId,
										isMobilePicker,
										cameFromPickerLikeAction,
									},
								);
								addUnits(exactProductId, 1);
								setScanInput("");
								fastKeyStreakRef.current = 0;
							}
						}}
						onKeyDown={(e) => {
							if (e.key !== "Enter") return;
							e.preventDefault();
							logQuickAdd("enter_pressed", {
								scanInput,
							});
							addByInput(scanInput);
						}}
						placeholder="Type name or scan barcode, then Enter"
					/>
					<datalist id="quick-sale-product-options">
						{products.flatMap((product) => [
							<option
								key={`${product.id}-name`}
								value={product.name}
							/>,
							...(product.barcode
								? [
										<option
											key={`${product.id}-barcode`}
											value={String(
												product.barcode,
											)}
										/>,
								  ]
								: []),
						])}
					</datalist>
				</div>
				{scanInput.trim().length > 0 &&
					(matchedProductId ? (
						<p className="text-xs text-emerald-700">
							Selected:{" "}
							<span className="font-medium">
								{matchedProductName}
							</span>
							{" - "}Press Enter to add.
						</p>
					) : (
						<p className="text-xs text-muted-foreground">
							No product match yet.
						</p>
					))}
				{items.length > 0 && (
					<p className="text-xs text-muted-foreground">
						Type, select, or scan to add.
					</p>
				)}
			</div>

			<div className="space-y-2">
				<Label>Items</Label>
				{items.length === 0 ? (
					<p className="rounded-md border p-3 text-sm text-muted-foreground">
						No items yet. Scan barcode or add by product.
					</p>
				) : (
					items.map((item) => {
						const product =
							productMap.get(item.productId);
						const units =
							parseInt(item.units, 10) || 0;
						const subtotalCents =
							(product?.currentPriceCents ?? 0) *
							units;
						return (
							<div
								key={item.productId}
								className="rounded-md border p-2"
							>
								<div className="mb-2 flex items-start justify-between gap-2">
									<p className="font-medium">
										{product?.name ??
											item.productId}
									</p>
									<p className="text-sm font-semibold">
										{formatZAR(subtotalCents)}
									</p>
								</div>
								<div className="grid grid-cols-4 gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											adjustUnits(
												item.productId,
												-1,
											)
										}
									>
										-
									</Button>
									<Input
										value={units}
										onChange={(e) => {
											const next =
												parseInt(
													e.target.value,
													10,
												) || 0;
											setUnits(
												item.productId,
												next,
											);
										}}
										className="text-center"
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											adjustUnits(
												item.productId,
												1,
											)
										}
									>
										+
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={() =>
											removeItem(
												item.productId,
											)
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
								<p className="mt-2 text-xs text-muted-foreground">
									Subtotal {formatZAR(subtotalCents)}
								</p>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

function DirectSaleForm({
	products,
	date,
	onSuccess,
}: {
	products: Product[];
	date: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [items, setItems] = React.useState<
		ChargeItem[]
	>([]);
	const [paymentMethod, setPaymentMethod] =
		React.useState<PaymentMethod | "">("");
	const [cashReceivedCents, setCashReceivedCents] =
		React.useState(0);
	const [cashStep, setCashStep] =
		React.useState(false);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);
	const productPriceById = React.useMemo(
		() =>
			new Map(
				products.map((product) => [
					product.id,
					product.currentPriceCents ?? 0,
				]),
			),
		[products],
	);
	const totalDueCents = React.useMemo(
		() =>
			items.reduce((sum, item) => {
				const units =
					parseInt(item.units, 10) || 0;
				const unitPrice =
					productPriceById.get(item.productId) ??
					0;
				return sum + units * unitPrice;
			}, 0),
		[items, productPriceById],
	);
	React.useEffect(() => {
		if (paymentMethod !== "CASH") {
			setCashStep(false);
		}
	}, [paymentMethod]);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		if (paymentMethod === "CASH" && !cashStep) {
			setCashStep(true);
			return;
		}
		if (
			paymentMethod === "CASH" &&
			cashReceivedCents < totalDueCents
		) {
			toast.error(
				"Cash received is less than the sale total.",
			);
			return;
		}
		setLoading(true);
		const validItems = items
			.filter(
				(item) => item.productId && item.units,
			)
			.map((item) => ({
				productId: item.productId,
				units: parseInt(item.units, 10) || 0,
			}))
			.filter((item) => item.units > 0);
		if (!validItems.length) {
			toast.error(
				"Please add at least one item with quantities and line total price",
			);
			setLoading(false);
			return;
		}
		try {
			const payload: Record<string, unknown> = {
				date,
				paymentMethod,
				cashReceivedCents:
					paymentMethod === "CASH"
						? cashReceivedCents
						: undefined,
				items: validItems,
				note:
					showNote && note ? note : undefined,
			};
			let queueResult = await postSaleWithOfflineQueue(
				"/api/sales",
				payload,
			);
			if (queueResult.queued) {
				toast.success(
					"Offline: direct sale queued and will sync automatically.",
				);
				setCashReceivedCents(0);
				setCashStep(false);
				onSuccess();
				return;
			}
			let res = queueResult.response;
			if (!res.ok) {
				let errorBody = await res
					.json()
					.catch(() => ({}));
				const errorCode =
					getApiErrorCode(errorBody);
				if (errorCode === "BELOW_COST") {
					const proceed = window.confirm(
						`${getApiErrorMessage(
							errorBody,
							"Below-cost sale detected.",
						)}\n\nProceed with override?`,
					);
					if (proceed) {
						payload.belowCostApproved = true;
						payload.belowCostReason =
							"User override from quick direct sale";
						queueResult =
							await postSaleWithOfflineQueue(
								"/api/sales",
								payload,
							);
						if (queueResult.queued) {
							toast.success(
								"Offline: direct sale queued and will sync automatically.",
							);
							setCashReceivedCents(0);
							setCashStep(false);
							onSuccess();
							return;
						}
						res = queueResult.response;
						if (!res.ok) {
							errorBody =
								await res
									.json()
									.catch(
										() => ({}),
									);
						}
					}
				}
				if (!res.ok) {
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to save direct sale",
					),
				);
				}
			}
			toast.success("Direct sale saved");
			setCashReceivedCents(0);
			setCashStep(false);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to save direct sale",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				{cashStep && paymentMethod === "CASH" ? (
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
						<div className="rounded-md border p-3">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Cash Settlement
							</p>
							<p className="text-sm font-medium">
								Enter cash received
							</p>
							<p className="text-xs text-muted-foreground">
								Total due: {formatZAR(totalDueCents)}
							</p>
						</div>
						<CashChangeCalculator
							totalCents={totalDueCents}
							cashReceivedCents={cashReceivedCents}
							onCashReceivedChange={setCashReceivedCents}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setCashStep(false)}
						>
							Back to Items
						</Button>
					</div>
				) : (
					<>
						<QuickAddSaleItems
							items={items}
							setItems={setItems}
							products={products}
						/>
						<div className="space-y-3">
							<Label>Payment Method</Label>
							<Select
								value={paymentMethod}
								onValueChange={(v) =>
									setPaymentMethod(v as PaymentMethod)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select method" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="CASH">
										Cash
									</SelectItem>
									<SelectItem value="CARD">
										Card
									</SelectItem>
									<SelectItem value="EFT">
										EFT
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-full"
								onClick={() =>
									setShowNote((prev) => !prev)
								}
							>
								{showNote ? "Hide Note" : "Add Note"}
							</Button>
							{showNote && (
								<Textarea
									value={note}
									onChange={(e) =>
										setNote(e.target.value)
									}
									placeholder="Any notes..."
									rows={2}
								/>
							)}
						</div>
					</>
				)}
			</div>
			<SaveFooter
				disabled={
					loading ||
					!paymentMethod ||
					items.length === 0
				}
				loading={loading}
				label={
					cashStep && paymentMethod === "CASH"
						? "Confirm Cash Sale"
						: "Save"
				}
			/>
		</form>
	);
}

function AccountSaleForm({
	products,
	customers,
	date,
	onSuccess,
}: {
	products: Product[];
	customers: Customer[];
	date: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [customerId, setCustomerId] =
		React.useState("");
	const [items, setItems] = React.useState<
		ChargeItem[]
	>([]);
	const [manualAmountCents, setManualAmountCents] =
		React.useState(0);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);
	const [tempTabOpen, setTempTabOpen] =
		React.useState(false);
	const [tempTabLoading, setTempTabLoading] =
		React.useState(false);
	const [tempTabName, setTempTabName] =
		React.useState("");
	const [tempTabPhone, setTempTabPhone] =
		React.useState("");
	const [tempTabNote, setTempTabNote] =
		React.useState("");
	const { mutate } = useSWRConfig();
	const productPriceById = React.useMemo(
		() =>
			new Map(
				products.map((product) => [
					product.id,
					product.currentPriceCents ?? 0,
				]),
			),
		[products],
	);
	const itemsSubtotalCents = React.useMemo(
		() =>
			items.reduce((total, item) => {
				const units =
					parseInt(item.units, 10) || 0;
				const unitPrice =
					productPriceById.get(item.productId) ?? 0;
				return total + units * unitPrice;
			}, 0),
		[items, productPriceById],
	);
	const totalChargeCents =
		itemsSubtotalCents + manualAmountCents;
	React.useEffect(() => {
		pushQuickAddDebugLog("account_sale_form_mounted", {
			date,
			customersCount: customers.length,
			productsCount: products.length,
		});
	}, [date, customers.length, products.length]);

	const handleCreateTemporaryTab = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		if (!tempTabName.trim()) {
			toast.error(
				"Temporary tab name is required",
			);
			return;
		}

		setTempTabLoading(true);
		try {
			const res = await fetch("/api/customers", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: tempTabName.trim(),
					phone: tempTabPhone.trim() || undefined,
					note: tempTabNote.trim() || undefined,
					customerMode: "DEBT_ONLY",
					isTemporaryTab: true,
					creditLimitCents: 0,
				}),
			});
			const body = await res
				.json()
				.catch(() => ({}));
			if (!res.ok) {
				throw new Error(
					getApiErrorMessage(
						body,
						"Failed to open temporary tab",
					),
				);
			}

			const createdId = body?.data?.id ?? body?.id;
			if (typeof createdId === "string" && createdId) {
				setCustomerId(createdId);
			}
			await mutate("/api/customers");
			toast.success("Temporary tab opened");
			setTempTabOpen(false);
			setTempTabName("");
			setTempTabPhone("");
			setTempTabNote("");
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to open temporary tab",
			);
		} finally {
			setTempTabLoading(false);
		}
	};

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);
		const validItems = items
			.filter(
				(item) => item.productId && item.units,
			)
			.map((item) => ({
				productId: item.productId,
				units: parseInt(item.units, 10) || 0,
			}))
			.filter((item) => item.units > 0);
		if (
			!validItems.length &&
			manualAmountCents <= 0
		) {
			toast.error(
				"Add at least one item or an owed amount",
			);
			setLoading(false);
			return;
		}
		try {
			const payload: Record<string, unknown> = {
				date,
				customerId,
				items: validItems,
				manualAmountCents:
					manualAmountCents > 0
						? manualAmountCents
						: undefined,
				note:
					showNote && note ? note : undefined,
			};
			let queueResult = await postSaleWithOfflineQueue(
				"/api/tabs/charge",
				payload,
			);
			if (queueResult.queued) {
				toast.success(
					"Offline: account sale queued and will sync automatically.",
				);
				setManualAmountCents(0);
				onSuccess();
				return;
			}
			let res = queueResult.response;
			if (!res.ok) {
				let errorBody = await res
					.json()
					.catch(() => ({}));
				const errorCode =
					getApiErrorCode(errorBody);
				if (errorCode === "BELOW_COST") {
					const proceed = window.confirm(
						`${getApiErrorMessage(
							errorBody,
							"Below-cost sale detected.",
						)}\n\nProceed with override?`,
					);
					if (proceed) {
						payload.belowCostApproved = true;
						payload.belowCostReason =
							"User override from quick account sale";
						queueResult =
							await postSaleWithOfflineQueue(
								"/api/tabs/charge",
								payload,
							);
						if (queueResult.queued) {
							toast.success(
								"Offline: account sale queued and will sync automatically.",
							);
							setManualAmountCents(0);
							onSuccess();
							return;
						}
						res = queueResult.response;
						if (!res.ok) {
							errorBody =
								await res
									.json()
									.catch(
										() => ({}),
									);
						}
					}
				}
				if (!res.ok) {
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to add sale to account",
					),
				);
				}
			}
			toast.success(
				"Sale added to customer account",
			);
			setManualAmountCents(0);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to add sale to account",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				<QuickAddSaleItems
					items={items}
					setItems={setItems}
					products={products}
				/>
				<div className="space-y-3">
					<CustomerSelect
						customers={customers}
						value={customerId}
						onChange={setCustomerId}
						label="Tab Holder"
					/>
					<Dialog
						open={tempTabOpen}
						onOpenChange={setTempTabOpen}
					>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full"
							onClick={() => setTempTabOpen(true)}
						>
							Open Temporary Tab
						</Button>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>
									Open Temporary Tab
								</DialogTitle>
								<DialogDescription>
									Create a temporary running tab for this session.
									It auto-closes after full payment.
								</DialogDescription>
							</DialogHeader>
							<form
								onSubmit={handleCreateTemporaryTab}
								className="space-y-3"
							>
								<div className="space-y-2">
									<Label>Tab Name</Label>
									<Input
										value={tempTabName}
										onChange={(e) =>
											setTempTabName(
												e.target.value,
											)
										}
										placeholder="e.g. Blue Jacket"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label>
										Phone (optional)
									</Label>
									<Input
										type="tel"
										value={tempTabPhone}
										onChange={(e) =>
											setTempTabPhone(
												e.target.value,
											)
										}
										placeholder="072 123 4567"
									/>
								</div>
								<div className="space-y-2">
									<Label>Note (optional)</Label>
									<Textarea
										value={tempTabNote}
										onChange={(e) =>
											setTempTabNote(
												e.target.value,
											)
										}
										rows={2}
										placeholder="Quick identifier or context..."
									/>
								</div>
								<div className="flex justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											setTempTabOpen(false)
										}
									>
										Cancel
									</Button>
									<Button
										type="submit"
										disabled={
											tempTabLoading ||
											!tempTabName.trim()
										}
									>
										{tempTabLoading
											? "Opening..."
											: "Open Tab"}
									</Button>
								</div>
							</form>
						</DialogContent>
					</Dialog>
				</div>
				<div className="space-y-3">
					<MoneyInput
						label="Extra Owed Amount"
						value={manualAmountCents}
						onChange={setManualAmountCents}
					/>
					<p className="text-xs text-muted-foreground">
						Use this for money added to the tab that is
						not tied to stock items.
					</p>
					<div className="rounded-md border p-3 text-sm">
						<p>
							Items subtotal:{" "}
							{formatZAR(itemsSubtotalCents)}
						</p>
						<p>
							Extra owed:{" "}
							{formatZAR(manualAmountCents)}
						</p>
						<p className="font-medium">
							Total charge:{" "}
							{formatZAR(totalChargeCents)}
						</p>
					</div>
				</div>
				<div className="space-y-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full"
						onClick={() =>
							setShowNote((prev) => !prev)
						}
					>
						{showNote ? "Hide Note" : "Add Note"}
					</Button>
					{showNote && (
						<Textarea
							value={note}
							onChange={(e) =>
								setNote(e.target.value)
							}
							placeholder="Optional note for this account sale"
							rows={2}
						/>
					)}
				</div>
			</div>
			<SaveFooter
				disabled={
					loading ||
					!customerId ||
					totalChargeCents <= 0
				}
				loading={loading}
			/>
		</form>
	);
}

function AccountPaymentForm({
	customers,
	date,
	onSuccess,
}: {
	customers: Customer[];
	date: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [customerId, setCustomerId] =
		React.useState("");
	const [amountCents, setAmountCents] =
		React.useState(0);
	const [paymentMethod, setPaymentMethod] =
		React.useState<PaymentMethod | "">("");
	const [cashReceivedCents, setCashReceivedCents] =
		React.useState(0);
	const [cashStep, setCashStep] =
		React.useState(false);
	const [reference, setReference] =
		React.useState("");
	const [showReference, setShowReference] =
		React.useState(false);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);
	React.useEffect(() => {
		if (paymentMethod !== "CASH") {
			setCashStep(false);
		}
	}, [paymentMethod]);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		if (paymentMethod === "CASH" && !cashStep) {
			setCashStep(true);
			return;
		}
		if (
			paymentMethod === "CASH" &&
			cashReceivedCents < amountCents
		) {
			toast.error(
				"Cash received is less than the payment amount.",
			);
			return;
		}
		setLoading(true);
		try {
			const payload = {
				date,
				customerId,
				amountCents,
				paymentMethod,
				cashReceivedCents:
					paymentMethod === "CASH"
						? cashReceivedCents
						: undefined,
				reference:
					showReference && reference
						? reference
						: undefined,
				note:
					showNote && note ? note : undefined,
			};
			const queueResult =
				await postTabPaymentWithOfflineQueue(
					payload,
				);
			if (queueResult.queued) {
				toast.success(
					"Offline: payment queued and will sync automatically.",
				);
				setCashReceivedCents(0);
				setCashStep(false);
				onSuccess();
				return;
			}
			const res = queueResult.response;
			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to record payment",
					),
				);
			}
			toast.success(
				"Payment recorded successfully",
			);
			setCashReceivedCents(0);
			setCashStep(false);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to record payment",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				{cashStep && paymentMethod === "CASH" ? (
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
						<div className="rounded-md border p-3">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Cash Settlement
							</p>
							<p className="text-sm font-medium">
								Confirm cash received and change
							</p>
							<p className="text-xs text-muted-foreground">
								Payment amount: {formatZAR(amountCents)}
							</p>
						</div>
						<CashChangeCalculator
							totalCents={amountCents}
							cashReceivedCents={cashReceivedCents}
							onCashReceivedChange={setCashReceivedCents}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setCashStep(false)}
						>
							Back
						</Button>
					</div>
				) : (
					<>
						<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
							<CustomerSelect
								customers={customers}
								value={customerId}
								onChange={setCustomerId}
								label="Tab Holder"
							/>
							<MoneyInput
								label="Amount"
								value={amountCents}
								onChange={setAmountCents}
							/>
						</div>

						<div className="space-y-3">
							<Label>Payment Method</Label>
							<Select
								value={paymentMethod}
								onValueChange={(v) =>
									setPaymentMethod(v as PaymentMethod)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select method" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="CASH">
										Cash
									</SelectItem>
									<SelectItem value="CARD">
										Card
									</SelectItem>
									<SelectItem value="EFT">
										EFT
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<div className="grid grid-cols-2 gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full"
									onClick={() =>
										setShowReference((prev) => !prev)
									}
								>
									{showReference
										? "Hide Ref"
										: "Add Ref"}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full"
									onClick={() =>
										setShowNote((prev) => !prev)
									}
								>
									{showNote
										? "Hide Note"
										: "Add Note"}
								</Button>
							</div>
							{showReference && (
								<div className="space-y-2">
									<Label>Reference (optional)</Label>
									<Input
										value={reference}
										onChange={(e) =>
											setReference(e.target.value)
										}
										placeholder="e.g. Receipt #123"
									/>
								</div>
							)}
							{showNote && (
								<Textarea
									value={note}
									onChange={(e) =>
										setNote(e.target.value)
									}
									placeholder="Any notes..."
									rows={2}
								/>
							)}
						</div>
					</>
				)}
			</div>
			<SaveFooter
				disabled={
					loading ||
					!customerId ||
					!paymentMethod ||
					amountCents <= 0
				}
				loading={loading}
				label={
					cashStep && paymentMethod === "CASH"
						? "Confirm Payment"
						: "Save"
				}
			/>
		</form>
	);
}

function ExpenseForm({
	date,
	onSuccess,
}: {
	date: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [amountCents, setAmountCents] =
		React.useState(0);
	const [category, setCategory] = React.useState<
		| "RENT"
		| "UTILITIES"
		| "TRANSPORT"
		| "WAGES"
		| "REPAIRS"
		| "SUPPLIES"
		| "MARKETING"
		| "TAX"
		| "OTHER"
		| ""
	>("");
	const [payee, setPayee] = React.useState("");
	const [reference, setReference] =
		React.useState("");
	const [showReference, setShowReference] =
		React.useState(false);
	const [reason, setReason] = React.useState("");

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);
		try {
			const payload = {
				date,
				amountCents,
				category,
				payee: payee.trim(),
				reason: reason.trim(),
				reference:
					showReference && reference
						? reference
						: undefined,
			};
			const queueResult =
				await postTabExpenseWithOfflineQueue(
					payload,
				);
			if (queueResult.queued) {
				toast.success(
					"Offline: expense queued and will sync automatically.",
				);
				onSuccess();
				return;
			}
			const res = queueResult.response;
			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to record expense",
					),
				);
			}
			toast.success(
				"Expense recorded successfully",
			);
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to record expense",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
					<MoneyInput
						label="Amount"
						value={amountCents}
						onChange={setAmountCents}
					/>
					<div className="space-y-2">
						<Label>Category</Label>
						<Select
							value={category}
							onValueChange={(v) =>
								setCategory(v as typeof category)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="RENT">Rent</SelectItem>
								<SelectItem value="UTILITIES">Utilities</SelectItem>
								<SelectItem value="TRANSPORT">Transport</SelectItem>
								<SelectItem value="WAGES">Wages</SelectItem>
								<SelectItem value="REPAIRS">Repairs</SelectItem>
								<SelectItem value="SUPPLIES">Supplies</SelectItem>
								<SelectItem value="MARKETING">Marketing</SelectItem>
								<SelectItem value="TAX">Tax</SelectItem>
								<SelectItem value="OTHER">Other</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Payee</Label>
						<Input
							value={payee}
							onChange={(e) =>
								setPayee(e.target.value)
							}
							placeholder="Who was paid"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label>Reason</Label>
						<Textarea
							value={reason}
							onChange={(e) =>
								setReason(e.target.value)
							}
							placeholder="Why is money leaving the business?"
							rows={2}
							required
						/>
					</div>
				</div>

				<div className="space-y-2">
					<div className="grid grid-cols-2 gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full"
							onClick={() =>
								setShowReference((prev) => !prev)
							}
						>
							{showReference
								? "Hide Ref"
								: "Add Ref"}
						</Button>
						<div />
					</div>
					{showReference && (
						<div className="space-y-2">
							<Label>Reference (optional)</Label>
							<Input
								value={reference}
								onChange={(e) =>
									setReference(e.target.value)
								}
								placeholder="e.g. Receipt/Invoice #"
							/>
						</div>
					)}
				</div>
			</div>
			<SaveFooter
				disabled={
					loading ||
					!category ||
					payee.trim().length < 2 ||
					reason.trim().length < 3 ||
					amountCents <= 0
				}
				loading={loading}
				label="Save"
			/>
		</form>
	);
}

function AddCustomerForm({
	onSuccess,
}: {
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [name, setName] = React.useState("");
	const [phone, setPhone] = React.useState("");
	const [note, setNote] = React.useState("");
	const [customerMode, setCustomerMode] =
		React.useState<"ACCOUNT" | "DEBT_ONLY">(
			"ACCOUNT",
		);
	const [creditLimitCents, setCreditLimitCents] =
		React.useState(0);
	const [dueDays, setDueDays] =
		React.useState("");

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch("/api/customers", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name,
					phone: phone || undefined,
					note: note || undefined,
					customerMode,
					creditLimitCents:
						customerMode === "ACCOUNT"
							? creditLimitCents
							: 0,
					dueDays: dueDays
						? customerMode === "ACCOUNT"
							? parseInt(dueDays, 10)
							: undefined
						: undefined,
				}),
			});

			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to add customer",
					),
				);
			}

			toast.success("Customer account added");
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to add customer",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-2">
				<div className="space-y-2">
					<Label>Name</Label>
					<Input
						value={name}
						onChange={(e) =>
							setName(e.target.value)
						}
						placeholder="John Doe"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label>Customer Type</Label>
					<Select
						value={customerMode}
						onValueChange={(value) =>
							setCustomerMode(
								value as
									| "ACCOUNT"
									| "DEBT_ONLY",
							)
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ACCOUNT">
								Account Customer
							</SelectItem>
							<SelectItem value="DEBT_ONLY">
								Debt-only Customer
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Phone (optional)</Label>
					<Input
						type="tel"
						value={phone}
						onChange={(e) =>
							setPhone(e.target.value)
						}
						placeholder="072 123 4567"
					/>
				</div>
				{customerMode === "ACCOUNT" && (
					<>
						<MoneyInput
							label="Credit Limit"
							value={creditLimitCents}
							onChange={setCreditLimitCents}
						/>
						<div className="space-y-2">
							<Label>
								Payment Due Days (optional)
							</Label>
							<Input
								type="number"
								min="1"
								value={dueDays}
								onChange={(e) =>
									setDueDays(e.target.value)
								}
								placeholder="30"
							/>
						</div>
					</>
				)}
				<div className="space-y-2">
					<Label>Note (optional)</Label>
					<Textarea
						value={note}
						onChange={(e) =>
							setNote(e.target.value)
						}
						placeholder="Any notes about this customer..."
						rows={2}
					/>
				</div>
			</div>
			<SaveFooter
				disabled={loading || !name}
				loading={loading}
			/>
		</form>
	);
}

function AddProductForm({
	onSuccess,
}: {
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [name, setName] = React.useState("");
	const [category, setCategory] =
		React.useState("");
	const [barcode, setBarcode] =
		React.useState("");
	const [packSize, setPackSize] =
		React.useState("");
	const [
		reorderLevelUnits,
		setReorderLevelUnits,
	] = React.useState("");

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
					name,
					category,
					barcode: barcode || undefined,
					packSize: parseInt(packSize, 10) || 1,
					reorderLevelUnits:
						parseInt(reorderLevelUnits, 10) || 0,
				}),
			});
			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to add product",
					),
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
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-2">
				<div className="space-y-2">
					<Label>Name</Label>
					<Input
						value={name}
						onChange={(e) =>
							setName(e.target.value)
						}
						placeholder="Castle Lager 500ml"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label>Category</Label>
					<Select
						value={category}
						onValueChange={setCategory}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select category" />
						</SelectTrigger>
						<SelectContent>
							{CATEGORIES.map((cat) => (
								<SelectItem key={cat} value={cat}>
									{cat}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Barcode (optional)</Label>
					<Input
						value={barcode}
						onChange={(e) =>
							setBarcode(e.target.value)
						}
						placeholder="6001234567890"
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-2">
						<Label>Pack Size</Label>
						<Input
							type="number"
							min="1"
							value={packSize}
							onChange={(e) =>
								setPackSize(e.target.value)
							}
							placeholder="24"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label>Reorder Level</Label>
						<Input
							type="number"
							min="0"
							value={reorderLevelUnits}
							onChange={(e) =>
								setReorderLevelUnits(
									e.target.value,
								)
							}
							placeholder="12"
							required
						/>
					</div>
				</div>
			</div>
			<SaveFooter
				disabled={loading || !name || !category}
				loading={loading}
			/>
		</form>
	);
}

function AddSupplierForm({
	onSuccess,
}: {
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [name, setName] = React.useState("");
	const [phone, setPhone] = React.useState("");
	const [notes, setNotes] = React.useState("");

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
				body: JSON.stringify({
					name,
					phone: phone || undefined,
					notes: notes || undefined,
				}),
			});
			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to add supplier",
					),
				);
			}
			toast.success("Supplier added successfully");
			onSuccess();
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
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-2">
				<div className="space-y-2">
					<Label>Name</Label>
					<Input
						value={name}
						onChange={(e) =>
							setName(e.target.value)
						}
						placeholder="Supplier name"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label>Phone (optional)</Label>
					<Input
						type="tel"
						value={phone}
						onChange={(e) =>
							setPhone(e.target.value)
						}
						placeholder="072 123 4567"
					/>
				</div>
				<div className="space-y-2">
					<Label>Notes (optional)</Label>
					<Textarea
						value={notes}
						onChange={(e) =>
							setNotes(e.target.value)
						}
						placeholder="Delivery terms, discount rules, or account details..."
						rows={3}
					/>
				</div>
			</div>
			<SaveFooter
				disabled={loading || !name.trim()}
				loading={loading}
			/>
		</form>
	);
}

function AddSupplierPriceForm({
	products,
	suppliers,
	onSuccess,
}: {
	products: Product[];
	suppliers: Supplier[];
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [supplierId, setSupplierId] =
		React.useState("");
	const [productId, setProductId] =
		React.useState("");
	const [unitCostCents, setUnitCostCents] =
		React.useState(0);
	const [effectiveFrom, setEffectiveFrom] =
		React.useState(getTodayJHB());
	const [moqUnits, setMoqUnits] =
		React.useState("");
	const [leadTimeDays, setLeadTimeDays] =
		React.useState("");
	const [note, setNote] = React.useState("");

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch(
				"/api/supplier-prices",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						supplierId,
						productId,
						unitCostCents,
						effectiveFrom:
							effectiveFrom || undefined,
						moqUnits: moqUnits
							? parseInt(moqUnits, 10)
							: undefined,
						leadTimeDays: leadTimeDays
							? parseInt(leadTimeDays, 10)
							: undefined,
						note: note || undefined,
					}),
				},
			);
			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to set supplier cost",
					),
				);
			}
			toast.success("Supplier cost saved");
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to set supplier cost",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-2">
				<div className="space-y-2">
					<Label>Supplier</Label>
					<Select
						value={supplierId}
						onValueChange={setSupplierId}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select supplier" />
						</SelectTrigger>
						<SelectContent>
							{suppliers.map((supplier) => (
								<SelectItem
									key={supplier.id}
									value={supplier.id}
								>
									{supplier.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Product</Label>
					<ProductSelect
						products={products}
						value={productId}
						onChange={setProductId}
						placeholder="Select product"
					/>
				</div>
				<MoneyInput
					label="Unit Cost"
					value={unitCostCents}
					onChange={setUnitCostCents}
				/>
				<div className="space-y-2">
					<Label>Effective From</Label>
					<Input
						type="date"
						value={effectiveFrom}
						onChange={(e) =>
							setEffectiveFrom(e.target.value)
						}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-2">
						<Label>MOQ Units (optional)</Label>
						<Input
							type="number"
							min="1"
							value={moqUnits}
							onChange={(e) =>
								setMoqUnits(e.target.value)
							}
							placeholder="24"
						/>
					</div>
					<div className="space-y-2">
						<Label>Lead Time Days (optional)</Label>
						<Input
							type="number"
							min="0"
							value={leadTimeDays}
							onChange={(e) =>
								setLeadTimeDays(
									e.target.value,
								)
							}
							placeholder="2"
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label>Note (optional)</Label>
					<Textarea
						value={note}
						onChange={(e) =>
							setNote(e.target.value)
						}
						rows={2}
						placeholder="Terms, delivery notes, or negotiated deal details..."
					/>
				</div>
			</div>
			<SaveFooter
				disabled={
					loading ||
					!supplierId ||
					!productId ||
					unitCostCents <= 0
				}
				loading={loading}
				label="Save Supplier Cost"
			/>
		</form>
	);
}

function AddPurchaseForm({
	products,
	suppliers,
	date,
	initialItems,
	initialSupplierId,
	onSuccess,
}: {
	products: Product[];
	suppliers: Supplier[];
	date: string;
	initialItems?: PurchaseItemForm[];
	initialSupplierId?: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [supplierId, setSupplierId] =
		React.useState(initialSupplierId ?? "");
	const [invoiceNo, setInvoiceNo] =
		React.useState("");
	const [items, setItems] = React.useState<
		PurchaseItemForm[]
	>(
		initialItems && initialItems.length > 0
			? initialItems
			: [
					{
						productId: "",
						cases: "",
						singles: "",
						lineSubtotalCents: 0,
					},
				],
	);

	React.useEffect(() => {
		setSupplierId(initialSupplierId ?? "");
		if (initialItems && initialItems.length > 0) {
			setItems(initialItems);
			return;
		}
		setItems([
			{
				productId: "",
				cases: "",
				singles: "",
				lineSubtotalCents: 0,
			},
		]);
	}, [initialItems, initialSupplierId]);

	const productMap = React.useMemo(
		() => new Map(products.map((p) => [p.id, p])),
		[products],
	);

	const calculateUnits = (
		item: PurchaseItemForm,
	) => {
		const product = productMap.get(
			item.productId,
		);
		const packSize = product?.packSize || 1;
		const cases = parseInt(item.cases, 10) || 0;
		const singles =
			parseInt(item.singles, 10) || 0;
		return cases * packSize + singles;
	};

	const updateItem = (
		index: number,
		updates: Partial<PurchaseItemForm>,
	) => {
		setItems((prev) =>
			prev.map((item, i) =>
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
					(item.cases || item.singles) &&
					item.lineSubtotalCents > 0,
			)
			.map((item) => ({
				productId: item.productId,
				cases: parseInt(item.cases, 10) || 0,
				singles: parseInt(item.singles, 10) || 0,
				units: calculateUnits(item),
				lineSubtotalCents:
					item.lineSubtotalCents > 0
						? item.lineSubtotalCents
						: undefined,
			}));
		if (!validItems.length) {
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
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to record purchase",
					),
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
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
					<div className="space-y-2">
						<Label>Supplier (optional)</Label>
						<Select
							value={supplierId}
							onValueChange={setSupplierId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select supplier" />
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
						<Label>
							Invoice Number (optional)
						</Label>
						<Input
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
										className="space-y-1 rounded-lg border p-2"
									>
										<div className="grid grid-cols-12 items-end gap-2">
											<div className="col-span-12 sm:col-span-4">
												<ProductSelect
													products={products}
													value={item.productId}
													onChange={(v) =>
														updateItem(index, {
															productId: v,
														})
													}
													placeholder="Product"
												/>
											</div>
											<div className="col-span-4 sm:col-span-2">
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
													placeholder="Cases"
												/>
											</div>
											<div className="col-span-4 sm:col-span-2">
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
													placeholder="Singles"
												/>
											</div>
											<div className="col-span-4 sm:col-span-2">
												<Input
													value={units}
													disabled
													placeholder="Units"
												/>
											</div>
											<div className="col-span-8 flex items-end gap-1 sm:col-span-2">
												<div className="min-w-0 flex-1 space-y-1">
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
												{items.length > 1 && (
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() =>
															setItems((prev) =>
																prev.filter(
																	(_, i) =>
																		i !==
																		index,
																),
															)
														}
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
					</div>
				</div>
				<div className="space-y-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full"
						onClick={() =>
							setItems((prev) => [
								...prev,
								{
									productId: "",
									cases: "",
									singles: "",
									lineSubtotalCents: 0,
								},
							])
						}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Item
					</Button>
				</div>
			</div>
			<SaveFooter
				disabled={loading}
				loading={loading}
			/>
		</form>
	);
}

function AddAdjustmentForm({
	products,
	date,
	fixedReason,
	positiveOnly = false,
	successMessage = "Adjustments submitted successfully",
	onSuccess,
}: {
	products: Product[];
	date: string;
	fixedReason?: AdjustmentReason;
	positiveOnly?: boolean;
	successMessage?: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [items, setItems] = React.useState<
		AdjustmentItemForm[]
	>([
		{
			productId: "",
			unitsDelta: "",
			reason: fixedReason ?? "",
			note: "",
		},
	]);

	const updateItem = (
		index: number,
		updates: Partial<AdjustmentItemForm>,
	) => {
		setItems((prev) =>
			prev.map((item, i) =>
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
					(item.reason || fixedReason),
			)
			.map((item) => {
				const parsedUnits =
					parseInt(item.unitsDelta, 10) || 0;
				return {
					productId: item.productId,
					unitsDelta: parsedUnits,
					reason: (fixedReason ??
						item.reason) as AdjustmentReason,
					note: item.note || undefined,
				};
			})
			.filter((item) =>
				positiveOnly ? item.unitsDelta > 0 : true,
			);
		if (!validItems.length) {
			toast.error(
				positiveOnly
					? "Please add at least one item with units greater than 0"
					: "Please add at least one valid adjustment item",
			);
			setLoading(false);
			return;
		}
		try {
			const queueResult =
				await postAdjustmentWithOfflineQueue({
					date,
					items: validItems,
				});
			if (queueResult.queued) {
				toast.success(
					"Offline: adjustment queued and will sync automatically.",
				);
				onSuccess();
				return;
			}
			const res = queueResult.response;
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
			toast.success(successMessage);
			onSuccess();
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
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
					{items.map((item, index) => (
						<div
							key={index}
							className="space-y-3 rounded-lg border p-3"
						>
							<div className="flex items-end gap-2">
								<div className="flex-1">
									<ProductSelect
										products={products}
										value={item.productId}
										onChange={(v) =>
											updateItem(index, {
												productId: v,
											})
										}
										placeholder="Product"
									/>
								</div>
								{items.length > 1 && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() =>
											setItems((prev) =>
												prev.filter(
													(_, i) => i !== index,
												),
											)
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								)}
							</div>
							<div className="grid grid-cols-2 gap-2">
								{fixedReason ? (
									<div className="flex items-center rounded-md border px-3 text-sm text-muted-foreground">
										Reason: Existing Stock
									</div>
								) : (
									<Select
										value={item.reason}
										onValueChange={(
											v: AdjustmentReason | "",
										) =>
											updateItem(index, {
												reason: v,
											})
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Reason" />
										</SelectTrigger>
										<SelectContent>
											{ADJUSTMENT_REASONS.map(
												(reason) => (
													<SelectItem
														key={reason.value}
														value={reason.value}
													>
														{reason.label}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
								)}
								<Input
									type="number"
									value={item.unitsDelta}
									onChange={(e) =>
										updateItem(index, {
											unitsDelta: e.target.value,
										})
									}
									placeholder={
										positiveOnly
											? "Units (>0)"
											: "Units (+/-)"
									}
								/>
							</div>
							<Textarea
								value={item.note}
								onChange={(e) =>
									updateItem(index, {
										note: e.target.value,
									})
								}
								placeholder="Note (optional)"
								rows={2}
							/>
						</div>
					))}
				</div>
				<div className="space-y-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full"
						onClick={() =>
							setItems((prev) => [
								...prev,
								{
									productId: "",
									unitsDelta: "",
									reason: fixedReason ?? "",
									note: "",
								},
							])
						}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Item
					</Button>
				</div>
			</div>
			<SaveFooter
				disabled={loading}
				loading={loading}
			/>
		</form>
	);
}
