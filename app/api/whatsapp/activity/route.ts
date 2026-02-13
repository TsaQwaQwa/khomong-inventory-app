export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireAdminEmail } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { serializeDocs } from "@/lib/serialize";
import { WhatsAppMessageEvent } from "@/models/WhatsAppMessageEvent";

export async function GET(req: Request) {
	try {
		await requireAdminEmail();
	} catch {
		return fail("Forbidden", {
			status: 403,
			code: "FORBIDDEN",
		});
	}

	await connectDB();
	const url = new URL(req.url);
	const limitParam = Number(
		url.searchParams.get("limit") ?? "100",
	);
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 1), 500)
		: 100;

	try {
		const docs = await WhatsAppMessageEvent.find({})
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean();
		return ok(serializeDocs(docs));
	} catch {
		return fail(
			"Failed to load WhatsApp activity",
			{
				status: 500,
				code: "SERVER_ERROR",
			},
		);
	}
}
