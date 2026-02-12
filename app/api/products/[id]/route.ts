export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import {
	requireOrgAuth,
	isOrgAdmin,
} from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Product } from "@/models/Product";
import { serializeDoc } from "@/lib/serialize";

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
	return ok(serializeDoc(updated));
}
