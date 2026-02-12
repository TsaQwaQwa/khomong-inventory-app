export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { adjustmentSchema } from "@/lib/schemas";
import { getOrCreateDay } from "@/lib/businessDay";
import { Adjustment } from "@/models/Adjustment";
import { BusinessDay } from "@/models/BusinessDay";
import { serializeDoc } from "@/lib/serialize";

export async function GET(req: Request) {
	try {
		await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();

	const url = new URL(req.url);
	const date = url.searchParams.get("date");
	const limitParam = Number(
		url.searchParams.get("limit") ?? "50",
	);
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 1), 200)
		: 50;

	try {
		if (date) {
			const day = await BusinessDay.findOne({
				date,
			}).lean();
			if (!day) return ok([]);

			const docs = await Adjustment.find({
				businessDayId: String(day._id),
			})
				.sort({ createdAt: -1 })
				.lean();

			return ok(
				docs.map((doc) => ({
					...serializeDoc(doc),
					date,
				})),
			);
		}

		const docs = await Adjustment.find()
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean();

		const businessDayIds = Array.from(
			new Set(docs.map((doc) => doc.businessDayId)),
		);

		const days = await BusinessDay.find({
			_id: { $in: businessDayIds },
		}).lean();

		const dayById = new Map(
			days.map((d) => [String(d._id), d.date]),
		);

		return ok(
			docs.map((doc) => ({
				...serializeDoc(doc),
				date:
					dayById.get(doc.businessDayId) ??
					null,
			})),
		);
	} catch {
		return fail("Failed to load adjustment history", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
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
			adjustmentSchema,
		);
		const day = await getOrCreateDay(
			input.date,
			a.userId!,
		);

		const created = await Adjustment.create({
			businessDayId: String(day._id),
			items: input.items,
			createdByUserId: a.userId!,
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
		return fail("Failed to create adjustment", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
