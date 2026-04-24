"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
	Box,
	CalendarCheck,
	ChevronDown,
	ChevronUp,
	CreditCard,
	DollarSign,
	PackageMinus,
	Plus,
	ShoppingCart,
	Star,
	Trash2,
	Truck,
	Users,
} from "lucide-react";
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
import { getTodayJHB } from "@/lib/date-utils";
import { formatZAR } from "@/lib/money";
import {
	postAdjustmentWithOfflineQueue,
	postPurchaseWithOfflineQueue,
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

const ENABLED_PATHS = [
	"/dashboard",
	"/stock-counts",
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
	"h-[70vh] w-[90vw] max-w-[90vw] overflow-y-auto md:max-w-3xl";

const QUICK_ACTION_STORAGE_KEY = "kgomong.quickActions.favorites";
const NO_VALUE = "__none__";

type QuickAction =
	| "morning-count"
	| "opening-stock"
	| "purchase"
	| "adjustment"
	| "restock"
	| "account-payment"
	| "expense"
	| "customer"
	| "supplier"
	| "supplier-price"
	| "product";

type ProductCategory = "Beer" | "Cider" | "SoftDrink" | "Other";

type PurchaseItemForm = {
	productId: string;
	cases: string;
	singles: string;
	lineSubtotalCents: number;
};

type AdjustmentItemForm = {
	productId: string;
	unitsDelta: string;
	reason: AdjustmentReason | "";
	note: string;
};

type DailyReportLite = {
	stockRecommendations: {
		productId: string;
		recommendedOrderUnits: number;
	}[];
};

type PurchaseHistoryLite = {
	supplierId?: string;
	items: {
		productId: string;
		unitCostCents?: number;
	}[];
};

type SupplierPriceLite = {
	supplierId: string;
	productId: string;
	unitCostCents: number;
};

const QUICK_ACTION_ALL: QuickAction[] = [
	"morning-count",
	"opening-stock",
	"purchase",
	"adjustment",
	"restock",
	"account-payment",
	"expense",
	"customer",
	"supplier",
	"supplier-price",
	"product",
];

const QUICK_ACTION_DEFAULT_FAVORITES: QuickAction[] = [
	"morning-count",
	"purchase",
	"adjustment",
	"account-payment",
];

const CATEGORIES: ProductCategory[] = [
	"Beer",
	"Cider",
	"SoftDrink",
	"Other",
];

const EXPENSE_CATEGORIES = [
	"RENT",
	"UTILITIES",
	"TRANSPORT",
	"WAGES",
	"REPAIRS",
	"SUPPLIES",
	"MARKETING",
	"TAX",
	"OTHER",
] as const;

const ADJUSTMENT_REASONS: {
	value: AdjustmentReason;
	label: string;
}[] = [
	{ value: "SPILLAGE", label: "Spillage" },
	{ value: "BREAKAGE", label: "Breakage" },
	{ value: "FREEBIES", label: "Freebies" },
	{ value: "THEFT_SUSPECTED", label: "Theft (Suspected)" },
	{ value: "OPENING_STOCK", label: "Existing Stock" },
	{ value: "COUNT_CORRECTION", label: "Count Correction" },
];

function pushQuickAddDebugLog(event: string, meta?: Record<string, unknown>) {
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

const fetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(
			json?.error?.message ?? json?.error ?? "Failed to fetch data",
		);
	}
	return json?.data ?? json;
};

const getApiErrorMessage = (payload: unknown, fallback: string) => {
	if (!payload || typeof payload !== "object") return fallback;
	const maybePayload = payload as Record<string, unknown>;
	const maybeError = maybePayload.error;
	if (typeof maybeError === "string") return maybeError;
	if (maybeError && typeof maybeError === "object") {
		const maybeErrorObj = maybeError as Record<string, unknown>;
		if (typeof maybeErrorObj.message === "string") {
			return maybeErrorObj.message;
		}
	}
	return fallback;
};

const blankPurchaseItem = (): PurchaseItemForm => ({
	productId: "",
	cases: "",
	singles: "",
	lineSubtotalCents: 0,
});

const blankAdjustmentItem = (reason: AdjustmentReason | "" = ""): AdjustmentItemForm => ({
	productId: "",
	unitsDelta: "",
	reason,
	note: "",
});

const toInt = (value: string) => {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 0;
};

const cleanIntInput = (value: string, allowNegative = false) => {
	const cleaned = value.replace(allowNegative ? /[^0-9-]/g : /\D/g, "");
	if (!allowNegative) return cleaned;
	const negative = cleaned.startsWith("-");
	const digits = cleaned.replace(/-/g, "");
	return `${negative ? "-" : ""}${digits}`;
};

const optionalText = (value: string) => {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const getQuickActionLabel = (action: QuickAction, restockCount: number) => {
	switch (action) {
		case "morning-count":
			return "Start Morning Count";
		case "opening-stock":
			return "Add Existing Stock";
		case "account-payment":
			return "Add Account Payment";
		case "expense":
			return "Add Expense";
		case "restock":
			return `Restock Low Stock (${restockCount})`;
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

const getQuickActionIcon = (action: QuickAction) => {
	switch (action) {
		case "morning-count":
			return <CalendarCheck className="mr-2 h-4 w-4" />;
		case "account-payment":
		case "expense":
			return <CreditCard className="mr-2 h-4 w-4" />;
		case "restock":
		case "purchase":
			return <ShoppingCart className="mr-2 h-4 w-4" />;
		case "opening-stock":
		case "product":
			return <Box className="mr-2 h-4 w-4" />;
		case "customer":
			return <Users className="mr-2 h-4 w-4" />;
		case "supplier":
			return <Truck className="mr-2 h-4 w-4" />;
		case "supplier-price":
			return <DollarSign className="mr-2 h-4 w-4" />;
		case "adjustment":
			return <PackageMinus className="mr-2 h-4 w-4" />;
	}
};

export function GlobalQuickActions() {
	const pathname = usePathname();
	const show = ENABLED_PATHS.some((path) => pathname.startsWith(path));
	const [open, setOpen] = React.useState(false);
	const [activeAction, setActiveAction] = React.useState<QuickAction | null>(null);
	const [showMoreActions, setShowMoreActions] = React.useState(false);
	const [showPinShortcuts, setShowPinShortcuts] = React.useState(false);
	const [favoriteActions, setFavoriteActions] = React.useState<QuickAction[]>(QUICK_ACTION_DEFAULT_FAVORITES);
	const [saving, setSaving] = React.useState(false);
	const date = React.useMemo(() => getTodayJHB(), []);
	const { mutate } = useSWRConfig();
	const enableQuickData = show && (open || activeAction !== null);

	const { data: products = [] } = useSWR<Product[]>(
		enableQuickData ? "/api/products" : null,
		fetcher,
	);
	const { data: customers = [] } = useSWR<Customer[]>(
		enableQuickData ? "/api/customers" : null,
		fetcher,
	);
	const { data: suppliers = [] } = useSWR<Supplier[]>(
		enableQuickData ? "/api/suppliers" : null,
		fetcher,
	);
	const { data: report } = useSWR<DailyReportLite>(
		enableQuickData ? `/api/reports/daily?date=${date}` : null,
		fetcher,
	);
	const { data: purchaseHistory = [] } = useSWR<PurchaseHistoryLite[]>(
		enableQuickData
			? `/api/purchases?date=${date}&lookbackDays=60&fields=lite`
			: null,
		fetcher,
	);
	const { data: supplierPrices = [] } = useSWR<SupplierPriceLite[]>(
		enableQuickData
			? `/api/supplier-prices?asOf=${date}&fields=lite`
			: null,
		fetcher,
	);

	const [purchaseSupplierId, setPurchaseSupplierId] = React.useState(NO_VALUE);
	const [purchaseInvoiceNo, setPurchaseInvoiceNo] = React.useState("");
	const [purchaseDate, setPurchaseDate] = React.useState(date);
	const [purchaseItems, setPurchaseItems] = React.useState<PurchaseItemForm[]>([
		blankPurchaseItem(),
	]);

	const [adjustmentItems, setAdjustmentItems] = React.useState<AdjustmentItemForm[]>([
		blankAdjustmentItem(),
	]);

	const [paymentCustomerId, setPaymentCustomerId] = React.useState("");
	const [paymentAmountCents, setPaymentAmountCents] = React.useState(0);
	const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("CASH");
	const [paymentCashReceivedCents, setPaymentCashReceivedCents] = React.useState(0);
	const [paymentReference, setPaymentReference] = React.useState("");
	const [paymentNote, setPaymentNote] = React.useState("");

	const [expenseAmountCents, setExpenseAmountCents] = React.useState(0);
	const [expenseReason, setExpenseReason] = React.useState("");
	const [expenseCategory, setExpenseCategory] = React.useState<(typeof EXPENSE_CATEGORIES)[number]>("OTHER");
	const [expensePayee, setExpensePayee] = React.useState("");
	const [expenseReference, setExpenseReference] = React.useState("");
	const [expenseNote, setExpenseNote] = React.useState("");

	const [customerName, setCustomerName] = React.useState("");
	const [customerPhone, setCustomerPhone] = React.useState("");
	const [customerNote, setCustomerNote] = React.useState("");
	const [customerMode, setCustomerMode] = React.useState<"ACCOUNT" | "DEBT_ONLY">("ACCOUNT");
	const [customerTemporaryTab, setCustomerTemporaryTab] = React.useState(false);
	const [customerOpeningBalanceCents, setCustomerOpeningBalanceCents] = React.useState(0);
	const [customerCreditLimitCents, setCustomerCreditLimitCents] = React.useState(0);
	const [customerDueDays, setCustomerDueDays] = React.useState("");

	const [supplierName, setSupplierName] = React.useState("");
	const [supplierPhone, setSupplierPhone] = React.useState("");
	const [supplierNotes, setSupplierNotes] = React.useState("");

	const [supplierPriceSupplierId, setSupplierPriceSupplierId] = React.useState(NO_VALUE);
	const [supplierPriceProductId, setSupplierPriceProductId] = React.useState("");
	const [supplierPriceCostCents, setSupplierPriceCostCents] = React.useState(0);
	const [supplierPriceEffectiveFrom, setSupplierPriceEffectiveFrom] = React.useState(date);
	const [supplierPriceMoqUnits, setSupplierPriceMoqUnits] = React.useState("");
	const [supplierPriceLeadTimeDays, setSupplierPriceLeadTimeDays] = React.useState("");
	const [supplierPriceNote, setSupplierPriceNote] = React.useState("");

	const [productName, setProductName] = React.useState("");
	const [productCategory, setProductCategory] = React.useState<ProductCategory>("Beer");
	const [productBarcode, setProductBarcode] = React.useState("");
	const [productPackSize, setProductPackSize] = React.useState("24");
	const [productReorderLevel, setProductReorderLevel] = React.useState("0");

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

	React.useEffect(() => {
		try {
			const raw = localStorage.getItem(QUICK_ACTION_STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return;
			const next = parsed
				.filter((value): value is QuickAction =>
					QUICK_ACTION_ALL.includes(value as QuickAction),
				)
				.slice(0, 5);
			if (next.length > 0) setFavoriteActions(next);
		} catch {
			// Ignore invalid local preference payloads.
		}
	}, []);

	const productById = React.useMemo(
		() => new Map(products.map((product) => [product.id, product])),
		[products],
	);

	const restockSeed = React.useMemo(() => {
		const recommendations = (report?.stockRecommendations ?? []).filter(
			(item) => item.recommendedOrderUnits > 0,
		);
		const perProductRecentMeta = new Map<string, { supplierId: string; unitCostCents: number }>();
		const bestContractByProduct = new Map<string, { supplierId: string; unitCostCents: number }>();

		for (const supplierPrice of supplierPrices) {
			if (!supplierPrice.productId || !supplierPrice.supplierId || supplierPrice.unitCostCents <= 0) continue;
			const existing = bestContractByProduct.get(supplierPrice.productId);
			if (!existing || supplierPrice.unitCostCents < existing.unitCostCents) {
				bestContractByProduct.set(supplierPrice.productId, {
					supplierId: supplierPrice.supplierId,
					unitCostCents: supplierPrice.unitCostCents,
				});
			}
		}

		for (const purchase of purchaseHistory) {
			for (const item of purchase.items ?? []) {
				if (!item.productId || perProductRecentMeta.has(item.productId)) continue;
				perProductRecentMeta.set(item.productId, {
					supplierId: purchase.supplierId ?? "",
					unitCostCents: item.unitCostCents ?? 0,
				});
			}
		}

		const items = recommendations.map((item) => {
			const product = productById.get(item.productId);
			const packSize = Math.max(product?.packSize ?? 1, 1);
			const selectedMeta =
				bestContractByProduct.get(item.productId) ??
				perProductRecentMeta.get(item.productId);
			const recommendedUnits = item.recommendedOrderUnits;
			const cases = Math.floor(recommendedUnits / packSize);
			const singles = recommendedUnits % packSize;
			return {
				productId: item.productId,
				cases: cases > 0 ? String(cases) : "",
				singles: singles > 0 ? String(singles) : "",
				lineSubtotalCents: Math.max(0, recommendedUnits * (selectedMeta?.unitCostCents ?? 0)),
				suggestedSupplierId: selectedMeta?.supplierId ?? "",
			};
		});

		const supplierFrequency = new Map<string, number>();
		for (const item of items) {
			if (!item.suggestedSupplierId) continue;
			supplierFrequency.set(
				item.suggestedSupplierId,
				(supplierFrequency.get(item.suggestedSupplierId) ?? 0) + 1,
			);
		}
		const initialSupplierId = Array.from(supplierFrequency.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? NO_VALUE;
		return {
			items: items.map(({ suggestedSupplierId, ...rest }) => rest),
			initialSupplierId,
		};
	}, [productById, purchaseHistory, report, supplierPrices]);

	React.useEffect(() => {
		if (activeAction === "restock") {
			setPurchaseSupplierId(restockSeed.initialSupplierId || NO_VALUE);
			setPurchaseItems(restockSeed.items.length > 0 ? restockSeed.items : [blankPurchaseItem()]);
		}
		if (activeAction === "purchase") {
			setPurchaseItems([blankPurchaseItem()]);
			setPurchaseSupplierId(NO_VALUE);
			setPurchaseInvoiceNo("");
			setPurchaseDate(date);
		}
		if (activeAction === "opening-stock") {
			setAdjustmentItems([blankAdjustmentItem("OPENING_STOCK")]);
		}
		if (activeAction === "adjustment") {
			setAdjustmentItems([blankAdjustmentItem()]);
		}
	}, [activeAction, date, restockSeed.initialSupplierId, restockSeed.items]);

	const persistFavorites = React.useCallback((next: QuickAction[]) => {
		setFavoriteActions(next);
		try {
			localStorage.setItem(QUICK_ACTION_STORAGE_KEY, JSON.stringify(next));
		} catch {
			// Ignore localStorage write failures.
		}
	}, []);

	const onSaved = React.useCallback(async () => {
		await Promise.all([
			mutate((key) => typeof key === "string" && key.startsWith("/api/products")),
			mutate((key) => typeof key === "string" && key.startsWith("/api/purchases")),
			mutate((key) => typeof key === "string" && key.startsWith("/api/adjustments")),
			mutate((key) => typeof key === "string" && key.startsWith("/api/transactions")),
			mutate((key) => typeof key === "string" && key.startsWith("/api/customers")),
			mutate((key) => typeof key === "string" && key.startsWith("/api/suppliers")),
			mutate((key) => typeof key === "string" && key.startsWith("/api/supplier-prices")),
			mutate((key) => typeof key === "string" && key.startsWith("/api/reports")),
		]);
		setActiveAction(null);
	}, [mutate]);

	const openAction = React.useCallback(
		(action: QuickAction) => {
			pushQuickAddDebugLog("open_action_clicked", { action, pathname });
			setActiveAction(action);
			setOpen(false);
		},
		[pathname],
	);

	const toggleFavoriteAction = React.useCallback(
		(action: QuickAction) => {
			const isFavorite = favoriteActions.includes(action);
			if (isFavorite) {
				persistFavorites(favoriteActions.filter((value) => value !== action));
				return;
			}
			if (favoriteActions.length >= 5) {
				toast.error("You can pin up to 5 quick actions.");
				return;
			}
			persistFavorites([...favoriteActions, action]);
		},
		[favoriteActions, persistFavorites],
	);

	const submitJson = async (
		request: Promise<{ queued: false; response: Response }> | Promise<Response>,
		successMessage: string,
		fallbackMessage: string,
	) => {
		setSaving(true);
		try {
			const result = await request;
			const response = result instanceof Response ? result : result.response;
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(getApiErrorMessage(payload, fallbackMessage));
			}
			toast.success(successMessage);
			await onSaved();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : fallbackMessage);
		} finally {
			setSaving(false);
		}
	};

	const postJson = (url: string, body: Record<string, unknown>) =>
		fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

	const getPurchaseUnits = React.useCallback(
		(item: PurchaseItemForm) => {
			const packSize = Math.max(productById.get(item.productId)?.packSize ?? 1, 1);
			return toInt(item.cases) * packSize + toInt(item.singles);
		},
		[productById],
	);

	const savePurchase = async () => {
		const items = purchaseItems
			.map((item) => ({ ...item, units: getPurchaseUnits(item) }))
			.filter((item) => item.productId && item.units > 0)
			.map((item) => ({
				productId: item.productId,
				cases: toInt(item.cases),
				singles: toInt(item.singles),
				units: item.units,
				lineSubtotalCents: item.lineSubtotalCents,
			}));

		if (items.length === 0) {
			toast.error("Add at least one purchased product.");
			return;
		}

		await submitJson(
			postPurchaseWithOfflineQueue({
				date,
				supplierId: purchaseSupplierId === NO_VALUE ? undefined : purchaseSupplierId,
				invoiceNo: optionalText(purchaseInvoiceNo),
				purchaseDate,
				items,
			}),
			activeAction === "restock" ? "Restock purchase saved" : "Purchase saved",
			"Failed to save purchase",
		);
	};

	const saveAdjustment = async () => {
		const openingStockMode = activeAction === "opening-stock";
		const items = adjustmentItems
			.filter((item) => item.productId && toInt(item.unitsDelta) !== 0 && (openingStockMode || item.reason))
			.map((item) => ({
				productId: item.productId,
				unitsDelta: toInt(item.unitsDelta),
				reason: openingStockMode ? "OPENING_STOCK" : item.reason,
				note: optionalText(item.note),
			}));

		if (items.length === 0) {
			toast.error(openingStockMode ? "Add at least one stock item." : "Add at least one adjustment.");
			return;
		}

		await submitJson(
			postAdjustmentWithOfflineQueue({ date, items }),
			openingStockMode ? "Existing stock saved" : "Adjustment saved",
			openingStockMode ? "Failed to save existing stock" : "Failed to save adjustment",
		);
	};

	const savePayment = async () => {
		if (!paymentCustomerId) {
			toast.error("Select a customer.");
			return;
		}
		if (paymentAmountCents <= 0) {
			toast.error("Enter a payment amount.");
			return;
		}
		await submitJson(
			postTabPaymentWithOfflineQueue({
				date,
				customerId: paymentCustomerId,
				amountCents: paymentAmountCents,
				paymentMethod,
				cashReceivedCents:
					paymentMethod === "CASH" ? paymentCashReceivedCents || paymentAmountCents : undefined,
				reference: optionalText(paymentReference),
				note: optionalText(paymentNote),
			}),
			"Account payment saved",
			"Failed to save payment",
		);
	};

	const saveExpense = async () => {
		if (expenseAmountCents <= 0) {
			toast.error("Enter an expense amount.");
			return;
		}
		await submitJson(
			postTabExpenseWithOfflineQueue({
				date,
				amountCents: expenseAmountCents,
				reason: expenseReason,
				category: expenseCategory,
				payee: expensePayee,
				reference: optionalText(expenseReference),
				note: optionalText(expenseNote),
			}),
			"Expense saved",
			"Failed to save expense",
		);
	};

	const saveCustomer = async () => {
		await submitJson(
			postJson("/api/customers", {
				name: customerName,
				phone: optionalText(customerPhone) ?? null,
				note: optionalText(customerNote),
				customerMode,
				isTemporaryTab: customerTemporaryTab,
				openingBalanceCents: customerOpeningBalanceCents,
				creditLimitCents: customerCreditLimitCents,
				dueDays: optionalText(customerDueDays) ? toInt(customerDueDays) : undefined,
			}),
			"Customer saved",
			"Failed to save customer",
		);
	};

	const saveSupplier = async () => {
		await submitJson(
			postJson("/api/suppliers", {
				name: supplierName,
				phone: optionalText(supplierPhone),
				notes: optionalText(supplierNotes),
			}),
			"Supplier saved",
			"Failed to save supplier",
		);
	};

	const saveSupplierPrice = async () => {
		if (supplierPriceSupplierId === NO_VALUE || !supplierPriceProductId) {
			toast.error("Select supplier and product.");
			return;
		}
		await submitJson(
			postJson("/api/supplier-prices", {
				supplierId: supplierPriceSupplierId,
				productId: supplierPriceProductId,
				unitCostCents: supplierPriceCostCents,
				effectiveFrom: supplierPriceEffectiveFrom,
				moqUnits: optionalText(supplierPriceMoqUnits) ? toInt(supplierPriceMoqUnits) : undefined,
				leadTimeDays: optionalText(supplierPriceLeadTimeDays)
					? toInt(supplierPriceLeadTimeDays)
					: undefined,
				note: optionalText(supplierPriceNote),
			}),
			"Supplier cost saved",
			"Failed to save supplier cost",
		);
	};

	const saveProduct = async () => {
		await submitJson(
			postJson("/api/products", {
				name: productName,
				category: productCategory,
				barcode: optionalText(productBarcode),
				packSize: Math.max(1, toInt(productPackSize)),
				reorderLevelUnits: Math.max(0, toInt(productReorderLevel)),
			}),
			"Product saved",
			"Failed to save product",
		);
	};

	const pagePrimaryActions = React.useMemo<QuickAction[]>(() => {
		if (pathname.startsWith("/stock-counts")) return [];
		if (pathname.startsWith("/products")) return ["product"];
		if (pathname.startsWith("/purchases")) return ["purchase"];
		if (pathname.startsWith("/suppliers")) return ["supplier"];
		if (pathname.startsWith("/purchase-assistant")) return ["restock"];
		if (pathname.startsWith("/adjustments")) return ["adjustment"];
		if (pathname.startsWith("/tabs")) return ["account-payment"];
		if (pathname.startsWith("/transactions")) return ["expense"];
		if (pathname.startsWith("/reports")) return ["restock"];
		if (pathname.startsWith("/dashboard")) return ["morning-count"];
		return [];
	}, [pathname]);

	const showInMoreActions = (action: QuickAction) =>
		!favoriteActions.includes(action) && !pagePrimaryActions.includes(action);

	const renderQuickActionButton = (action: QuickAction, variant?: "outline" | "secondary") => {
		const label = getQuickActionLabel(action, restockSeed.items.length);
		const icon = getQuickActionIcon(action);
		if (action === "morning-count") {
			return (
				<Button
					key={action}
					asChild
					variant={variant}
					className="h-auto w-full justify-start py-2 text-left"
					onClick={() => setOpen(false)}
				>
					<Link href={`/stock-counts?date=${date}`}>
						{icon}
						<span>{label}</span>
					</Link>
				</Button>
			);
		}
		return (
			<ActionBtn
				key={action}
				label={label}
				icon={icon}
				variant={variant}
				onClick={() => openAction(action)}
				disabled={action === "restock" && restockSeed.items.length === 0}
			/>
		);
	};

	const visiblePinnedActions = React.useMemo(
		() => favoriteActions.filter((action) => !pagePrimaryActions.includes(action)),
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
						<Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
							<Plus className="h-5 w-5" />
							<span className="sr-only">Open quick actions</span>
						</Button>
					</PopoverTrigger>
					<PopoverContent side="top" align="end" className="w-[calc(100vw-2rem)] max-w-sm p-2 md:w-80">
						<div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
							{pagePrimaryActions.length > 0 && (
								<>
									<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">This Page</p>
									{pagePrimaryActions.map((action) => renderQuickActionButton(action, "secondary"))}
								</>
							)}

							<p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pinned</p>
							{visiblePinnedActions.length === 0 ? (
								<p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
									No pinned actions. Use Pin Shortcuts to manage pins.
								</p>
							) : (
								visiblePinnedActions.map((action) => renderQuickActionButton(action, "outline"))
							)}

							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="justify-between px-2"
								onClick={() => setShowPinShortcuts((prev) => !prev)}
							>
								<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pin Shortcuts</span>
								{showPinShortcuts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
							</Button>

							{showPinShortcuts && (
								<div className="rounded-md border p-2">
									<div className="grid grid-cols-1 gap-1">
										{QUICK_ACTION_ALL.map((action) => {
											const pinned = favoriteActions.includes(action);
											return (
												<Button
													key={action}
													type="button"
													variant="ghost"
													size="sm"
													className="justify-between"
													onClick={() => toggleFavoriteAction(action)}
												>
													<span className="truncate text-sm">{getQuickActionLabel(action, restockSeed.items.length)}</span>
													<Star className={`h-4 w-4 ${pinned ? "fill-current text-amber-500" : "text-muted-foreground"}`} />
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
								onClick={() => setShowMoreActions((prev) => !prev)}
							>
								<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">More Actions</span>
								{showMoreActions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
							</Button>

							{showMoreActions && QUICK_ACTION_ALL.filter(showInMoreActions).map((action) => renderQuickActionButton(action, "outline"))}
						</div>
					</PopoverContent>
				</Popover>
			</div>

			<Dialog open={activeAction !== null} onOpenChange={(nextOpen) => !nextOpen && setActiveAction(null)}>
				<DialogContent className={MODAL_CONTENT_CLASS}>
					{renderDialogContent()}
				</DialogContent>
			</Dialog>
		</>
	);

	function renderDialogContent() {
		if (activeAction === "purchase" || activeAction === "restock") {
			return renderPurchaseDialog(activeAction === "restock");
		}
		if (activeAction === "adjustment" || activeAction === "opening-stock") {
			return renderAdjustmentDialog(activeAction === "opening-stock");
		}
		if (activeAction === "account-payment") return renderPaymentDialog();
		if (activeAction === "expense") return renderExpenseDialog();
		if (activeAction === "customer") return renderCustomerDialog();
		if (activeAction === "supplier") return renderSupplierDialog();
		if (activeAction === "supplier-price") return renderSupplierPriceDialog();
		if (activeAction === "product") return renderProductDialog();
		return null;
	}

	function renderPurchaseDialog(isRestock: boolean) {
		return (
			<>
				<DialogHeader>
					<DialogTitle>{isRestock ? "Restock Low Stock" : "Add Purchase"}</DialogTitle>
					<DialogDescription>
						{isRestock
							? "Use the current recommendations as a starting point, then adjust quantities before saving."
							: "Record supplier stock received today."}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="grid gap-3 md:grid-cols-3">
						<div className="space-y-2">
							<Label>Supplier</Label>
							<Select value={purchaseSupplierId} onValueChange={setPurchaseSupplierId}>
								<SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_VALUE}>No supplier</SelectItem>
									{suppliers.map((supplier) => (
										<SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Invoice No.</Label>
							<Input value={purchaseInvoiceNo} onChange={(event) => setPurchaseInvoiceNo(event.target.value)} placeholder="Optional" />
						</div>
						<div className="space-y-2">
							<Label>Purchase Date</Label>
							<Input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
						</div>
					</div>

					<div className="space-y-3">
						{purchaseItems.map((item, index) => {
							const units = getPurchaseUnits(item);
							return (
								<div key={index} className="rounded-lg border p-3 space-y-3">
									<div className="flex items-center justify-between gap-2">
										<p className="text-sm font-medium">Item {index + 1}</p>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											disabled={purchaseItems.length === 1}
											onClick={() => setPurchaseItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
									<ProductSelect
										products={products}
										value={item.productId}
										onChange={(productId) => updatePurchaseItem(index, { productId })}
									/>
									<div className="grid gap-3 md:grid-cols-3">
										<LabeledInput label="Cases" value={item.cases} onChange={(value) => updatePurchaseItem(index, { cases: cleanIntInput(value) })} />
										<LabeledInput label="Singles" value={item.singles} onChange={(value) => updatePurchaseItem(index, { singles: cleanIntInput(value) })} />
										<MoneyInput label="Line cost" value={item.lineSubtotalCents} onChange={(value) => updatePurchaseItem(index, { lineSubtotalCents: value })} />
									</div>
									<p className="text-xs text-muted-foreground">Total units: {units}</p>
								</div>
							);
						})}
					</div>
					<Button type="button" variant="outline" onClick={() => setPurchaseItems((prev) => [...prev, blankPurchaseItem()])}>Add Item</Button>
					<DialogActions saving={saving} onCancel={() => setActiveAction(null)} onSave={savePurchase} />
				</div>
			</>
		);
	}

	function renderAdjustmentDialog(openingStockMode: boolean) {
		return (
			<>
				<DialogHeader>
					<DialogTitle>{openingStockMode ? "Add Existing Stock" : "Add Adjustment"}</DialogTitle>
					<DialogDescription>
						{openingStockMode
							? "Add existing stock. Use Morning Count separately for the daily count workflow."
							: "Capture breakage, freebies, theft, or count corrections."}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					{adjustmentItems.map((item, index) => (
						<div key={index} className="rounded-lg border p-3 space-y-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-medium">Item {index + 1}</p>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									disabled={adjustmentItems.length === 1}
									onClick={() => setAdjustmentItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<ProductSelect
								products={products}
								value={item.productId}
								onChange={(productId) => updateAdjustmentItem(index, { productId })}
							/>
							<div className="grid gap-3 md:grid-cols-2">
								<LabeledInput
									label={openingStockMode ? "Units to add" : "Units delta"}
									value={item.unitsDelta}
									onChange={(value) => updateAdjustmentItem(index, { unitsDelta: cleanIntInput(value, !openingStockMode) })}
								/>
								{openingStockMode ? (
									<div className="space-y-2">
										<Label>Reason</Label>
										<Input value="Existing Stock" disabled />
									</div>
								) : (
									<div className="space-y-2">
										<Label>Reason</Label>
										<Select value={item.reason} onValueChange={(reason) => updateAdjustmentItem(index, { reason: reason as AdjustmentReason })}>
											<SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
											<SelectContent>
												{ADJUSTMENT_REASONS.map((reason) => (
													<SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
							<div className="space-y-2">
								<Label>Note</Label>
								<Textarea rows={2} value={item.note} onChange={(event) => updateAdjustmentItem(index, { note: event.target.value })} placeholder="Optional" />
							</div>
						</div>
					))}
					<Button type="button" variant="outline" onClick={() => setAdjustmentItems((prev) => [...prev, blankAdjustmentItem(openingStockMode ? "OPENING_STOCK" : "")])}>Add Item</Button>
					<DialogActions saving={saving} onCancel={() => setActiveAction(null)} onSave={saveAdjustment} />
				</div>
			</>
		);
	}

	function renderPaymentDialog() {
		const changeCents = paymentMethod === "CASH" ? Math.max(0, paymentCashReceivedCents - paymentAmountCents) : 0;
		return (
			<>
				<DialogHeader>
					<DialogTitle>Add Account Payment</DialogTitle>
					<DialogDescription>Record a customer payment against an existing account balance.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<CustomerSelect customers={customers} value={paymentCustomerId} onChange={setPaymentCustomerId} />
					<div className="grid gap-3 md:grid-cols-2">
						<MoneyInput label="Payment amount" value={paymentAmountCents} onChange={setPaymentAmountCents} />
						<div className="space-y-2">
							<Label>Payment method</Label>
							<Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="CASH">Cash</SelectItem>
									<SelectItem value="CARD">Card</SelectItem>
									<SelectItem value="EFT">EFT</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					{paymentMethod === "CASH" && (
						<div className="rounded-lg border p-3 space-y-2">
							<MoneyInput label="Cash received" value={paymentCashReceivedCents} onChange={setPaymentCashReceivedCents} />
							<p className="text-sm text-muted-foreground">Change: {formatZAR(changeCents)}</p>
						</div>
					)}
					<div className="grid gap-3 md:grid-cols-2">
						<LabeledInput label="Reference" value={paymentReference} onChange={setPaymentReference} placeholder="Optional" />
						<div className="space-y-2">
							<Label>Note</Label>
							<Textarea rows={2} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Optional" />
						</div>
					</div>
					<DialogActions saving={saving} onCancel={() => setActiveAction(null)} onSave={savePayment} />
				</div>
			</>
		);
	}

	function renderExpenseDialog() {
		return (
			<>
				<DialogHeader>
					<DialogTitle>Add Expense</DialogTitle>
					<DialogDescription>Record non-stock cash leaving the business.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="grid gap-3 md:grid-cols-2">
						<MoneyInput label="Amount" value={expenseAmountCents} onChange={setExpenseAmountCents} />
						<div className="space-y-2">
							<Label>Category</Label>
							<Select value={expenseCategory} onValueChange={(value) => setExpenseCategory(value as (typeof EXPENSE_CATEGORIES)[number])}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{EXPENSE_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<LabeledInput label="Payee" value={expensePayee} onChange={setExpensePayee} />
						<LabeledInput label="Reference" value={expenseReference} onChange={setExpenseReference} placeholder="Optional" />
					</div>
					<div className="space-y-2">
						<Label>Reason</Label>
						<Textarea rows={2} value={expenseReason} onChange={(event) => setExpenseReason(event.target.value)} />
					</div>
					<div className="space-y-2">
						<Label>Note</Label>
						<Textarea rows={2} value={expenseNote} onChange={(event) => setExpenseNote(event.target.value)} placeholder="Optional" />
					</div>
					<DialogActions saving={saving} onCancel={() => setActiveAction(null)} onSave={saveExpense} />
				</div>
			</>
		);
	}

	function renderCustomerDialog() {
		return (
			<>
				<DialogHeader>
					<DialogTitle>Add Customer</DialogTitle>
					<DialogDescription>Create a customer/account contact.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="grid gap-3 md:grid-cols-2">
						<LabeledInput label="Name" value={customerName} onChange={setCustomerName} />
						<LabeledInput label="Phone" value={customerPhone} onChange={setCustomerPhone} placeholder="Optional" />
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div className="space-y-2">
							<Label>Mode</Label>
							<Select value={customerMode} onValueChange={(value) => setCustomerMode(value as "ACCOUNT" | "DEBT_ONLY")}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="ACCOUNT">Account</SelectItem>
									<SelectItem value="DEBT_ONLY">Debt only</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<LabeledInput label="Due days" value={customerDueDays} onChange={(value) => setCustomerDueDays(cleanIntInput(value))} placeholder="Optional" />
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<MoneyInput label="Opening balance" value={customerOpeningBalanceCents} onChange={setCustomerOpeningBalanceCents} />
						<MoneyInput label="Credit limit" value={customerCreditLimitCents} onChange={setCustomerCreditLimitCents} />
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={customerTemporaryTab} onChange={(event) => setCustomerTemporaryTab(event.target.checked)} />
						Temporary tab
					</label>
					<div className="space-y-2">
						<Label>Note</Label>
						<Textarea rows={2} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Optional" />
					</div>
					<DialogActions saving={saving} onCancel={() => setActiveAction(null)} onSave={saveCustomer} />
				</div>
			</>
		);
	}

	function renderSupplierDialog() {
		return (
			<>
				<DialogHeader>
					<DialogTitle>Add Supplier</DialogTitle>
					<DialogDescription>Create a supplier record.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="grid gap-3 md:grid-cols-2">
						<LabeledInput label="Name" value={supplierName} onChange={setSupplierName} />
						<LabeledInput label="Phone" value={supplierPhone} onChange={setSupplierPhone} placeholder="Optional" />
					</div>
					<div className="space-y-2">
						<Label>Notes</Label>
						<Textarea rows={3} value={supplierNotes} onChange={(event) => setSupplierNotes(event.target.value)} placeholder="Optional" />
					</div>
					<DialogActions saving={saving} onCancel={() => setActiveAction(null)} onSave={saveSupplier} />
				</div>
			</>
		);
	}

	function renderSupplierPriceDialog() {
		return (
			<>
				<DialogHeader>
					<DialogTitle>Set Supplier Cost</DialogTitle>
					<DialogDescription>Save the current cost for a product from a supplier.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="grid gap-3 md:grid-cols-2">
						<div className="space-y-2">
							<Label>Supplier</Label>
							<Select value={supplierPriceSupplierId} onValueChange={setSupplierPriceSupplierId}>
								<SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_VALUE}>Select supplier</SelectItem>
									{suppliers.map((supplier) => (
										<SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<ProductSelect products={products} value={supplierPriceProductId} onChange={setSupplierPriceProductId} />
					</div>
					<div className="grid gap-3 md:grid-cols-3">
						<MoneyInput label="Unit cost" value={supplierPriceCostCents} onChange={setSupplierPriceCostCents} />
						<div className="space-y-2">
							<Label>Effective from</Label>
							<Input type="date" value={supplierPriceEffectiveFrom} onChange={(event) => setSupplierPriceEffectiveFrom(event.target.value)} />
						</div>
						<LabeledInput label="MOQ units" value={supplierPriceMoqUnits} onChange={(value) => setSupplierPriceMoqUnits(cleanIntInput(value))} placeholder="Optional" />
					</div>
					<LabeledInput label="Lead time days" value={supplierPriceLeadTimeDays} onChange={(value) => setSupplierPriceLeadTimeDays(cleanIntInput(value))} placeholder="Optional" />
					<div className="space-y-2">
						<Label>Note</Label>
						<Textarea rows={2} value={supplierPriceNote} onChange={(event) => setSupplierPriceNote(event.target.value)} placeholder="Optional" />
					</div>
					<DialogActions saving={saving} onCancel={() => setActiveAction(null)} onSave={saveSupplierPrice} />
				</div>
			</>
		);
	}

	function renderProductDialog() {
		return (
			<>
				<DialogHeader>
					<DialogTitle>Add Product</DialogTitle>
					<DialogDescription>Create a product and set its stock pack details.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="grid gap-3 md:grid-cols-2">
						<LabeledInput label="Name" value={productName} onChange={setProductName} />
						<div className="space-y-2">
							<Label>Category</Label>
							<Select value={productCategory} onValueChange={(value) => setProductCategory(value as ProductCategory)}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
					</div>
					<LabeledInput label="Barcode" value={productBarcode} onChange={setProductBarcode} placeholder="Optional" />
					<div className="grid gap-3 md:grid-cols-2">
						<LabeledInput label="Pack size" value={productPackSize} onChange={(value) => setProductPackSize(cleanIntInput(value))} />
						<LabeledInput label="Reorder level units" value={productReorderLevel} onChange={(value) => setProductReorderLevel(cleanIntInput(value))} />
					</div>
					<DialogActions saving={saving} onCancel={() => setActiveAction(null)} onSave={saveProduct} />
				</div>
			</>
		);
	}

	function updatePurchaseItem(index: number, patch: Partial<PurchaseItemForm>) {
		setPurchaseItems((prev) =>
			prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
		);
	}

	function updateAdjustmentItem(index: number, patch: Partial<AdjustmentItemForm>) {
		setAdjustmentItems((prev) =>
			prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
		);
	}
}

function ActionBtn({
	label,
	icon,
	variant,
	onClick,
	disabled,
}: {
	label: string;
	icon: React.ReactNode;
	variant?: "outline" | "secondary";
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<Button
			type="button"
			variant={variant}
			className="h-auto w-full justify-start py-2 text-left"
			onClick={onClick}
			disabled={disabled}
		>
			{icon}
			<span>{label}</span>
		</Button>
	);
}

function LabeledInput({
	label,
	value,
	onChange,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}) {
	const id = React.useId();
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
			/>
		</div>
	);
}

function DialogActions({
	saving,
	onCancel,
	onSave,
}: {
	saving: boolean;
	onCancel: () => void;
	onSave: () => void | Promise<void>;
}) {
	return (
		<div className="flex justify-end gap-2 border-t pt-4">
			<Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
				Cancel
			</Button>
			<Button type="button" disabled={saving} onClick={onSave}>
				{saving ? "Saving..." : "Save"}
			</Button>
		</div>
	);
}
