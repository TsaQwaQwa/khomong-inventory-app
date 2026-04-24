import { z } from "zod";

export const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const productCreateSchema = z.object({
	name: z.string().min(2),
	category: z.enum(["Beer", "Cider", "SoftDrink", "Other"]).default("Beer"),
	barcode: z.string().optional(),
	packSize: z.number().int().min(1).default(24),
	reorderLevelUnits: z.number().int().min(0).default(0),
});

export const setPriceSchema = z.object({
	productId: z.string().min(1),
	priceCents: z.number().int().min(0),
	effectiveFrom: ymdSchema.optional(),
	reason: z.string().optional(),
});

export const supplierCreateSchema = z.object({
	name: z.string().min(2),
	phone: z.string().optional(),
	notes: z.string().optional(),
});

export const supplierProductPriceSchema = z.object({
	supplierId: z.string().min(1),
	productId: z.string().min(1),
	unitCostCents: z.number().int().min(0),
	effectiveFrom: ymdSchema.optional(),
	moqUnits: z.number().int().min(1).optional(),
	leadTimeDays: z.number().int().min(0).max(365).optional(),
	note: z.string().max(500).optional(),
});

const purchaseItemSchema = z.object({
	productId: z.string().min(1),
	cases: z.number().int().min(0).default(0),
	singles: z.number().int().min(0).default(0),
	units: z.number().int().min(0),
	unitCostCents: z.number().int().min(0).optional(),
	lineSubtotalCents: z.number().int().min(0).optional(),
});

export const purchaseCreateSchema = z.object({
	supplierId: z.string().optional(),
	invoiceNo: z.string().optional(),
	purchaseDate: ymdSchema.optional(),
	items: z.array(purchaseItemSchema).min(1),
	attachmentIds: z.array(z.string()).optional(),
});

export const purchaseUpdateSchema = z.object({
	supplierId: z.string().optional(),
	invoiceNo: z.string().optional(),
	purchaseDate: ymdSchema.optional(),
	items: z.array(purchaseItemSchema).min(1).optional(),
	attachments: z.array(z.string()).optional(),
});

export const stockCountSchema = z.object({
	date: ymdSchema.optional(),
	type: z.enum(["OPEN", "CLOSE"]),
	counts: z.array(
		z.object({
			productId: z.string().min(1),
			units: z.number().int().min(0),
		}),
	).min(1),
});

export const morningStockCountSchema = z.object({
	date: ymdSchema.optional(),
	sessionId: z.string().min(1).optional(),
	status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED"]).default("IN_PROGRESS"),
	counts: z.array(
		z.object({
			productId: z.string().min(1),
			countedUnits: z.number().int().min(0),
			note: z.string().max(500).optional(),
		}),
	).min(1),
});

export const finalizeMorningStockCountSchema = z.object({
	date: ymdSchema.optional(),
	sessionId: z.string().min(1).optional(),
});

export const adjustmentSchema = z.object({
	date: ymdSchema.optional(),
	items: z.array(
		z.object({
			productId: z.string().min(1),
			unitsDelta: z.number().int(),
			reason: z.enum([
				"SPILLAGE",
				"BREAKAGE",
				"FREEBIES",
				"THEFT_SUSPECTED",
				"COUNT_CORRECTION",
				"OPENING_STOCK",
			]),
			note: z.string().optional(),
			attachmentId: z.string().optional(),
		}),
	).min(1),
});

const optionalPhoneSchema = z.preprocess(
	(value) => {
		if (value === null) return null;
		if (typeof value !== "string") return value;
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	},
	z.union([z.string().min(7), z.null()]).optional(),
);

export const customerCreateSchema = z.object({
	name: z.string().min(2),
	phone: optionalPhoneSchema,
	note: z.string().optional(),
	customerMode: z.enum(["ACCOUNT", "DEBT_ONLY"]).default("ACCOUNT"),
	isTemporaryTab: z.boolean().optional().default(false),
	openingBalanceCents: z.number().int().min(0).default(0),
	creditLimitCents: z.number().int().min(0).default(0),
	dueDays: z.number().int().min(1).max(365).optional(),
});

export const customerUpdateSchema = z.object({
	name: z.string().min(2).optional(),
	phone: optionalPhoneSchema,
	note: z.string().optional(),
	customerMode: z.enum(["ACCOUNT", "DEBT_ONLY"]).optional(),
	isTemporaryTab: z.boolean().optional(),
	creditLimitCents: z.number().int().min(0).optional(),
	dueDays: z.number().int().min(1).max(365).optional(),
});

export const tabChargeSchema = z.object({
	date: ymdSchema.optional(),
	customerId: z.string().min(1),
	manualAmountCents: z.number().int().min(0).optional(),
	belowCostApproved: z.boolean().optional(),
	belowCostReason: z.string().max(300).optional(),
	items: z.array(
		z.object({
			productId: z.string().min(1),
			units: z.number().int().min(1),
		}),
	).default([]),
	note: z.string().optional(),
}).refine(
	(value) => value.items.length > 0 || (value.manualAmountCents ?? 0) > 0,
	{
		message: "Add at least one item or an owed amount",
		path: ["items"],
	},
);

export const tabPaymentSchema = z.object({
	date: ymdSchema.optional(),
	customerId: z.string().min(1),
	amountCents: z.number().int().min(1),
	paymentMethod: z.enum(["CASH", "CARD", "EFT"]),
	cashReceivedCents: z.number().int().min(0).optional(),
	reference: z.string().optional(),
	note: z.string().optional(),
});

export const tabAdjustmentSchema = z.object({
	date: ymdSchema.optional(),
	customerId: z.string().min(1),
	amountCents: z.number().int().refine((value) => value !== 0, {
		message: "Adjustment amount must not be zero",
	}),
	note: z.string().optional(),
});

export const tabExpenseSchema = z.object({
	date: ymdSchema.optional(),
	amountCents: z.number().int().min(1),
	reason: z.string().trim().min(3).max(300),
	category: z.enum([
		"RENT",
		"UTILITIES",
		"TRANSPORT",
		"WAGES",
		"REPAIRS",
		"SUPPLIES",
		"MARKETING",
		"TAX",
		"OTHER",
	]),
	payee: z.string().trim().min(2).max(120),
	reference: z.string().optional(),
	note: z.string().optional(),
});

export const transactionReverseSchema = z.object({
	transactionId: z.string().min(1),
	type: z.enum(["DIRECT_SALE", "CHARGE", "PAYMENT", "EXPENSE"]),
	reason: z.string().min(3),
});
