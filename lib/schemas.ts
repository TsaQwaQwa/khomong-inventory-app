import { z } from 'zod';

export const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const productCreateSchema = z.object({
  name: z.string().min(2),
  category: z.enum(['Beer', 'Cider', 'SoftDrink', 'Other']).default('Beer'),
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

export const purchaseCreateSchema = z.object({
  supplierId: z.string().optional(),
  invoiceNo: z.string().optional(),
  purchaseDate: ymdSchema.optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      cases: z.number().int().min(0).default(0),
      singles: z.number().int().min(0).default(0),
      units: z.number().int().min(0),
      unitCostCents: z.number().int().min(0).optional(),
    })
  ).min(1),
  attachmentIds: z.array(z.string()).optional(),
});

export const stockCountSchema = z.object({
  date: ymdSchema.optional(),
  type: z.enum(['OPEN', 'CLOSE']),
  counts: z.array(
    z.object({
      productId: z.string().min(1),
      units: z.number().int().min(0),
    })
  ).min(1),
});

export const adjustmentSchema = z.object({
  date: ymdSchema.optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      unitsDelta: z.number().int(),
      reason: z.enum(['SPILLAGE', 'BREAKAGE', 'FREEBIES', 'THEFT_SUSPECTED', 'COUNT_CORRECTION']),
      note: z.string().optional(),
      attachmentId: z.string().optional(),
    })
  ).min(1),
});

export const customerCreateSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  note: z.string().optional(),
  creditLimitCents: z.number().int().min(0).default(0),
  dueDays: z.number().int().min(1).max(365).optional(),
});

export const customerUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  note: z.string().optional(),
  creditLimitCents: z.number().int().min(0).optional(),
  dueDays: z.number().int().min(1).max(365).optional(),
});

export const tabChargeSchema = z.object({
  date: ymdSchema.optional(),
  customerId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    units: z.number().int().min(1),
  })).min(1),
  note: z.string().optional(),
});

export const tabPaymentSchema = z.object({
  date: ymdSchema.optional(),
  customerId: z.string().min(1),
  amountCents: z.number().int().min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'EFT']),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export const directSaleSchema = z.object({
  date: ymdSchema.optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'EFT']),
  items: z.array(z.object({
    productId: z.string().min(1),
    units: z.number().int().min(1),
  })).min(1),
  note: z.string().optional(),
});

export const transactionReverseSchema = z.object({
  transactionId: z.string().min(1),
  type: z.enum(['DIRECT_SALE', 'CHARGE', 'PAYMENT']),
  reason: z.string().min(3),
});
