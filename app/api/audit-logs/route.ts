export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireAdminEmail } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { serializeDocs } from "@/lib/serialize";
import { AuditLog } from "@/models/AuditLog";

export async function GET(req: Request) {
	let a;
	try {
		a = await requireAdminEmail();
	} catch {
		return fail("Forbidden", {
			status: 403,
			code: "FORBIDDEN",
		});
	}

	await connectDB();
	const scopeId = a.orgId ?? a.userId!;
	const url = new URL(req.url);
	const entityType = url.searchParams.get("entityType") ?? "";
	const entityId = url.searchParams.get("entityId") ?? "";
	const action = url.searchParams.get("action") ?? "";
	const limitParam = Number(url.searchParams.get("limit") ?? "200");
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 1), 1000)
		: 200;

	const where: Record<string, unknown> = {
		scopeId,
		entityType: { $ne: "Alert" },
	};
	if (entityType && entityType !== "Alert") {
		where.entityType = entityType;
	}
	if (entityId) where.entityId = entityId;
	if (action) where.action = action;

	try {
		const docs = await AuditLog.find(where)
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean();
		return ok(serializeDocs(docs));
	} catch {
		return fail("Failed to load audit logs", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
