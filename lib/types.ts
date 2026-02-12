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
	tabStatus?: string;
	lastChargeAt?: string;
	dueDate?: string;
	isOverdue?: boolean;
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
	attachmentIds?: string[];
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

// Tab types
export interface TabChargeItem {
	productId: string;
	units: number;
}

export type PaymentMethod =
	| "CASH"
	| "CARD"
	| "EFT";

export interface DailyReportProduct {
	productId: string;
	productName: string;
	unitsSold: number;
	unitPriceCents: number;
	expectedRevenueCents: number;
	purchasedUnits: number;
	adjustments: number;
}

export interface DailyReport {
	date: string;
	expectedRevenueCents: number;
	collectedSalesCents: number;
	tabChargesCents: number;
	accountedSalesCents: number;
	revenueVarianceCents: number;
	tabPaymentsByMethodCents: {
		CASH: number;
		CARD: number;
		EFT: number;
	};
	dayChecklist: {
		hasSalesEntries: boolean;
		hasPurchases: boolean;
		hasTabActivity: boolean;
		hasAdjustments: boolean;
	};
	warnings: string[];
	byProduct: DailyReportProduct[];
	trends: {
		sales: {
			currentCents: number;
			previousCents: number | null;
			changeCents: number | null;
			changePct: number | null;
		};
		topProducts: {
			productId: string;
			productName: string;
			unitsSold: number;
			revenueCents: number;
		}[];
	};
	grossProfit: {
		estimatedCogsCents: number;
		grossProfitCents: number;
		grossMarginPct: number | null;
	};
	inventoryInsights: {
		topMovers: {
			productId: string;
			productName: string;
			unitsSoldToday: number;
			currentUnits: number;
		}[];
		slowMovers: {
			productId: string;
			productName: string;
			unitsSoldLast30Days: number;
			currentUnits: number;
		}[];
		deadStock: {
			productId: string;
			productName: string;
			unitsSoldLast30Days: number;
			currentUnits: number;
		}[];
	};
	recommendations: {
		priority: "HIGH" | "MEDIUM" | "LOW";
		title: string;
		detail: string;
	}[];
	stockRecommendations: {
		productId: string;
		productName: string;
		currentUnits: number;
		reorderLevelUnits: number;
		recommendedOrderUnits: number;
		priority: "HIGH" | "MEDIUM";
	}[];
}
