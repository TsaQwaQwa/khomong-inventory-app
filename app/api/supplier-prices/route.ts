export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { supplierProductPriceSchema } from "@/lib/schemas";
import { todayYMD, addDays } from "@/lib/dates";
import { serializeDoc, serializeDocs } from "@/lib/serialize";
import { SupplierProductPrice } from "@/models/SupplierProductPrice";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

export async function GET(req: Request) {
	await requireOrgAuth().catch(() => null);

	const url = new URL(req.url);
	const supplierId =
		url.searchParams.get("supplierId") ?? "";
	const productId =
		url.searchParams.get("productId") ?? "";
	const asOf = url.searchParams.get("asOf") ?? todayYMD();

	await connectDB();

	const where: Record<string, unknown> = {
		effectiveFrom: { $lte: asOf },
		$or: [
			{ effectiveTo: { $exists: false } },
			{ effectiveTo: null },
			{ effectiveTo: { $gte: asOf } },
		],
	};
	if (supplierId) where.supplierId = supplierId;
	if (productId) where.productId = productId;

	const docs = await SupplierProductPrice.find(where)
		.sort({
			effectiveFrom: -1,
			createdAt: -1,
		})
		.lean();

	return ok(serializeDocs(docs));
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
		const input = await parseJson(
			req,
			supplierProductPriceSchema,
		);
		const effectiveFrom =
			input.effectiveFrom ?? todayYMD();
		const previousOpenPrices =
			await SupplierProductPrice.find({
				supplierId: input.supplierId,
				productId: input.productId,
				$or: [
					{ effectiveTo: { $exists: false } },
					{ effectiveTo: null },
				],
			}).lean();

		await SupplierProductPrice.updateMany(
			{
				supplierId: input.supplierId,
				productId: input.productId,
				$or: [
					{ effectiveTo: { $exists: false } },
					{ effectiveTo: null },
				],
			},
			{
				$set: {
					effectiveTo: addDays(effectiveFrom, -1),
				},
			},
		);

		const created = await SupplierProductPrice.create({
			supplierId: input.supplierId,
			productId: input.productId,
			unitCostCents: input.unitCostCents,
			effectiveFrom,
			moqUnits: input.moqUnits,
			leadTimeDays: input.leadTimeDays,
			note: input.note,
			changedByUserId: a.userId!,
		});
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "SET_SUPPLIER_PRICE",
			entityType: "SupplierProductPrice",
			entityId: String(created._id),
			oldValues: toAuditObject({
				previousOpenPrices,
			}),
			newValues: toAuditObject(created.toObject()),
			meta: {
				supplierId: input.supplierId,
				productId: input.productId,
				effectiveFrom,
			},
		});

		return ok(serializeDoc(created.toObject()), {
			status: 201,
		});
	} catch (e: any) {
		const msg = String(e?.message ?? e);
		if (msg.startsWith("VALIDATION_ERROR:")) {
			return fail(
				msg.replace("VALIDATION_ERROR:", ""),
				{
					status: 400,
					code: "VALIDATION_ERROR",
				},
			);
		}
		return fail("Failed to set supplier price", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
