export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { TabTransaction } from "@/models/TabTransaction";
import { BusinessDay } from "@/models/BusinessDay";
import { Customer } from "@/models/Customer";
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
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");
	const customerId =
		url.searchParams.get("customerId");
	const typeParam = (
		url.searchParams.get("type") ?? "ALL"
	).toUpperCase();
	const fieldsParam = (
		url.searchParams.get("fields") ?? ""
	).toLowerCase();
	const fieldsQuick = fieldsParam === "quick";
	const requestedType:
		| "ALL"
		| "CHARGE"
		| "PAYMENT"
		| "ADJUSTMENT"
		| "EXPENSE" =
		typeParam === "CHARGE" ||
		typeParam === "PAYMENT" ||
		typeParam === "ADJUSTMENT" ||
		typeParam === "EXPENSE"
			? typeParam
			: "ALL";
	const limitParam = Number(
		url.searchParams.get("limit") ?? "100",
	);
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 1), 500)
		: 100;

	try {
		const match: Record<string, unknown> = {};

		if (customerId) {
			match.customerId = customerId;
		}

		if (requestedType !== "ALL") {
			match.type = requestedType;
		}

		let businessDayIdForDate: string | null =
			null;
		let businessDayIdsForRange: string[] = [];

		if (date) {
			const day = await BusinessDay.findOne({
				date,
			}).lean();
			if (!day) return ok([]);

			businessDayIdForDate = String(day._id);
			match.businessDayId = businessDayIdForDate;
		} else if (from && to) {
			const days = await BusinessDay.find({
				date: { $gte: from, $lte: to },
			})
				.select({ _id: 1 })
				.lean();

			businessDayIdsForRange = days.map((day) =>
				String(day._id),
			);

			if (!businessDayIdsForRange.length) {
				return ok([]);
			}

			match.businessDayId = {
				$in: businessDayIdsForRange,
			};
		}

		const tabDocs = await TabTransaction.find(match)
			.sort({ createdAt: -1 })
			.limit(limit)
			.select(
				fieldsQuick
					? {
							_id: 1,
							customerId: 1,
							businessDayId: 1,
							type: 1,
							manualAmountCents: 1,
							amountCents: 1,
							paymentMethod: 1,
							cashReceivedCents: 1,
							changeCents: 1,
							reference: 1,
							reason: 1,
							expenseCategory: 1,
							payee: 1,
							note: 1,
							createdAt: 1,
							reversalOfId: 1,
							items: 1,
					  }
					: {},
			)
			.lean();

		const customerIds = Array.from(
			new Set(
				tabDocs
					.map((doc) => doc.customerId)
					.filter(
						(
							value,
						): value is string =>
							typeof value ===
								"string" &&
							value.length > 0,
					),
			),
		);

		const customers =
			customerIds.length > 0
				? await Customer.find({
						_id: { $in: customerIds },
				  })
						.select({ _id: 1, name: 1 })
						.lean()
				: [];

		const customerById = new Map(
			customers.map((customer) => [
				String(customer._id),
				customer.name,
			]),
		);

		const entries = tabDocs
			.map((doc) => ({
				...serializeDoc(doc),
				date,
				customerName:
					doc.type === "EXPENSE"
						? (doc.payee ??
						  "Business Expense")
						: (doc.customerId
								? customerById.get(
										doc.customerId,
								  )
								: undefined) ??
						  "(unknown customer)",
			}))
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

		const originalIds = entries
			.map((entry) => entry.id)
			.filter(
				(
					entryId,
				): entryId is string =>
					typeof entryId === "string" &&
					entryId.length > 0,
			);

		const tabReversals =
			originalIds.length > 0
				? await TabTransaction.find({
						reversalOfId: { $in: originalIds },
				  })
						.select({ reversalOfId: 1 })
						.lean()
				: [];

		const reversedIdSet = new Set(
			tabReversals
				.map((doc) => doc.reversalOfId)
				.filter(Boolean),
		);

		const entriesWithFlags = entries.map(
			(entry) => ({
				...entry,
				isReversal: Boolean(
					entry.reversalOfId,
				),
				isReversed: reversedIdSet.has(
					entry.id,
				),
			}),
		);

		return ok(entriesWithFlags);
	} catch {
		return fail("Failed to load transactions", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
