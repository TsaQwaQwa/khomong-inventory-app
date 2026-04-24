export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { TabTransaction } from "@/models/TabTransaction";
import { BusinessDay } from "@/models/BusinessDay";

interface SearchResultItem {
	id: string;
	type: "PRODUCT" | "CUSTOMER" | "TRANSACTION";
	title: string;
	description: string;
	href: string;
}

function escapeRegex(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
	const q = (url.searchParams.get("q") ?? "").trim();
	if (q.length < 2) return ok([] as SearchResultItem[]);

	const limitParam = Number(url.searchParams.get("limit") ?? "8");
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 1), 20)
		: 8;

	await connectDB();
	const regex = new RegExp(escapeRegex(q), "i");

	try {
		const [products, customers, tabTxns] = await Promise.all([
			Product.find({
				isActive: true,
				$or: [{ name: regex }, { barcode: regex }],
			})
				.select({ _id: 1, name: 1, barcode: 1 })
				.limit(limit)
				.lean(),
			Customer.find({
				isActive: true,
				$or: [{ name: regex }, { phone: regex }],
			})
				.select({ _id: 1, name: 1, phone: 1 })
				.limit(limit)
				.lean(),
			TabTransaction.find({
				type: { $in: ["PAYMENT", "ADJUSTMENT", "EXPENSE"] },
				$or: [
					{ reference: regex },
					{ reason: regex },
					{ payee: regex },
					{ expenseCategory: regex },
					{ note: regex },
				],
			})
				.sort({ createdAt: -1 })
				.select({
					_id: 1,
					type: 1,
					reference: 1,
					reason: 1,
					payee: 1,
					expenseCategory: 1,
					note: 1,
					businessDayId: 1,
				})
				.limit(limit)
				.lean(),
		]);

		const dayIds = Array.from(
			new Set(tabTxns.map((txn) => txn.businessDayId)),
		).filter(Boolean);
		const days = dayIds.length
			? await BusinessDay.find({ _id: { $in: dayIds } })
					.select({ _id: 1, date: 1 })
					.lean()
			: [];
		const dayById = new Map(
			days.map((day) => [String(day._id), day.date]),
		);

		const results: SearchResultItem[] = [];
		for (const product of products) {
			results.push({
				id: `product_${String(product._id)}`,
				type: "PRODUCT",
				title: product.name,
				description: product.barcode
					? `Barcode: ${product.barcode}`
					: "Product",
				href: "/products",
			});
		}
		for (const customer of customers) {
			results.push({
				id: `customer_${String(customer._id)}`,
				type: "CUSTOMER",
				title: customer.name,
				description: customer.phone
					? `Phone: ${customer.phone}`
					: "Customer",
				href: "/tabs",
			});
		}
		for (const txn of tabTxns) {
			const date = dayById.get(txn.businessDayId) ?? "";
			const reference =
				txn.reference ??
				txn.reason ??
				txn.note ??
				"(no reference)";
			results.push({
				id: `tabtxn_${String(txn._id)}`,
				type: "TRANSACTION",
				title:
					txn.type === "EXPENSE"
						? "Expense"
						: `Account ${txn.type}`,
				description: `${reference}${date ? ` | ${date}` : ""}`,
				href: date ? `/transactions?date=${date}` : "/transactions",
			});
		}

		return ok(results.slice(0, limit * 3));
	} catch (error) {
		console.error("Global search failed", { q, error });
		return fail("Failed to search", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
