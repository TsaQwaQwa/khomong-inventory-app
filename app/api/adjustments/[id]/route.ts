export const runtime = "nodejs";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { adjustmentSchema } from "@/lib/schemas";
import { Adjustment } from "@/models/Adjustment";
import { serializeDoc } from "@/lib/serialize";

const adjustmentUpdateSchema = z.object({
	items: adjustmentSchema.shape.items,
});

export async function PATCH(
	req: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	try {
		await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();

	const { id } = await ctx.params;

	try {
		const input = await parseJson(
			req,
			adjustmentUpdateSchema,
		);

		const existing = await Adjustment.findOne({
			_id: id,
		}).lean();
		if (!existing)
			return fail("Adjustment not found", {
				status: 404,
				code: "NOT_FOUND",
			});

		const updated =
			await Adjustment.findOneAndUpdate(
				{ _id: id },
				{ $set: { items: input.items } },
				{ new: true },
			).lean();

		if (!updated)
			return fail("Adjustment not found", {
				status: 404,
				code: "NOT_FOUND",
			});

		return ok(serializeDoc(updated));
	} catch (e: any) {
		const msg = String(e?.message ?? e);
		if (msg.startsWith("VALIDATION_ERROR:"))
			return fail(
				msg.replace("VALIDATION_ERROR:", ""),
				{ status: 400, code: "VALIDATION_ERROR" },
			);
		return fail("Failed to update adjustment", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
