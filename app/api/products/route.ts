export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { productCreateSchema } from "@/lib/schemas";
import { todayYMD } from "@/lib/dates";
import { computeStockPositionAsOfDate } from "@/lib/stock-movement";
import { Product } from "@/models/Product";
import { Price } from "@/models/Price";
import { serializeDoc, serializeDocs } from "@/lib/serialize";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

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
	const includeStock = url.searchParams.get("includeStock") === "1";
	const asOfParam = url.searchParams.get("asOf");
	const asOf = isYmd(asOfParam) ? asOfParam! : todayYMD();

	const products = await Product.find({ isActive: true })
		.sort({ name: 1 })
		.lean();
	const productIds = products.map((product) => String(product._id));
	const priceDocs = await Price.find({
		productId: { $in: productIds },
	})
		.sort({ effectiveFrom: -1, createdAt: -1 })
		.lean();
	const priceMap = new Map<string, number>();
	for (const price of priceDocs) {
		if (priceMap.has(price.productId)) continue;
		priceMap.set(price.productId, price.priceCents);
	}
	const productsWithPrice = products.map((product) => ({
		...product,
		currentPriceCents: priceMap.get(String(product._id)),
	}));

	if (!includeStock) {
		return ok(serializeDocs(productsWithPrice));
	}

	const stockByProduct = await computeStockPositionAsOfDate(asOf);
	const productsWithPriceAndStock = productsWithPrice.map((product) => {
		const productId = String(product._id);
		const currentUnits = stockByProduct.get(productId) ?? 0;
		const reorderLevelUnits = product.reorderLevelUnits ?? 0;
		const stockStatus =
			currentUnits <= 0
				? "OUT"
				: currentUnits <= reorderLevelUnits
					? "LOW"
					: "OK";
		return {
			...product,
			currentUnits,
			stockStatus,
			stockAsOf: asOf,
		};
	});
	return ok(serializeDocs(productsWithPriceAndStock));
}

export async function POST(req: Request) {
	let a;
	try {
		a = await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();

	try {
		const input = await parseJson(req, productCreateSchema);
		const created = await Product.create({ ...input });
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "CREATE",
			entityType: "Product",
			entityId: String(created._id),
			oldValues: null,
			newValues: toAuditObject(created.toObject()),
		});
		return ok(serializeDoc(created.toObject()), { status: 201 });
	} catch (e: unknown) {
		const msg = String(e instanceof Error ? e.message : e);
		if (msg.startsWith("VALIDATION_ERROR:")) {
			return fail(msg.replace("VALIDATION_ERROR:", ""), {
				status: 400,
				code: "VALIDATION_ERROR",
			});
		}
		if (msg.includes("E11000")) {
			return fail("Product already exists", {
				status: 409,
				code: "DUPLICATE",
			});
		}
		return fail("Failed to create product", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
