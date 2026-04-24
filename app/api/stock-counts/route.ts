export const runtime = "nodejs";

import { requireOrgAuth } from "@/lib/authz";
import { connectDB } from "@/lib/db";
import { todayYMD } from "@/lib/dates";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import {
	finalizeMorningStockCountSchema,
	morningStockCountSchema,
} from "@/lib/schemas";
import { Product } from "@/models/Product";
import { StockCount } from "@/models/StockCount";
import { serializeDoc } from "@/lib/serialize";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

const normalizeDate = (date?: string | null) =>
	date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayYMD();

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
	const date = normalizeDate(url.searchParams.get("date"));

	try {
		const [products, counts] = await Promise.all([
			Product.find({ isActive: true })
				.sort({ category: 1, name: 1 })
				.select({
					_id: 1,
					name: 1,
					category: 1,
					barcode: 1,
					packSize: 1
				})
				.lean(),
			StockCount.find({ date }).lean(),
		]);

		const countByProduct = new Map(
			counts.map((count) => [count.productId, count]),
		);
		const completed = counts.filter(
			(count) => count.status === "COMPLETED",
		).length;

		return ok({
			date,
			status:
				counts.length === 0
					? "NOT_STARTED"
					: completed === products.length
						? "COMPLETED"
						: "IN_PROGRESS",
			totalProducts: products.length,
			capturedProducts: counts.length,
			completedProducts: completed,
			products: products.map((product) => {
				const productId = String(product._id);
				const count = countByProduct.get(productId);
				return {
					id: productId,
					name: product.name,
					category: product.category,
					barcode: product.barcode ?? null,
					packSize: product.packSize ?? 1,
					count: count ? serializeDoc(count) : null,
				};
			}),
		});
	} catch (error) {
		console.error("Stock count load failed", { date, error });
		return fail("Failed to load stock counts", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
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
		const input = await parseJson(req, morningStockCountSchema);
		const date = normalizeDate(input.date);
		const now = new Date();
		const sessionId = input.sessionId ?? `morning-${date}`;

		const writes = input.counts.map((count) => ({
			updateOne: {
				filter: { date, productId: count.productId },
				update: {
					$set: {
						date,
						productId: count.productId,
						countedUnits: count.countedUnits,
						countedByUserId: a.userId!,
						countedAt: now,
						note: count.note,
						sessionId,
						status: input.status,
						...(input.status === "COMPLETED"
							? {
									finalizedByUserId: a.userId!,
									finalizedAt: now,
							  }
							: {}),
					},
					$setOnInsert: { source: "MANUAL" as const },
				},
				upsert: true,
			},
		}));

		await StockCount.bulkWrite(writes);
		const saved = await StockCount.find({ date })
			.sort({ updatedAt: -1 })
			.lean();

		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "CREATE",
			entityType: "StockCount",
			entityId: `${date}:${sessionId}`,
			oldValues: null,
			newValues: toAuditObject({ date, sessionId, counts: input.counts }),
		});

		return ok(saved.map(serializeDoc), { status: 201 });
	} catch (e: unknown) {
		const msg = String(e instanceof Error ? e.message : e);
		if (msg.startsWith("VALIDATION_ERROR:")) {
			return fail(msg.replace("VALIDATION_ERROR:", ""), {
				status: 400,
				code: "VALIDATION_ERROR",
			});
		}
		console.error("Stock count save failed", e);
		return fail("Failed to save stock count", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}

export async function PATCH(req: Request) {
	let a;
	try {
		a = await requireOrgAuth();
	} catch {
		return fail("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
	}

	await connectDB();
	try {
		const input = await parseJson(req, finalizeMorningStockCountSchema);
		const date = normalizeDate(input.date);
		const filter = input.sessionId
			? { date, sessionId: input.sessionId }
			: { date };
		const result = await StockCount.updateMany(filter, {
			$set: {
				status: "COMPLETED",
				finalizedByUserId: a.userId!,
				finalizedAt: new Date(),
			},
		});

		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "UPDATE",
			entityType: "StockCount",
			entityId: input.sessionId ? `${date}:${input.sessionId}` : date,
			oldValues: null,
			newValues: toAuditObject({ date, sessionId: input.sessionId, status: "COMPLETED" }),
		});

		return ok({ date, finalizedCount: result.modifiedCount });
	} catch (e: unknown) {
		const msg = String(e instanceof Error ? e.message : e);
		if (msg.startsWith("VALIDATION_ERROR:")) {
			return fail(msg.replace("VALIDATION_ERROR:", ""), {
				status: 400,
				code: "VALIDATION_ERROR",
			});
		}
		console.error("Stock count finalize failed", e);
		return fail("Failed to finalize stock count", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
