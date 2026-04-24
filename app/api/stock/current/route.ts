export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { todayYMD } from "@/lib/dates";
import { computeStockPositionAsOfDate } from "@/lib/stock-movement";
import { Product } from "@/models/Product";

const isYmd = (value: string | null) =>
	Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export async function GET(req: Request) {
	try {
		await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();

	const url = new URL(req.url);
	const asOfParam = url.searchParams.get("asOf");
	const asOf = isYmd(asOfParam) ? asOfParam! : todayYMD();

	try {
		const [products, stockByProduct] = await Promise.all([
			Product.find({ isActive: true })
				.select({
					_id: 1,
					name: 1,
					category: 1,
					reorderLevelUnits: 1,
				})
				.sort({ name: 1 })
				.lean(),
			computeStockPositionAsOfDate(asOf),
		]);

		const rows = products.map((product) => {
			const productId = String(product._id);
			const currentUnits = stockByProduct.get(productId) ?? 0;
			const reorderLevelUnits = product.reorderLevelUnits ?? 0;
			const status =
				currentUnits <= 0
					? "OUT"
					: currentUnits <= reorderLevelUnits
						? "LOW"
						: "OK";

			return {
				productId,
				productName: product.name,
				category: product.category,
				currentUnits,
				reorderLevelUnits,
				status,
				asOf,
			};
		});

		return ok(rows);
	} catch (error) {
		console.error("Current stock load failed", { asOf, error });
		return fail("Failed to load current stock", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
