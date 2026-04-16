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
	phone?: string;
	notes?: string;
}

export interface SupplierPrice {
	id: string;
	supplierId: string;
	productId: string;
	unitCostCents: number;
	effectiveFrom: string;
	effectiveTo?: string;
	moqUnits?: number;
	leadTimeDays?: number;
	note?: string;
}

// Customer types
export interface Customer {
	id: string;
	name: string;
	phone?: string;
	note?: string;
	customerMode?: "ACCOUNT" | "DEBT_ONLY";
	isTemporaryTab?: boolean;
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
	discountCents?: number;
	lineTotalCostCents?: number;
}

export interface Purchase {
	id: string;
	supplierId?: string;
	supplierName?: string;
	invoiceNo?: string;
	purchaseDate: string;
	items: PurchaseItem[];
	subtotalCents?: number;
	discountCents?: number;
	totalCostCents?: number;
	totalUnits?: number;
	attachmentIds?: string[];
}

export type DailyStockCountStatus =
	| "DRAFT"
	| "COMPLETED";

export interface DailyStockCountItem {
	productId: string;
	countedUnits: number;
	note?: string;
}

export interface DailyStockCount {
	id: string;
	date: string;
	sessionId: string;
	status: DailyStockCountStatus;
	items: DailyStockCountItem[];
	countedByUserId: string;
	countedAt: string;
	finalizedByUserId?: string;
	finalizedAt?: string;
}

// Adjustment types
export type AdjustmentReason =
	| "SPILLAGE"
	| "BREAKAGE"
	| "FREEBIES"
	| "THEFT_SUSPECTED"
	| "COUNT_CORRECTION"
	| "OPENING_STOCK";

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
	outstandingTabBalanceCents: number;
	overdueTabBalanceCents: number;
	accountedSalesCents: number;
	expensesCents: number;
	revenueVarianceCents: number;
	netProfitAfterExpensesCents: number;
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
		recentAvgDailySoldUnits?: number;
		targetCoverDays?: number;
		recommendationBasis?:
			| "REORDER_LEVEL"
			| "SELL_THROUGH"
			| "BLENDED";
		priority: "HIGH" | "MEDIUM";
	}[];
}
