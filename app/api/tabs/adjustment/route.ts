export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { tabAdjustmentSchema } from "@/lib/schemas";
import { getOrCreateDay } from "@/lib/businessDay";
import { TabTransaction } from "@/models/TabTransaction";
import { TabAccount } from "@/models/TabAccount";
import { todayYMD } from "@/lib/dates";
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
			tabAdjustmentSchema,
		);
		const date = input.date ?? todayYMD();
		const day = await getOrCreateDay(
			date,
			a.userId!,
		);

		const account = await TabAccount.findOne({
			customerId: input.customerId,
		}).lean();
		if (!account) {
			return fail("Tab account not found", {
				status: 404,
				code: "NOT_FOUND",
			});
		}
		if (account.status !== "ACTIVE") {
			return fail("Tab account blocked", {
				status: 403,
				code: "BLOCKED",
			});
		}

		const created = await TabTransaction.create({
			customerId: input.customerId,
			businessDayId: String(day._id),
			type: "ADJUSTMENT",
			amountCents: input.amountCents,
			note: input.note,
			createdByUserId: a.userId!,
		});

		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "CREATE",
			entityType: "TabTransaction",
			entityId: String(created._id),
			oldValues: null,
			newValues: toAuditObject(created.toObject()),
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
		return fail("Failed to create tab adjustment", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
