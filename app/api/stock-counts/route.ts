export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { dailyStockCountUpsertSchema } from "@/lib/schemas";
import { todayYMD } from "@/lib/dates";
import { serializeDoc } from "@/lib/serialize";
import { DailyStockCount } from "@/models/DailyStockCount";

export async function GET(req: Request) {
	const a = await requireOrgAuth().catch(() => null);
	if (!a) {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	const url = new URL(req.url);
	const date = url.searchParams.get("date") ?? todayYMD();

	await connectDB();
	const doc = await DailyStockCount.findOne({ date })
		.sort({ createdAt: -1 })
		.lean();

	return ok(doc ? serializeDoc(doc) : null);
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
			dailyStockCountUpsertSchema,
		);

		const date = input.date ?? todayYMD();
		const sessionId = input.sessionId;
		const nextStatus = input.status ?? "DRAFT";
		const existing = await DailyStockCount.findOne({
			date,
			sessionId,
		});

		if (!existing) {
			const created = await DailyStockCount.create({
				date,
				sessionId,
				status: nextStatus,
				items: input.items,
				countedByUserId: a.userId!,
				countedAt: new Date(),
				finalizedByUserId:
					nextStatus === "COMPLETED"
						? a.userId!
						: undefined,
				finalizedAt:
					nextStatus === "COMPLETED"
						? new Date()
						: undefined,
			});
			return ok(serializeDoc(created.toObject()), {
				status: 201,
			});
		}

		existing.items = input.items;
		existing.status = nextStatus;
		existing.countedByUserId = a.userId!;
		existing.countedAt = new Date();

		if (nextStatus === "COMPLETED") {
			existing.finalizedByUserId = a.userId!;
			existing.finalizedAt = new Date();
		} else {
			existing.finalizedByUserId = undefined;
			existing.finalizedAt = undefined;
		}

		await existing.save();

		return ok(serializeDoc(existing.toObject()));
	} catch (e: any) {
		const msg = String(e?.message ?? e);
		if (msg.startsWith("VALIDATION_ERROR:")) {
			return fail(msg.replace("VALIDATION_ERROR:", ""), {
				status: 400,
				code: "VALIDATION_ERROR",
			});
		}
		if (
			typeof e?.code === "number" &&
			e.code === 11000
		) {
			return fail("A stock count session already exists for this date.", {
				status: 409,
				code: "DUPLICATE_STOCK_COUNT",
			});
		}
		return fail("Failed to save stock count", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
