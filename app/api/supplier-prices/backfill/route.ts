export const runtime = "nodejs";

import { requireAdminEmail } from "@/lib/authz";
import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { getScopeIdFromAuth } from "@/lib/audit";
import { learnSupplierPricesFromPurchase } from "@/lib/supplier-price-learning";
import { Purchase } from "@/models/Purchase";

export async function POST() {
	let a;
	try {
		a = await requireAdminEmail();
	} catch (e: any) {
		const msg = String(e?.message ?? "");
		if (msg === "FORBIDDEN_ADMIN") {
			return fail("Forbidden", {
				status: 403,
				code: "FORBIDDEN",
			});
		}
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();
	try {
		const purchases = await Purchase.find({
			supplierId: { $exists: true, $ne: "" },
		})
			.sort({ purchaseDate: 1, createdAt: 1 })
			.lean();

		let processedPurchases = 0;
		let processedLineCosts = 0;
		for (const purchase of purchases) {
			processedPurchases += 1;
			processedLineCosts += (purchase.items ?? []).filter(
				(item) =>
					Boolean(item.productId) &&
					typeof item.unitCostCents === "number" &&
					item.unitCostCents > 0,
			).length;
			await learnSupplierPricesFromPurchase({
				purchase,
				scopeId: getScopeIdFromAuth(a),
				actorUserId: a.userId ?? undefined,
			});
		}

		return ok({
			processedPurchases,
			processedLineCosts,
		});
	} catch {
		return fail(
			"Failed to backfill supplier costs from purchases",
			{
				status: 500,
				code: "SERVER_ERROR",
			},
		);
	}
}

