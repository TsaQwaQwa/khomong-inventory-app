export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireAdminEmail } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Supplier } from "@/models/Supplier";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

export async function DELETE(
	_: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	let a;
	try {
		a = await requireAdminEmail();
	} catch (error) {
		const message = String(
			(error as Error)?.message ?? "",
		);
		if (message === "FORBIDDEN_ADMIN") {
			return fail("Admin access required", {
				status: 403,
				code: "FORBIDDEN",
			});
		}
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	const { id } = await ctx.params;
	await connectDB();

	const existing = await Supplier.findOne({
		_id: id,
	}).lean();
	if (!existing) {
		return fail("Supplier not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	}

	await Supplier.deleteOne({ _id: id });
	await writeAuditLog({
		scopeId: getScopeIdFromAuth(a),
		actorUserId: a.userId ?? undefined,
		action: "DELETE",
		entityType: "Supplier",
		entityId: id,
		oldValues: toAuditObject(existing),
		newValues: null,
	});

	return ok({ id });
}
