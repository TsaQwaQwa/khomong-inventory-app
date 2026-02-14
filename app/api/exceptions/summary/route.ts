export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { todayYMD } from "@/lib/dates";
import { getCurrentStockByProductIds } from "@/lib/stock-availability";
import { Product } from "@/models/Product";
import { Price } from "@/models/Price";
import { Customer } from "@/models/Customer";
import { TabAccount } from "@/models/TabAccount";
import { TabTransaction } from "@/models/TabTransaction";

type CustomerBalanceAgg = {
	_id: string;
	charges?: number;
	payments?: number;
	adjustments?: number;
	latestChargeAt?: Date | null;
};

export async function GET() {
	try {
		await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();
	const today = todayYMD();

	try {
		const products = await Product.find({
			isActive: true,
		})
			.select({
				_id: 1,
				name: 1,
				reorderLevelUnits: 1,
			})
			.sort({ name: 1 })
			.lean();
		const productIds = products.map((product) =>
			String(product._id),
		);
		const stockByProduct =
			await getCurrentStockByProductIds(productIds);

		const activePrices = await Price.find({
			productId: { $in: productIds },
			effectiveFrom: { $lte: today },
			$or: [
				{ effectiveTo: { $exists: false } },
				{ effectiveTo: null },
				{ effectiveTo: { $gte: today } },
			],
		})
			.sort({
				effectiveFrom: -1,
				createdAt: -1,
			})
			.select({
				productId: 1,
			})
			.lean();
		const pricedProductIds = new Set<string>();
		for (const price of activePrices) {
			if (pricedProductIds.has(price.productId)) continue;
			pricedProductIds.add(price.productId);
		}

		const outOfStock: Array<{
			productId: string;
			productName: string;
			currentUnits: number;
		}> = [];
		const negativeStock: Array<{
			productId: string;
			productName: string;
			currentUnits: number;
		}> = [];
		const noPrice: Array<{
			productId: string;
			productName: string;
		}> = [];

		for (const product of products) {
			const productId = String(product._id);
			const currentUnits =
				stockByProduct.get(productId) ?? 0;
			if (currentUnits <= 0) {
				outOfStock.push({
					productId,
					productName: product.name,
					currentUnits,
				});
			}
			if (currentUnits < 0) {
				negativeStock.push({
					productId,
					productName: product.name,
					currentUnits,
				});
			}
			if (!pricedProductIds.has(productId)) {
				noPrice.push({
					productId,
					productName: product.name,
				});
			}
		}

		const customers = await Customer.find({
			isActive: true,
		})
			.select({ _id: 1, name: 1 })
			.lean();
		const customerIds = customers.map((customer) =>
			String(customer._id),
		);
		const customerNameById = new Map(
			customers.map((customer) => [
				String(customer._id),
				customer.name,
			]),
		);

		const accounts = await TabAccount.find({
			customerId: { $in: customerIds },
			status: "ACTIVE",
			dueDays: { $exists: true, $ne: null },
		})
			.select({
				customerId: 1,
				dueDays: 1,
			})
			.lean();
		const accountByCustomerId = new Map(
			accounts.map((account) => [
				account.customerId,
				account,
			]),
		);
		const dueDaysCustomerIds = accounts.map(
			(account) => account.customerId,
		);

		const balances =
			dueDaysCustomerIds.length > 0
				? await TabTransaction.aggregate<CustomerBalanceAgg>([
						{
							$match: {
								customerId: {
									$in: dueDaysCustomerIds,
								},
							},
						},
						{
							$group: {
								_id: "$customerId",
								charges: {
									$sum: {
										$cond: [
											{
												$eq: [
													"$type",
													"CHARGE",
												],
											},
											"$amountCents",
											0,
										],
									},
								},
								payments: {
									$sum: {
										$cond: [
											{
												$eq: [
													"$type",
													"PAYMENT",
												],
											},
											"$amountCents",
											0,
										],
									},
								},
								adjustments: {
									$sum: {
										$cond: [
											{
												$eq: [
													"$type",
													"ADJUSTMENT",
												],
											},
											"$amountCents",
											0,
										],
									},
								},
								latestChargeAt: {
									$max: {
										$cond: [
											{
												$eq: [
													"$type",
													"CHARGE",
												],
											},
											"$createdAt",
											null,
										],
									},
								},
							},
						},
				  ])
				: [];

		const overdueTabs: Array<{
			customerId: string;
			customerName: string;
			balanceCents: number;
			dueDate: string;
		}> = [];
		for (const entry of balances) {
			const account = accountByCustomerId.get(entry._id);
			if (!account?.dueDays || !entry.latestChargeAt) continue;
			const balanceCents =
				(entry.charges ?? 0) -
				(entry.payments ?? 0) +
				(entry.adjustments ?? 0);
			if (balanceCents <= 0) continue;
			const dueAt = new Date(entry.latestChargeAt);
			dueAt.setDate(dueAt.getDate() + account.dueDays);
			const dueDate = dueAt.toISOString().slice(0, 10);
			if (dueDate >= today) continue;
			overdueTabs.push({
				customerId: entry._id,
				customerName:
					customerNameById.get(entry._id) ??
					"(unknown customer)",
				balanceCents,
				dueDate,
			});
		}

		outOfStock.sort((a, b) => a.currentUnits - b.currentUnits);
		negativeStock.sort((a, b) => a.currentUnits - b.currentUnits);
		noPrice.sort((a, b) =>
			a.productName.localeCompare(b.productName),
		);
		overdueTabs.sort(
			(a, b) => b.balanceCents - a.balanceCents,
		);

		return ok({
			asOfDate: today,
			counts: {
				outOfStock: outOfStock.length,
				negativeStock: negativeStock.length,
				noPrice: noPrice.length,
				overdueTabs: overdueTabs.length,
			},
			outOfStock: outOfStock.slice(0, 30),
			negativeStock: negativeStock.slice(0, 30),
			noPrice: noPrice.slice(0, 30),
			overdueTabs: overdueTabs.slice(0, 30),
		});
	} catch {
		return fail("Failed to load exceptions summary", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}

