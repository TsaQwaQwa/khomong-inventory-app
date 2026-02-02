import { connectDB } from '@/lib/db';
import { addDays } from '@/lib/dates';
import { BusinessDay } from '@/models/BusinessDay';
import { StockCount } from '@/models/StockCount';
import { Purchase } from '@/models/Purchase';
import { Adjustment } from '@/models/Adjustment';
import { Product } from '@/models/Product';
import { Price } from '@/models/Price';
import { TillClose } from '@/models/TillClose';
import { TabTransaction } from '@/models/TabTransaction';

export async function getOrCreateBusinessDay(orgId: string, date: string, userId: string) {
  await connectDB();
  const existing = await BusinessDay.findOne({ orgId, date }).lean();
  if (existing) return existing;

  const created = await BusinessDay.create({
    orgId,
    date,
    status: 'OPEN',
    openedByUserId: userId,
    openedAt: new Date(),
  });

  return created.toObject();
}

async function getPriceForDate(orgId: string, productId: string, date: string): Promise<number | null> {
  const p = await Price.findOne({
    orgId,
    productId,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: date } }],
  })
    .sort({ effectiveFrom: -1 })
    .lean();

  return p?.priceCents ?? null;
}

export interface DailySummary {
  date: string;
  status: string;

  totals: {
    expectedRevenueCents: number;
    collectedSalesCents: number; // cash/card/eft (today's collections)
    tabChargesCents: number;     // sales on tab today
    accountedSalesCents: number; // collectedSales + tabCharges
    revenueVarianceCents: number;

    cashExpectedCents: number;
    cashCountedCents: number | null;
    cashVarianceCents: number | null;

    tabPaymentsByMethodCents: { CASH: number; CARD: number; EFT: number };
  };

  byProduct: Array<{
    productId: string;
    name: string;
    unitsSold: number;
    unitPriceCents: number | null;
    expectedRevenueCents: number;
    openingUnits: number | null;
    closingUnits: number | null;
    purchasedUnits: number;
    adjustmentUnits: number;
  }>;

  warnings: string[];
}

export async function computeDailySummary(orgId: string, date: string, userId: string): Promise<DailySummary> {
  await connectDB();

  const day = await getOrCreateBusinessDay(orgId, date, userId);

  // Counts
  const closeCount = await StockCount.findOne({ orgId, businessDayId: String(day._id), type: 'CLOSE' }).lean();
  const openCount = await StockCount.findOne({ orgId, businessDayId: String(day._id), type: 'OPEN' }).lean();

  // Fallback opening = yesterday close
  let openingCounts = openCount?.counts ?? null;
  if (!openingCounts) {
    const yday = addDays(date, -1);
    const prev = await BusinessDay.findOne({ orgId, date: yday }).lean();
    if (prev) {
      const prevClose = await StockCount.findOne({ orgId, businessDayId: String(prev._id), type: 'CLOSE' }).lean();
      openingCounts = prevClose?.counts ?? null;
    }
  }

  const closingCounts = closeCount?.counts ?? null;

  // Purchases
  const purchases = await Purchase.find({ orgId, purchaseDate: date }).lean();
  const purchasedUnitsByProduct = new Map<string, number>();
  for (const p of purchases) {
    for (const it of p.items) {
      purchasedUnitsByProduct.set(it.productId, (purchasedUnitsByProduct.get(it.productId) ?? 0) + (it.units ?? 0));
    }
  }

  // Adjustments
  const adjustments = await Adjustment.find({ orgId, businessDayId: String(day._id) }).lean();
  const adjUnitsByProduct = new Map<string, number>();
  for (const a of adjustments) {
    for (const it of a.items) {
      adjUnitsByProduct.set(it.productId, (adjUnitsByProduct.get(it.productId) ?? 0) + (it.unitsDelta ?? 0));
    }
  }

  const openingByProduct = new Map<string, number>();
  for (const c of openingCounts ?? []) openingByProduct.set(c.productId, c.units);

  const closingByProduct = new Map<string, number>();
  for (const c of closingCounts ?? []) closingByProduct.set(c.productId, c.units);

  const productIds = new Set<string>([
    ...openingByProduct.keys(),
    ...closingByProduct.keys(),
    ...purchasedUnitsByProduct.keys(),
    ...adjUnitsByProduct.keys(),
  ]);

  const products = await Product.find({ orgId, _id: { $in: Array.from(productIds) } }).lean();
  const productById = new Map<string, { name: string }>();
  for (const p of products) productById.set(String(p._id), { name: p.name });

  const warnings: string[] = [];
  if (!closingCounts) warnings.push('No CLOSE stock count for this date yet.');
  if (!openingCounts) warnings.push('No OPEN stock count found (and no previous CLOSE to infer from).');

  let expectedRevenueCents = 0;

  const byProduct: DailySummary['byProduct'] = [];
  for (const productId of Array.from(productIds)) {
    const openingUnits = openingByProduct.get(productId) ?? null;
    const closingUnits = closingByProduct.get(productId) ?? null;
    const purchasedUnits = purchasedUnitsByProduct.get(productId) ?? 0;
    const adjustmentUnits = adjUnitsByProduct.get(productId) ?? 0;

    const base = (openingUnits ?? 0) + purchasedUnits + adjustmentUnits - (closingUnits ?? 0);
    const unitsSold = base;

    const unitPriceCents = await getPriceForDate(orgId, productId, date);
    const productExpected = unitPriceCents ? unitsSold * unitPriceCents : 0;

    if (!unitPriceCents) {
      warnings.push(`No price set for productId=${productId} on ${date}.`);
    }

    expectedRevenueCents += productExpected;

    byProduct.push({
      productId,
      name: productById.get(productId)?.name ?? '(unknown product)',
      unitsSold,
      unitPriceCents,
      expectedRevenueCents: productExpected,
      openingUnits,
      closingUnits,
      purchasedUnits,
      adjustmentUnits,
    });
  }

  // Till close
  const till = await TillClose.findOne({ orgId, businessDayId: String(day._id) }).lean();
  const collectedSalesCents = (till?.cashSalesCents ?? 0) + (till?.cardSalesCents ?? 0) + (till?.eftSalesCents ?? 0);

  // Tab ledger - charges and payments (today)
  const tabChargesCents = await TabTransaction.aggregate([
    { $match: { orgId, businessDayId: String(day._id), type: 'CHARGE' } },
    { $group: { _id: null, total: { $sum: '$amountCents' } } },
  ]).then(r => r?.[0]?.total ?? 0);

  const payments = await TabTransaction.find({ orgId, businessDayId: String(day._id), type: 'PAYMENT' }).lean();
  const tabPaymentsByMethodCents = { CASH: 0, CARD: 0, EFT: 0 };
  for (const p of payments) {
    const m = p.paymentMethod ?? 'CASH';
    tabPaymentsByMethodCents[m] += p.amountCents;
  }

  const accountedSalesCents = collectedSalesCents + tabChargesCents;
  const revenueVarianceCents = accountedSalesCents - expectedRevenueCents;

  // Cash variance (drawer control)
  const cashExpensesCents = (till?.cashExpenses ?? []).reduce((s, e) => s + (e.amountCents ?? 0), 0);
  const depositsCents = (till?.deposits ?? []).reduce((s, d) => s + (d.amountCents ?? 0), 0);
  const cashExpectedCents = (till?.cashSalesCents ?? 0) + tabPaymentsByMethodCents.CASH - cashExpensesCents - depositsCents;
  const cashCountedCents = till?.cashCountedCents ?? null;
  const cashVarianceCents = cashCountedCents === null ? null : cashCountedCents - cashExpectedCents;

  return {
    date,
    status: day.status,
    totals: {
      expectedRevenueCents,
      collectedSalesCents,
      tabChargesCents,
      accountedSalesCents,
      revenueVarianceCents,
      cashExpectedCents,
      cashCountedCents,
      cashVarianceCents,
      tabPaymentsByMethodCents,
    },
    byProduct: byProduct.sort((a, b) => (b.expectedRevenueCents - a.expectedRevenueCents)),
    warnings,
  };
}
