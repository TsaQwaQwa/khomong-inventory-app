export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Alert } from "@/models/Alert";
import { serializeDocs } from "@/lib/serialize";

export async function GET(req: Request) {
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
	const scopeId = a.orgId ?? a.userId!;
	const url = new URL(req.url);
	const statusParam = (
		url.searchParams.get("status") ?? "all"
	).toUpperCase();
	const limitParam = Number(
		url.searchParams.get("limit") ?? "100",
	);
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 1), 500)
		: 100;

	const match: Record<string, unknown> = { scopeId };
	if (
		statusParam === "UNREAD" ||
		statusParam === "READ"
	) {
		match.status = statusParam;
	}

	try {
		const docs = await Alert.find(match)
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean();
		return ok(serializeDocs(docs));
	} catch {
		return fail("Failed to load alerts", {
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
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();
	const scopeId = a.orgId ?? a.userId!;

	try {
		const body = (await req.json()) as {
			ids?: string[];
			status?: "UNREAD" | "READ";
		};
		const ids = Array.isArray(body.ids)
			? body.ids.filter(
					(id): id is string =>
						typeof id === "string" &&
						id.length > 0,
			  )
			: [];
		const status = body.status;

		if (
			ids.length === 0 ||
			(status !== "READ" && status !== "UNREAD")
		) {
			return fail("Invalid payload", {
				status: 400,
				code: "BAD_REQUEST",
			});
		}

		await Alert.updateMany(
			{
				_id: { $in: ids },
				scopeId,
			},
			{ $set: { status } },
		);

		return ok({ updated: ids.length });
	} catch {
		return fail("Failed to update alerts", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
