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
import {
	Box,
	CreditCard,
	DollarSign,
	PackageMinus,
	Plus,
	Receipt,
	ShoppingCart,
	Trash2,
	Truck,
	Users,
} from "lucide-react";
import {
	formatDateDisplay,
	getTodayJHB,
} from "@/lib/date-utils";
import { formatZAR } from "@/lib/money";
import type {
	AdjustmentReason,
	Customer,
	PaymentMethod,
	Product,
	Supplier,
} from "@/lib/types";

const ENABLED_PATHS = [
	"/dashboard",
	"/reports",
	"/products",
	"/purchases",
	"/suppliers",
	"/adjustments",
	"/tabs",
	"/transactions",
];

const MODAL_CONTENT_CLASS =
	"h-[70vh] w-[90vw] max-w-[90vw] overflow-hidden p-0 md:max-w-3xl";

type QuickAction =
	| "quick-checkout"
	| "direct-sale"
	| "account-sale"
	| "account-payment"
	| "restock"
	| "customer"
	| "supplier"
	| "supplier-price"
	| "product"
	| "purchase"
	| "adjustment";

interface ChargeItem {
	productId: string;
	units: string;
	discountCents: number;
}

interface PurchaseItemForm {
	productId: string;
	cases: string;
	singles: string;
	unitCostCents: number;
	discountCents: number;
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
	discountCents?: number;
	items?: {
		productId: string;
		units: number;
		discountCents?: number;
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

export function GlobalQuickActions() {
	const pathname = usePathname();
	const show = ENABLED_PATHS.some((path) =>
		pathname.startsWith(path),
	);
	const [open, setOpen] = React.useState(false);
	const [activeAction, setActiveAction] =
		React.useState<QuickAction | null>(null);
	const date = React.useMemo(() => getTodayJHB(), []);
	const { mutate } = useSWRConfig();

	const { data: products = [] } = useSWR<
		Product[]
	>("/api/products", fetcher);
	const { data: customers = [] } = useSWR<
		Customer[]
	>("/api/customers", fetcher);
	const { data: suppliers = [] } = useSWR<
		Supplier[]
	>("/api/suppliers", fetcher);
	const { data: report } = useSWR<DailyReportLite>(
		`/api/reports/daily?date=${date}`,
		fetcher,
	);
	const { data: purchaseHistory = [] } = useSWR<
		PurchaseHistoryLite[]
	>(
		`/api/purchases?date=${date}&lookbackDays=60`,
		fetcher,
	);
	const { data: supplierPrices = [] } = useSWR<
		SupplierPriceLite[]
	>(
		`/api/supplier-prices?asOf=${date}`,
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
						unitCostCents:
							selectedMeta?.unitCostCents ?? 0,
						discountCents: 0,
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

	if (!show) return null;

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

	return (
		<>
			<div className="fixed bottom-4 right-4 z-40">
				<Popover
					open={open}
					onOpenChange={setOpen}
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
						className="w-64 p-2"
					>
						<div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
							<ActionBtn
								label="Quick Checkout"
								icon={
									<Receipt className="mr-2 h-4 w-4" />
								}
								variant="secondary"
								onClick={() => {
									setActiveAction(
										"quick-checkout",
									);
									setOpen(false);
								}}
							/>
							<ActionBtn
								label="Add Direct Sale"
								icon={
									<Receipt className="mr-2 h-4 w-4" />
								}
								variant="outline"
								onClick={() => {
									setActiveAction("direct-sale");
									setOpen(false);
								}}
							/>
							<ActionBtn
								label="Add Sale to Account"
								icon={
									<Receipt className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction("account-sale");
									setOpen(false);
								}}
							/>
							<ActionBtn
								label="Add Account Payment"
								icon={
									<CreditCard className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction(
										"account-payment",
									);
									setOpen(false);
								}}
							/>
							<ActionBtn
								label={`Restock Low Stock (${restockSeed.items.length})`}
								icon={
									<ShoppingCart className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction("restock");
									setOpen(false);
								}}
								disabled={
									restockSeed.items.length === 0
								}
							/>
							<ActionBtn
								label="Add Customer"
								icon={
									<Users className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction("customer");
									setOpen(false);
								}}
							/>
							<ActionBtn
								label="Add Supplier"
								icon={
									<Truck className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction("supplier");
									setOpen(false);
								}}
							/>
							<ActionBtn
								label="Set Supplier Cost"
								icon={
									<DollarSign className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction("supplier-price");
									setOpen(false);
								}}
							/>
							<ActionBtn
								label="Add Product"
								icon={
									<Box className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction("product");
									setOpen(false);
								}}
							/>
							<ActionBtn
								label="Add Purchase"
								icon={
									<ShoppingCart className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction("purchase");
									setOpen(false);
								}}
							/>
							<ActionBtn
								label="Add Adjustment"
								icon={
									<PackageMinus className="mr-2 h-4 w-4" />
								}
								onClick={() => {
									setActiveAction("adjustment");
									setOpen(false);
								}}
							/>
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
						description={`Scan barcode, set quantity, and save paid sale for ${formatDateDisplay(date)}.`}
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
							onSuccess={onSaved}
						/>
					</ActionDialog>
				)}
				{activeAction === "direct-sale" && (
					<ActionDialog
						title="Add Direct Sale"
						description={`Record an immediate paid sale for ${formatDateDisplay(date)}.`}
					>
						<DirectSaleForm
							products={products}
							date={date}
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

function ItemsSection({
	items,
	products,
	onRemove,
	onChange,
}: {
	items: ChargeItem[];
	products: Product[];
	onRemove: (index: number) => void;
	onChange: (
		index: number,
		updates: Partial<ChargeItem>,
	) => void;
}) {
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

	return (
		<div className="flex h-[50vh] min-h-0 flex-1 flex-col space-y-2">
			<Label>Items Sold</Label>
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
				{items.map((item, index) => {
					const units =
						parseInt(item.units, 10) || 0;
					const unitPrice =
						productPriceById.get(item.productId) ??
						0;
					const subtotalCents = unitPrice * units;
					const netCents = Math.max(
						0,
						subtotalCents - item.discountCents,
					);
					return (
						<div key={index} className="space-y-1">
							<div className="flex items-end gap-2">
								<div className="flex-1">
									<ProductSelect
										products={products}
										value={item.productId}
										onChange={(v) =>
											onChange(index, {
												productId: v,
											})
										}
										placeholder="Product"
									/>
								</div>
								<div className="w-20">
									<Input
										type="number"
										min="1"
										value={item.units}
										onChange={(e) =>
											onChange(index, {
												units: e.target.value,
											})
										}
										placeholder="Qty"
									/>
								</div>
								<div className="w-32 space-y-1">
									<Label className="text-xs">
										Item Discount
									</Label>
									<MoneyInput
										className="space-y-0"
										value={item.discountCents}
										onChange={(v) =>
											onChange(index, {
												discountCents: v,
											})
										}
										placeholder="0.00"
									/>
								</div>
								{items.length > 1 && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() =>
											onRemove(index)
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								)}
							</div>
							<p className="text-[11px] text-muted-foreground">
								Subtotal {formatZAR(subtotalCents)} | Net{" "}
								{formatZAR(netCents)}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function BottomItemButtons({
	onAddItem,
	showNote,
	setShowNote,
	note,
	setNote,
	notePlaceholder,
}: {
	onAddItem: () => void;
	showNote: boolean;
	setShowNote: React.Dispatch<
		React.SetStateAction<boolean>
	>;
	note: string;
	setNote: React.Dispatch<
		React.SetStateAction<string>
	>;
	notePlaceholder: string;
}) {
	return (
		<div className="space-y-2">
			<div className="grid grid-cols-2 gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-full"
					onClick={onAddItem}
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Item
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
					{showNote ? "Hide Note" : "Add Note"}
				</Button>
			</div>
			{showNote && (
				<Textarea
					value={note}
					onChange={(e) =>
						setNote(e.target.value)
					}
					placeholder={notePlaceholder}
					rows={2}
				/>
			)}
		</div>
	);
}

function QuickCheckoutForm({
	products,
	quickProducts,
	date,
	onSuccess,
}: {
	products: Product[];
	quickProducts: QuickProductLite[];
	date: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [scanInput, setScanInput] =
		React.useState("");
	const [items, setItems] = React.useState<
		ChargeItem[]
	>([]);
	const [paymentMethod, setPaymentMethod] =
		React.useState<PaymentMethod>("CASH");
	const [discountCents, setDiscountCents] =
		React.useState(0);
	const [manualProductId, setManualProductId] =
		React.useState("");
	const [manualUnits, setManualUnits] =
		React.useState("1");
	const [showManualAdd, setShowManualAdd] =
		React.useState(false);
	const [showTopSellers, setShowTopSellers] =
		React.useState(false);
	const [showFastRepeat, setShowFastRepeat] =
		React.useState(false);
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
		`/api/transactions?date=${date}&limit=60`,
		fetcher,
	);

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
						p,
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
				txn.discountCents ?? 0,
				...validItems
					.map((item) =>
						[
							item.productId,
							item.units,
							item.discountCents ?? 0,
						].join(":"),
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
					discountCents:
						item.discountCents ?? 0,
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
			setDiscountCents(template.discountCents ?? 0);
			requestAnimationFrame(() =>
				scanInputRef.current?.focus(),
			);
		},
		[],
	);

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

	const addByBarcode = React.useCallback(
		(rawCode: string) => {
			const normalizedCode = rawCode
				.trim()
				.toLowerCase();
			if (!normalizedCode) return;
			const matchedProduct =
				productByBarcode.get(normalizedCode);
			if (!matchedProduct) {
				toast.error(
					`No product for barcode "${rawCode.trim()}"`,
				);
				return;
			}

			setItems((prev) => {
				const existingIndex = prev.findIndex(
					(item) =>
						item.productId === matchedProduct.id,
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
										) || 0) + 1,
									),
							  }
							: item,
					);
				}
				return [
					...prev,
					{
						productId: matchedProduct.id,
						units: "1",
						discountCents: 0,
					},
				];
			});
			setScanInput("");
			requestAnimationFrame(() =>
				scanInputRef.current?.focus(),
			);
		},
		[productByBarcode],
	);

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

	const addManualItem = React.useCallback(() => {
		const units =
			parseInt(manualUnits, 10) || 0;
		if (!manualProductId || units <= 0) {
			toast.error(
				"Select product and quantity first",
			);
			return;
		}
		setItems((prev) => {
			const existingIndex = prev.findIndex(
				(item) => item.productId === manualProductId,
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
									) || 0) + units,
							  ),
						  }
						: item,
				);
			}
			return [
				...prev,
				{
					productId: manualProductId,
					units: String(units),
					discountCents: 0,
				},
			];
		});
		setManualProductId("");
		setManualUnits("1");
		requestAnimationFrame(() =>
			scanInputRef.current?.focus(),
		);
	}, [manualProductId, manualUnits]);

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
						discountCents: 0,
					},
				];
			});
			requestAnimationFrame(() =>
				scanInputRef.current?.focus(),
			);
		},
		[],
	);

	const scheduleAutoAdd = React.useCallback(
		(rawCode: string) => {
			if (autoAddTimerRef.current) {
				clearTimeout(autoAddTimerRef.current);
			}
			autoAddTimerRef.current = setTimeout(() => {
				addByBarcode(rawCode);
			}, 80);
		},
		[addByBarcode],
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
		setLoading(true);

		const validItems = items
			.map((item) => ({
				productId: item.productId,
				units: parseInt(item.units, 10) || 0,
				discountCents:
					item.discountCents > 0
						? item.discountCents
						: undefined,
			}))
			.filter((item) => item.units > 0);

		if (!validItems.length) {
			toast.error("Scan at least one item");
			setLoading(false);
			return;
		}

		try {
			const res = await fetch("/api/sales", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					date,
					paymentMethod,
					discountCents:
						discountCents > 0
							? discountCents
							: undefined,
					items: validItems,
				}),
			});
			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to complete checkout",
					),
				);
			}
			toast.success("Checkout saved");
			setItems([]);
			setScanInput("");
			setDiscountCents(0);
			fastKeyStreakRef.current = 0;
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
				<div className="space-y-2">
					<Label>Scan Barcode</Label>
					<div className="flex gap-2">
						<Input
							ref={scanInputRef}
							value={scanInput}
							onChange={(e) => {
								const nextValue =
									e.target.value;
								const now = Date.now();
								const addedChars =
									nextValue.length -
									scanInput.length;

								if (addedChars > 1) {
									if (
										nextValue.trim().length >=
										6
									) {
										scheduleAutoAdd(
											nextValue,
										);
									}
								} else if (
									addedChars === 1
								) {
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
							}}
							onKeyDown={(e) => {
								if (e.key !== "Enter") return;
								e.preventDefault();
								addByBarcode(scanInput);
							}}
							placeholder="Scan and press Enter"
						/>
						<Button
							type="button"
							variant="outline"
							onClick={() =>
								addByBarcode(scanInput)
							}
						>
							Add
						</Button>
					</div>
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
							const netCents = Math.max(
								0,
								subtotalCents -
									item.discountCents,
							);
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
											{formatZAR(netCents)}
										</p>
									</div>
									<div className="mb-2">
										<MoneyInput
											label="Item Discount"
											className="space-y-1"
											value={
												item.discountCents
											}
											onChange={(value) =>
												setItems((prev) =>
													prev.map((line) =>
														line.productId ===
															item.productId
																? {
																		...line,
																		discountCents:
																			value,
																  }
																: line,
													),
												)
											}
										/>
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
											variant="ghost"
											size="sm"
											onClick={() =>
												removeItem(
													item.productId,
												)
											}
										>
											Remove
										</Button>
									</div>
									<p className="mt-2 text-[11px] text-muted-foreground">
										Subtotal {formatZAR(subtotalCents)} | Net{" "}
										{formatZAR(netCents)}
									</p>
								</div>
							);
						})
					)}
				</div>
				<div className="space-y-2">
					<div className="grid grid-cols-3 gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								setShowManualAdd((v) => !v)
							}
						>
							{showManualAdd
								? "Hide Manual"
								: "Manual Add"}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={quickProducts.length === 0}
							onClick={() =>
								setShowTopSellers((v) => !v)
							}
						>
							{showTopSellers
								? "Hide Top"
								: "Top Sellers"}
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							disabled={repeatTemplates.length === 0}
							onClick={() =>
								setShowFastRepeat((v) => !v)
							}
						>
							{showFastRepeat
								? "Hide Repeat"
								: "Fast Repeat"}
						</Button>
					</div>
					{showManualAdd && (
						<div className="space-y-2 rounded-md border p-2">
							<Label>Manual Add</Label>
							<div className="grid grid-cols-12 gap-2">
								<div className="col-span-8">
									<ProductSelect
										products={products}
										value={manualProductId}
										onChange={setManualProductId}
										placeholder="Select product"
									/>
								</div>
								<div className="col-span-2">
									<Input
										type="number"
										min="1"
										value={manualUnits}
										onChange={(e) =>
											setManualUnits(
												e.target.value,
											)
										}
										placeholder="Qty"
									/>
								</div>
								<div className="col-span-2">
									<Button
										type="button"
										variant="outline"
										className="w-full"
										onClick={addManualItem}
									>
										Add
									</Button>
								</div>
							</div>
						</div>
					)}
					{showTopSellers &&
						quickProducts.length > 0 && (
							<div className="space-y-2 rounded-md border p-2">
								<Label>Top Sellers</Label>
								<div className="flex gap-2 overflow-x-auto pb-1">
									{quickProducts.map((product) => (
										<Button
											key={product.id}
											type="button"
											variant="outline"
											size="sm"
											className="shrink-0"
											onClick={() =>
												addProductUnits(
													product.id,
													1,
												)
											}
										>
											{product.name}
										</Button>
									))}
								</div>
							</div>
						)}
					{showFastRepeat &&
						repeatTemplates.length > 0 && (
							<div className="space-y-2 rounded-md border p-2">
								<Label>Fast Repeat Sale</Label>
								<div className="flex gap-2 overflow-x-auto pb-1">
									{repeatTemplates.map((template) => {
										const itemCount =
											(
												template.items ?? []
											).length;
										const firstItemName =
											productMap.get(
												template.items?.[0]
													?.productId ??
													"",
											)?.name ?? "Sale";
										return (
											<Button
												key={template.id}
												type="button"
												variant="secondary"
												size="sm"
												className="shrink-0"
												onClick={() =>
													applyFastRepeat(
														template,
													)
												}
											>
												{firstItemName}
												{itemCount > 1
													? ` +${itemCount - 1}`
													: ""}{" "}
												|{" "}
												{template.paymentMethod ??
													"CASH"}
											</Button>
										);
									})}
								</div>
							</div>
						)}
				</div>

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
				<MoneyInput
					label="Discount (optional)"
					value={discountCents}
					onChange={setDiscountCents}
				/>
			</div>
			<SaveFooter
				disabled={loading || items.length === 0}
				loading={loading}
				label="Checkout"
			/>
		</form>
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
	>([
		{
			productId: "",
			units: "",
			discountCents: 0,
		},
	]);
	const [paymentMethod, setPaymentMethod] =
		React.useState<PaymentMethod | "">("");
	const [discountCents, setDiscountCents] =
		React.useState(0);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);

	const updateItem = (
		index: number,
		updates: Partial<ChargeItem>,
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
				(item) => item.productId && item.units,
			)
			.map((item) => ({
				productId: item.productId,
				units: parseInt(item.units, 10) || 0,
				discountCents:
					item.discountCents > 0
						? item.discountCents
						: undefined,
			}))
			.filter((item) => item.units > 0);
		if (!validItems.length) {
			toast.error("Please add at least one item");
			setLoading(false);
			return;
		}
		try {
			const res = await fetch("/api/sales", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					date,
					paymentMethod,
					discountCents:
						discountCents > 0
							? discountCents
							: undefined,
					items: validItems,
					note:
						showNote && note ? note : undefined,
				}),
			});
			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to save direct sale",
					),
				);
			}
			toast.success("Direct sale saved");
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
				<ItemsSection
					items={items}
					products={products}
					onRemove={(index) =>
						setItems((prev) =>
							prev.filter((_, i) => i !== index),
						)
					}
					onChange={updateItem}
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
				<MoneyInput
					label="Discount (optional)"
					value={discountCents}
					onChange={setDiscountCents}
				/>
				<BottomItemButtons
					onAddItem={() =>
						setItems((prev) => [
							...prev,
							{ productId: "", units: "", discountCents: 0 },
						])
					}
					showNote={showNote}
					setShowNote={setShowNote}
					note={note}
					setNote={setNote}
					notePlaceholder="Any notes..."
				/>
			</div>
			<SaveFooter
				disabled={loading || !paymentMethod}
				loading={loading}
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
	>([
		{
			productId: "",
			units: "",
			discountCents: 0,
		},
	]);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);
	const [discountCents, setDiscountCents] =
		React.useState(0);

	const updateItem = (
		index: number,
		updates: Partial<ChargeItem>,
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
				(item) => item.productId && item.units,
			)
			.map((item) => ({
				productId: item.productId,
				units: parseInt(item.units, 10) || 0,
				discountCents:
					item.discountCents > 0
						? item.discountCents
						: undefined,
			}))
			.filter((item) => item.units > 0);
		if (!validItems.length) {
			toast.error("Please add at least one item");
			setLoading(false);
			return;
		}
		try {
			const res = await fetch(
				"/api/tabs/charge",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						date,
						customerId,
						discountCents:
							discountCents > 0
								? discountCents
								: undefined,
						items: validItems,
						note:
							showNote && note ? note : undefined,
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
						"Failed to add sale to account",
					),
				);
			}
			toast.success(
				"Sale added to customer account",
			);
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
				<ItemsSection
					items={items}
					products={products}
					onRemove={(index) =>
						setItems((prev) =>
							prev.filter((_, i) => i !== index),
						)
					}
					onChange={updateItem}
				/>
				<div className="space-y-3">
					<CustomerSelect
						customers={customers}
						value={customerId}
						onChange={setCustomerId}
						label="Customer Account"
					/>
				</div>
				<MoneyInput
					label="Discount (optional)"
					value={discountCents}
					onChange={setDiscountCents}
				/>
				<BottomItemButtons
					onAddItem={() =>
						setItems((prev) => [
							...prev,
							{ productId: "", units: "", discountCents: 0 },
						])
					}
					showNote={showNote}
					setShowNote={setShowNote}
					note={note}
					setNote={setNote}
					notePlaceholder="Optional note for this account sale"
				/>
			</div>
			<SaveFooter
				disabled={loading || !customerId}
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
	const [reference, setReference] =
		React.useState("");
	const [showReference, setShowReference] =
		React.useState(false);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch(
				"/api/tabs/payment",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						date,
						customerId,
						amountCents,
						paymentMethod,
						reference:
							showReference && reference
								? reference
								: undefined,
						note:
							showNote && note ? note : undefined,
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
						"Failed to record payment",
					),
				);
			}
			toast.success(
				"Payment recorded successfully",
			);
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
				<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
					<CustomerSelect
						customers={customers}
						value={customerId}
						onChange={setCustomerId}
						label="Customer Account"
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
			</div>
			<SaveFooter
				disabled={
					loading ||
					!customerId ||
					!paymentMethod ||
					amountCents <= 0
				}
				loading={loading}
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
					creditLimitCents,
					dueDays: dueDays
						? parseInt(dueDays, 10)
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
	const [discountCents, setDiscountCents] =
		React.useState(0);
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
						unitCostCents: 0,
						discountCents: 0,
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
				unitCostCents: 0,
				discountCents: 0,
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
					(item.cases || item.singles),
			)
			.map((item) => ({
				productId: item.productId,
				cases: parseInt(item.cases, 10) || 0,
				singles: parseInt(item.singles, 10) || 0,
				units: calculateUnits(item),
				unitCostCents:
					item.unitCostCents || undefined,
				discountCents:
					item.discountCents > 0
						? item.discountCents
						: undefined,
			}));
		if (!validItems.length) {
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
					discountCents:
						discountCents > 0
							? discountCents
							: undefined,
					items: validItems,
				}),
			});
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
					<MoneyInput
						label="Purchase Discount (optional)"
						value={discountCents}
						onChange={setDiscountCents}
					/>
					<div className="space-y-2">
						<Label>Items</Label>
						<div className="space-y-3">
							{items.map((item, index) => {
								const units =
									calculateUnits(item);
								const subtotalCents =
									units *
									(item.unitCostCents ?? 0);
								const netCents = Math.max(
									0,
									subtotalCents -
										item.discountCents,
								);
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
														Unit Cost
													</Label>
														<MoneyInput
															value={
																item.unitCostCents
															}
															onChange={(v) =>
																updateItem(index, {
																	unitCostCents: v,
															})
														}
														placeholder="0.00"
														className="space-y-0"
													/>
												</div>
												<div className="min-w-0 flex-1 space-y-1">
													<Label className="text-xs">
														Item Discount
													</Label>
														<MoneyInput
															value={
																item.discountCents
															}
															onChange={(v) =>
																updateItem(index, {
																	discountCents: v,
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
											Subtotal {formatZAR(subtotalCents)} | Net{" "}
											{formatZAR(netCents)}
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
									unitCostCents: 0,
									discountCents: 0,
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
	onSuccess,
}: {
	products: Product[];
	date: string;
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
			reason: "",
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
					item.reason,
			)
			.map((item) => ({
				productId: item.productId,
				unitsDelta:
					parseInt(item.unitsDelta, 10) || 0,
				reason: item.reason as AdjustmentReason,
				note: item.note || undefined,
			}));
		if (!validItems.length) {
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
				"Adjustments submitted successfully",
			);
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
								<Input
									type="number"
									value={item.unitsDelta}
									onChange={(e) =>
										updateItem(index, {
											unitsDelta: e.target.value,
										})
									}
									placeholder="Units (+/-)"
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
									reason: "",
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
