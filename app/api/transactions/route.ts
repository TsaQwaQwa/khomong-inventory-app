export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { TabTransaction } from "@/models/TabTransaction";
import { BusinessDay } from "@/models/BusinessDay";
import { Customer } from "@/models/Customer";
import { SaleTransaction } from "@/models/SaleTransaction";
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
	const customerId =
		url.searchParams.get("customerId");
	const limitParam = Number(
		url.searchParams.get("limit") ?? "100",
	);
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 1), 500)
		: 100;

	try {
		const tabMatch: Record<string, unknown> = {};
		if (customerId) tabMatch.customerId = customerId;

		let businessDayIdForDate: string | null = null;
		if (date) {
			const day = await BusinessDay.findOne({
				date,
			}).lean();
			if (!day) return ok([]);
			businessDayIdForDate = String(day._id);
			tabMatch.businessDayId = businessDayIdForDate;
		}

		const [tabDocs, directSalesDocs] =
			await Promise.all([
				TabTransaction.find(tabMatch)
					.sort({ createdAt: -1 })
					.limit(limit)
					.lean(),
				customerId
					? Promise.resolve([])
					: SaleTransaction.find(
							businessDayIdForDate
								? {
										businessDayId:
											businessDayIdForDate,
								  }
								: {},
					  )
							.sort({ createdAt: -1 })
							.limit(limit)
							.lean(),
			]);

		const businessDayIds = Array.from(
			new Set([
				...tabDocs.map(
					(doc) => doc.businessDayId,
				),
				...directSalesDocs.map(
					(doc) => doc.businessDayId,
				),
			]),
		);
		const customerIds = Array.from(
			new Set(
				tabDocs.map((doc) => doc.customerId),
			),
		);

		const [days, customers] = await Promise.all([
			businessDayIds.length > 0
				? BusinessDay.find({
						_id: { $in: businessDayIds },
				  }).lean()
				: [],
			customerIds.length > 0
				? Customer.find({
						_id: { $in: customerIds },
				  }).lean()
				: [],
		]);

		const dayById = new Map(
			days.map((d) => [String(d._id), d.date]),
		);
		const customerById = new Map(
			customers.map((c) => [
				String(c._id),
				c.name,
			]),
		);

		const entries = [
			...tabDocs.map((doc) => ({
				...serializeDoc(doc),
				date:
					dayById.get(doc.businessDayId) ??
					null,
				customerName:
					customerById.get(doc.customerId) ??
					"(unknown customer)",
			})),
			...directSalesDocs.map((doc) => ({
				...serializeDoc(doc),
				type: "DIRECT_SALE" as const,
				customerId: null,
				customerName: "Walk-in Sale",
				date:
					dayById.get(doc.businessDayId) ??
					null,
			})),
		]
			.sort((a, b) => {
				const ta = new Date(
					a.createdAt ?? 0,
				).getTime();
				const tb = new Date(
					b.createdAt ?? 0,
				).getTime();
				return tb - ta;
			})
			.slice(0, limit);

		return ok(entries);
	} catch {
		return fail("Failed to load transactions", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
