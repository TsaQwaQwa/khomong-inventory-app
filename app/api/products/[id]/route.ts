export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Product } from "@/models/Product";
import { serializeDoc } from "@/lib/serialize";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

export async function GET(
	_: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	const a = await requireOrgAuth().catch(
		() => null,
	);

	const { id } = await ctx.params;

	await connectDB();
	const doc = await Product.findOne({
		_id: id,
	}).lean();
	if (!doc)
		return fail("Not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	return ok(serializeDoc(doc));
}

export async function PATCH(
	req: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	const a = await requireOrgAuth().catch(
		() => null,
	);
	if (!a)
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});

	const { id } = await ctx.params;
	const patch = await req
		.json()
		.catch(() => null);
	if (!patch)
		return fail("Invalid JSON", {
			status: 400,
			code: "INVALID_JSON",
		});

	await connectDB();
	const existing = await Product.findOne({
		_id: id,
	}).lean();
	if (!existing)
		return fail("Not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	const updated = await Product.findOneAndUpdate(
		{ _id: id },
		{ $set: patch },
		{ new: true },
	).lean();
	if (!updated)
		return fail("Not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	await writeAuditLog({
		scopeId: getScopeIdFromAuth(a),
		actorUserId: a.userId ?? undefined,
		action: "UPDATE",
		entityType: "Product",
		entityId: id,
		oldValues: toAuditObject(existing),
		newValues: toAuditObject(updated),
	});
	return ok(serializeDoc(updated));
}
