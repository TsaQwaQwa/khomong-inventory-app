export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { setPriceSchema } from "@/lib/schemas";
import { todayYMD, addDays } from "@/lib/dates";
import { Price } from "@/models/Price";
import { serializeDoc } from "@/lib/serialize";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

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
			setPriceSchema,
		);
		const effectiveFrom =
			input.effectiveFrom ?? todayYMD();
		const previousOpenPrices = await Price.find({
			productId: input.productId,
			$or: [
				{ effectiveTo: { $exists: false } },
				{ effectiveTo: null },
			],
		}).lean();

		// Close any previous open-ended price window
		await Price.updateMany(
			{
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

		const created = await Price.create({
			productId: input.productId,
			priceCents: input.priceCents,
			effectiveFrom,
			changedByUserId: a.userId!,
			reason: input.reason,
		});
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "SET_PRICE",
			entityType: "Price",
			entityId: String(created._id),
			oldValues: toAuditObject({
				previousOpenPrices,
			}),
			newValues: toAuditObject(created.toObject()),
			meta: {
				productId: input.productId,
				effectiveFrom,
			},
		});

		return ok(serializeDoc(created.toObject()), {
			status: 201,
		});
	} catch (e: any) {
		const msg = String(e?.message ?? e);
		if (msg.startsWith("VALIDATION_ERROR:"))
			return fail(
				msg.replace("VALIDATION_ERROR:", ""),
				{ status: 400, code: "VALIDATION_ERROR" },
			);
		return fail("Failed to set price", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
