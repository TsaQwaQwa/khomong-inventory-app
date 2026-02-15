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
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

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
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");
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
		if (from && to) {
			const days = await BusinessDay.find({
				date: { $gte: from, $lte: to },
			})
				.select({ _id: 1, date: 1 })
				.lean();
			if (!days.length) return ok([]);
			const dayById = new Map(
				days.map((day) => [
					String(day._id),
					day.date,
				]),
			);
			const dayIds = Array.from(dayById.keys());
			const docs = await Adjustment.find({
				businessDayId: { $in: dayIds },
			})
				.sort({ createdAt: -1 })
				.limit(limit)
				.lean();
			return ok(
				docs.map((doc) => ({
					...serializeDoc(doc),
					date:
						dayById.get(doc.businessDayId) ??
						null,
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
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "CREATE",
			entityType: "Adjustment",
			entityId: String(created._id),
			oldValues: null,
			newValues: toAuditObject(created.toObject()),
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
