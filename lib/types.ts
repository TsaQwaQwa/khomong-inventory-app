// Product types
export interface Product {
	id: string;
	name: string;
	category: string;
	barcode?: string;
	packSize: number;
	reorderLevelUnits: number;
	currentPriceCents?: number;
}

// Supplier types
export interface Supplier {
	id: string;
	name: string;
}

// Customer types
export interface Customer {
	id: string;
	name: string;
	phone?: string;
	note?: string;
	creditLimitCents: number;
	dueDays?: number;
	balanceCents?: number;
}

// Purchase types
export interface PurchaseItem {
	productId: string;
	cases: number;
	singles: number;
	units: number;
	unitCostCents?: number;
}

export interface Purchase {
	id: string;
	supplierId?: string;
	supplierName?: string;
	invoiceNo?: string;
	purchaseDate: string;
	items: PurchaseItem[];
	totalUnits?: number;
	totalCostCents?: number;
}

// Stock count types
export interface StockCount {
	productId: string;
	units: number;
}

// Adjustment types
export type AdjustmentReason =
	| "SPILLAGE"
	| "BREAKAGE"
	| "FREEBIES"
	| "THEFT_SUSPECTED"
	| "COUNT_CORRECTION";

export interface AdjustmentItem {
	productId: string;
	unitsDelta: number;
	reason: AdjustmentReason;
	note?: string;
}

// Till close types
export interface CashExpense {
	amountCents: number;
	reason: string;
}

export interface Deposit {
	amountCents: number;
	reference?: string;
}

// Tab types
export interface TabChargeItem {
	productId: string;
	units: number;
}

export type PaymentMethod =
	| "CASH"
	| "CARD"
	| "EFT";

// Daily report types
export interface DailyReportProduct {
	productId: string;
	productName: string;
	unitsSold: number;
	unitPriceCents: number;
	expectedRevenueCents: number;
	openingUnits: number;
	purchasedUnits: number;
	adjustments: number;
	closingUnits: number;
}

export interface DailyReport {
	date: string;
	expectedRevenueCents: number;
	collectedSalesCents: number;
	tabChargesCents: number;
	accountedSalesCents: number;
	revenueVarianceCents: number;
	cashExpectedCents: number;
	cashCountedCents: number;
	cashVarianceCents: number;
	warnings: string[];
	byProduct: DailyReportProduct[];
}
