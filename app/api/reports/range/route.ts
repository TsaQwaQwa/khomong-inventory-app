export const runtime = "nodejs";

import { requireOrgAuth } from "@/lib/authz";
import { connectDB } from "@/lib/db";
import { addDays, todayYMD } from "@/lib/dates";
import { ok, fail } from "@/lib/http";
import { BusinessDay } from "@/models/BusinessDay";
import { SaleTransaction } from "@/models/SaleTransaction";
import { TabTransaction } from "@/models/TabTransaction";
import { Purchase } from "@/models/Purchase";
import { Adjustment } from "@/models/Adjustment";
import { Product } from "@/models/Product";
import { Supplier } from "@/models/Supplier";
import { Customer } from "@/models/Customer";

type ReportKind =
	| "all"
	| "direct"
	| "account"
	| "payment"
	| "purchase"
	| "adjustment"
	| "expense";

const VALID_KINDS = new Set<ReportKind>([
	"all",
	"direct",
	"account",
	"payment",
	"purchase",
	"adjustment",
	"expense",
]);

const isYMD = (value: string) =>
	/^\d{4}-\d{2}-\d{2}$/.test(value);

const toNumber = (value: unknown) =>
	typeof value === "number"
		? value
		: Number(value) || 0;

const purchaseTotalCost = (purchase: any) => {
	if (toNumber(purchase.totalCostCents) > 0) {
		return toNumber(purchase.totalCostCents);
	}
	return (purchase.items ?? []).reduce(
		(sum: number, item: any) => {
			if (toNumber(item.lineTotalCostCents) > 0) {
				return sum + toNumber(item.lineTotalCostCents);
			}
			const subtotal =
				toNumber(item.units) *
				toNumber(item.unitCostCents);
			const discount = toNumber(item.discountCents);
			return sum + Math.max(0, subtotal - discount);
		},
		0,
	);
};

export async function GET(req: Request) {
	try {
		await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	const url = new URL(req.url);
	const to = url.searchParams.get("to") ?? todayYMD();
	const from =
		url.searchParams.get("from") ?? addDays(to, -29);
	const kind = (url.searchParams.get("kind") ??
		"all") as ReportKind;
	const productId =
		url.searchParams.get("productId") ?? "";
	const supplierId =
		url.searchParams.get("supplierId") ?? "";
	const customerId =
		url.searchParams.get("customerId") ?? "";

	if (!isYMD(from) || !isYMD(to)) {
		return fail("Invalid date format", {
			status: 400,
			code: "BAD_REQUEST",
		});
	}
	if (from > to) {
		return fail("From date must be before To date", {
			status: 400,
			code: "BAD_REQUEST",
		});
	}
	if (!VALID_KINDS.has(kind)) {
		return fail("Invalid kind filter", {
			status: 400,
			code: "BAD_REQUEST",
		});
	}

	const includeDirect =
		kind === "all" || kind === "direct";
	const includeAccount =
		kind === "all" || kind === "account";
	const includePayments =
		kind === "all" || kind === "payment";
	const includePurchases =
		kind === "all" || kind === "purchase";
	const includeAdjustments =
		kind === "all" || kind === "adjustment";
	const includeExpenses =
		kind === "all" || kind === "expense";

	try {
		await connectDB();

		const days = await BusinessDay.find({
			date: { $gte: from, $lte: to },
		})
			.select({ _id: 1, date: 1 })
			.lean();
		const dayIdByDate = new Map<string, string>();
		const dateByDayId = new Map<string, string>();
		for (const day of days) {
			const id = String(day._id);
			dayIdByDate.set(day.date, id);
			dateByDayId.set(id, day.date);
		}
		const dayIds = Array.from(dateByDayId.keys());

		const saleMatch: Record<string, unknown> = {};
		const tabChargeMatch: Record<
			string,
			unknown
		> = {};
		const tabPaymentMatch: Record<
			string,
			unknown
		> = {};
		const expenseMatch: Record<
			string,
			unknown
		> = {};
		const adjustmentMatch: Record<
			string,
			unknown
		> = {};

		if (dayIds.length > 0) {
			saleMatch.businessDayId = { $in: dayIds };
			tabChargeMatch.businessDayId = {
				$in: dayIds,
			};
			tabPaymentMatch.businessDayId = {
				$in: dayIds,
			};
			expenseMatch.businessDayId = { $in: dayIds };
			adjustmentMatch.businessDayId = {
				$in: dayIds,
			};
		} else {
			saleMatch.businessDayId = "__none__";
			tabChargeMatch.businessDayId = "__none__";
			tabPaymentMatch.businessDayId = "__none__";
			expenseMatch.businessDayId = "__none__";
			adjustmentMatch.businessDayId = "__none__";
		}

		if (productId) {
			saleMatch["items.productId"] = productId;
			tabChargeMatch["items.productId"] = productId;
			adjustmentMatch["items.productId"] =
				productId;
		}
		if (customerId) {
			tabChargeMatch.customerId = customerId;
			tabPaymentMatch.customerId = customerId;
		}
		tabChargeMatch.type = "CHARGE";
		tabPaymentMatch.type = "PAYMENT";
		expenseMatch.type = "EXPENSE";

		const purchaseMatch: Record<
			string,
			unknown
		> = {
			purchaseDate: { $gte: from, $lte: to },
		};
		if (supplierId) purchaseMatch.supplierId = supplierId;
		if (productId)
			purchaseMatch["items.productId"] = productId;

		const [
			directSales,
			accountCharges,
			accountPayments,
			expenses,
			purchases,
			adjustments,
		] = await Promise.all([
			includeDirect
				? SaleTransaction.find(saleMatch)
						.select({
							businessDayId: 1,
							amountCents: 1,
							discountCents: 1,
							items: 1,
							paymentMethod: 1,
							note: 1,
							createdAt: 1,
						})
						.lean()
				: Promise.resolve([]),
			includeAccount
				? TabTransaction.find(tabChargeMatch)
						.select({
							businessDayId: 1,
							customerId: 1,
							amountCents: 1,
							discountCents: 1,
							items: 1,
							note: 1,
							createdAt: 1,
						})
						.lean()
				: Promise.resolve([]),
			includePayments
				? TabTransaction.find(tabPaymentMatch)
						.select({
							businessDayId: 1,
							customerId: 1,
							amountCents: 1,
							paymentMethod: 1,
							reference: 1,
							note: 1,
							createdAt: 1,
						})
						.lean()
				: Promise.resolve([]),
			includeExpenses
				? TabTransaction.find(expenseMatch)
						.select({
							businessDayId: 1,
							amountCents: 1,
							reference: 1,
							reason: 1,
							expenseCategory: 1,
							payee: 1,
							note: 1,
							createdAt: 1,
						})
						.lean()
				: Promise.resolve([]),
			includePurchases
				? Purchase.find(purchaseMatch)
						.select({
							purchaseDate: 1,
							supplierId: 1,
							totalCostCents: 1,
							discountCents: 1,
							items: 1,
							invoiceNo: 1,
							createdAt: 1,
						})
						.lean()
				: Promise.resolve([]),
			includeAdjustments
				? Adjustment.find(adjustmentMatch)
						.select({
							businessDayId: 1,
							items: 1,
							createdAt: 1,
						})
						.lean()
				: Promise.resolve([]),
		]);

		const customerIds = new Set<string>();
		for (const item of accountCharges)
			if (item.customerId) customerIds.add(item.customerId);
		for (const item of accountPayments)
			if (item.customerId) customerIds.add(item.customerId);
		if (customerId) customerIds.add(customerId);

		const supplierIds = new Set<string>();
		for (const purchase of purchases)
			if (purchase.supplierId)
				supplierIds.add(purchase.supplierId);
		if (supplierId) supplierIds.add(supplierId);

		const productIds = new Set<string>();
		for (const sale of directSales) {
			for (const line of sale.items ?? []) {
				if (line.productId)
					productIds.add(line.productId);
			}
		}
		for (const charge of accountCharges) {
			for (const line of charge.items ?? []) {
				if (line.productId)
					productIds.add(line.productId);
			}
		}
		for (const purchase of purchases) {
			for (const line of purchase.items ?? []) {
				if (line.productId)
					productIds.add(line.productId);
			}
		}
		for (const adjustment of adjustments) {
			for (const line of adjustment.items ?? []) {
				if (line.productId)
					productIds.add(line.productId);
			}
		}
		if (productId) productIds.add(productId);

		const [productDocs, supplierDocs, customerDocs] =
			await Promise.all([
				productIds.size
					? Product.find({
							_id: { $in: Array.from(productIds) },
					  })
							.select({ _id: 1, name: 1 })
							.lean()
					: Promise.resolve([]),
				supplierIds.size
					? Supplier.find({
							_id: {
								$in: Array.from(supplierIds),
							},
					  })
							.select({ _id: 1, name: 1 })
							.lean()
					: Promise.resolve([]),
				customerIds.size
					? Customer.find({
							_id: {
								$in: Array.from(customerIds),
							},
					  })
							.select({ _id: 1, name: 1 })
							.lean()
					: Promise.resolve([]),
			]);

		const productNameById = new Map(
			productDocs.map((doc) => [
				String(doc._id),
				doc.name,
			]),
		);
		const supplierNameById = new Map(
			supplierDocs.map((doc) => [
				String(doc._id),
				doc.name,
			]),
		);
		const customerNameById = new Map(
			customerDocs.map((doc) => [
				String(doc._id),
				doc.name,
			]),
		);

		const byDay = new Map<
			string,
			{
				directSalesCents: number;
				accountSalesCents: number;
				paymentsCents: number;
				expensesCents: number;
				purchaseCostCents: number;
				adjustmentUnits: number;
				discountCents: number;
			}
		>();
		let cursor = from;
		while (cursor <= to) {
			byDay.set(cursor, {
				directSalesCents: 0,
				accountSalesCents: 0,
				paymentsCents: 0,
				expensesCents: 0,
				purchaseCostCents: 0,
				adjustmentUnits: 0,
				discountCents: 0,
			});
			cursor = addDays(cursor, 1);
		}

		const byProduct = new Map<
			string,
			{
				unitsSold: number;
				salesCents: number;
				unitsPurchased: number;
				purchaseCostCents: number;
				adjustmentUnits: number;
				discountCents: number;
			}
		>();
		const ensureProduct = (id: string) => {
			if (!byProduct.has(id)) {
				byProduct.set(id, {
					unitsSold: 0,
					salesCents: 0,
					unitsPurchased: 0,
					purchaseCostCents: 0,
					adjustmentUnits: 0,
					discountCents: 0,
				});
			}
			return byProduct.get(id)!;
		};

		let directSalesCents = 0;
		let accountSalesCents = 0;
		let paymentsCents = 0;
		let expensesCents = 0;
		let purchaseCostCents = 0;
		let salesDiscountCents = 0;
		let purchaseDiscountCents = 0;
		let adjustmentUnitsTotal = 0;

		const activity: Array<{
			id: string;
			date: string;
			type:
				| "DIRECT_SALE"
				| "ACCOUNT_SALE"
				| "ACCOUNT_PAYMENT"
				| "EXPENSE"
				| "PURCHASE"
				| "ADJUSTMENT";
			amountCents: number | null;
			discountCents?: number;
			itemsCount?: number;
			counterpartyName?: string;
			paymentMethod?: string;
			reference?: string;
			note?: string;
			createdAt?: string;
		}> = [];

		for (const sale of directSales) {
			const date =
				dateByDayId.get(sale.businessDayId) ??
				from;
			const amount = toNumber(sale.amountCents);
			const discount = toNumber(sale.discountCents);
			directSalesCents += amount;
			salesDiscountCents += discount;
			const day = byDay.get(date);
			if (day) {
				day.directSalesCents += amount;
				day.discountCents += discount;
			}
			for (const line of sale.items ?? []) {
				const product = ensureProduct(line.productId);
				product.unitsSold += toNumber(line.units);
				product.salesCents += toNumber(
					line.lineTotalCents,
				);
				product.discountCents += toNumber(
					line.discountCents,
				);
			}
			activity.push({
				id: String(sale._id),
				date,
				type: "DIRECT_SALE",
				amountCents: amount,
				discountCents: discount,
				itemsCount: (sale.items ?? []).length,
				paymentMethod: sale.paymentMethod,
				note: sale.note,
				createdAt: sale.createdAt
					? new Date(sale.createdAt).toISOString()
					: undefined,
			});
		}

		for (const charge of accountCharges) {
			const date =
				dateByDayId.get(charge.businessDayId) ??
				from;
			const amount = toNumber(charge.amountCents);
			const discount = toNumber(charge.discountCents);
			accountSalesCents += amount;
			salesDiscountCents += discount;
			const day = byDay.get(date);
			if (day) {
				day.accountSalesCents += amount;
				day.discountCents += discount;
			}
			for (const line of charge.items ?? []) {
				const product = ensureProduct(line.productId);
				product.unitsSold += toNumber(line.units);
				product.salesCents += toNumber(
					line.lineTotalCents,
				);
				product.discountCents += toNumber(
					line.discountCents,
				);
			}
			activity.push({
				id: String(charge._id),
				date,
				type: "ACCOUNT_SALE",
				amountCents: amount,
				discountCents: discount,
				itemsCount: (charge.items ?? []).length,
				counterpartyName: charge.customerId
					? customerNameById.get(
							charge.customerId,
					  ) ?? "(unknown customer)"
					: undefined,
				note: charge.note,
				createdAt: charge.createdAt
					? new Date(charge.createdAt).toISOString()
					: undefined,
			});
		}

		for (const payment of accountPayments) {
			const date =
				dateByDayId.get(payment.businessDayId) ??
				from;
			const amount = toNumber(payment.amountCents);
			paymentsCents += amount;
			const day = byDay.get(date);
			if (day) day.paymentsCents += amount;
			activity.push({
				id: String(payment._id),
				date,
				type: "ACCOUNT_PAYMENT",
				amountCents: amount,
				counterpartyName: payment.customerId
					? customerNameById.get(
							payment.customerId,
					  ) ?? "(unknown customer)"
					: undefined,
				paymentMethod: payment.paymentMethod,
				reference: payment.reference,
				note: payment.note,
				createdAt: payment.createdAt
					? new Date(
							payment.createdAt,
					  ).toISOString()
					: undefined,
			});
		}
		for (const expense of expenses) {
			const date =
				dateByDayId.get(expense.businessDayId) ??
				from;
			const amount = toNumber(expense.amountCents);
			expensesCents += amount;
			const day = byDay.get(date);
			if (day) day.expensesCents += amount;
			activity.push({
				id: String(expense._id),
				date,
				type: "EXPENSE",
				amountCents: amount,
				counterpartyName: expense.payee,
				reference: expense.reference,
				note:
					typeof expense.reason === "string" &&
					expense.reason.length > 0
						? `${expense.expenseCategory ?? "OTHER"}: ${expense.reason}`
						: expense.note,
				createdAt: expense.createdAt
					? new Date(
							expense.createdAt,
					  ).toISOString()
					: undefined,
			});
		}

		for (const purchase of purchases) {
			const date = purchase.purchaseDate;
			const total = purchaseTotalCost(purchase);
			const discount = toNumber(
				purchase.discountCents,
			);
			purchaseCostCents += total;
			purchaseDiscountCents += discount;
			const day = byDay.get(date);
			if (day) {
				day.purchaseCostCents += total;
				day.discountCents += discount;
			}
			for (const line of purchase.items ?? []) {
				const product = ensureProduct(line.productId);
				product.unitsPurchased += toNumber(
					line.units,
				);
				product.purchaseCostCents +=
					toNumber(line.lineTotalCostCents) ||
					Math.max(
						0,
						toNumber(line.units) *
							toNumber(line.unitCostCents) -
							toNumber(line.discountCents),
					);
			}
			activity.push({
				id: String(purchase._id),
				date,
				type: "PURCHASE",
				amountCents: total,
				discountCents: discount,
				itemsCount: (purchase.items ?? []).length,
				counterpartyName: purchase.supplierId
					? supplierNameById.get(
							purchase.supplierId,
					  ) ?? "(unknown supplier)"
					: undefined,
				reference: purchase.invoiceNo,
				createdAt: purchase.createdAt
					? new Date(
							purchase.createdAt,
					  ).toISOString()
					: undefined,
			});
		}

		for (const adjustment of adjustments) {
			const date =
				dateByDayId.get(adjustment.businessDayId) ??
				from;
			const units = (adjustment.items ?? []).reduce(
				(sum, item) =>
					sum + toNumber(item.unitsDelta),
				0,
			);
			adjustmentUnitsTotal += units;
			const day = byDay.get(date);
			if (day) day.adjustmentUnits += units;
			for (const line of adjustment.items ?? []) {
				const product = ensureProduct(line.productId);
				product.adjustmentUnits += toNumber(
					line.unitsDelta,
				);
			}
			activity.push({
				id: String(adjustment._id),
				date,
				type: "ADJUSTMENT",
				amountCents: null,
				itemsCount: (adjustment.items ?? []).length,
				note: (adjustment.items ?? [])
					.map((item) => item.reason)
					.join(", "),
				createdAt: adjustment.createdAt
					? new Date(
							adjustment.createdAt,
					  ).toISOString()
					: undefined,
			});
		}

		const byProductList = Array.from(
			byProduct.entries(),
		)
			.map(([id, agg]) => ({
				productId: id,
				productName:
					productNameById.get(id) ??
					"(unknown product)",
				...agg,
			}))
			.sort((a, b) => b.salesCents - a.salesCents);

		const timeline = Array.from(byDay.entries())
			.map(([date, day]) => ({
				date,
				...day,
				salesCents:
					day.directSalesCents +
					day.accountSalesCents,
				netCashflowCents:
					day.directSalesCents +
					day.paymentsCents -
					day.expensesCents -
					day.purchaseCostCents,
			}))
			.sort((a, b) => a.date.localeCompare(b.date));

		const salesCents =
			directSalesCents + accountSalesCents;
		const grossProfitEstimateCents =
			salesCents - purchaseCostCents - expensesCents;

		activity.sort((a, b) => {
			if (a.date !== b.date)
				return b.date.localeCompare(a.date);
			const aTs = a.createdAt ?? "";
			const bTs = b.createdAt ?? "";
			return bTs.localeCompare(aTs);
		});

		return ok({
			range: {
				from,
				to,
				kind,
				productId: productId || null,
				supplierId: supplierId || null,
				customerId: customerId || null,
			},
			summary: {
				salesCents,
				directSalesCents,
				accountSalesCents,
				paymentsCents,
				expensesCents,
				purchaseCostCents,
				grossProfitEstimateCents,
				salesDiscountCents,
				purchaseDiscountCents,
				totalDiscountCents:
					salesDiscountCents +
					purchaseDiscountCents,
				adjustmentUnitsTotal,
				daysWithActivity: timeline.filter(
					(day) =>
						day.salesCents !== 0 ||
						day.paymentsCents !== 0 ||
						day.expensesCents !== 0 ||
						day.purchaseCostCents !== 0 ||
						day.adjustmentUnits !== 0,
				).length,
			},
			timeline,
			byProduct: byProductList,
			activity: activity.slice(0, 500),
		});
	} catch (error) {
		console.error("Range report failure", {
			from,
			to,
			kind,
			productId,
			supplierId,
			customerId,
			error,
		});
		return fail("Failed to compute range report", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
