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
		| "EXPENSE"
		| "DIRECT_SALE" =
		typeParam === "CHARGE" ||
		typeParam === "PAYMENT" ||
		typeParam === "ADJUSTMENT" ||
		typeParam === "EXPENSE" ||
		typeParam === "DIRECT_SALE"
			? typeParam
			: "ALL";
	const limitParam = Number(
		url.searchParams.get("limit") ?? "100",
	);
	const limit = Number.isFinite(limitParam)
		? Math.min(Math.max(limitParam, 1), 500)
		: 100;

	try {
		const tabMatch: Record<string, unknown> = {};
		if (customerId) tabMatch.customerId = customerId;
		if (
			requestedType !== "ALL" &&
			requestedType !== "DIRECT_SALE"
		) {
			tabMatch.type = requestedType;
		}
		const shouldLoadTabTransactions =
			requestedType === "ALL" ||
			requestedType !== "DIRECT_SALE";
		const shouldLoadDirectSales =
			!customerId &&
			(requestedType === "ALL" ||
				requestedType === "DIRECT_SALE");

		let businessDayIdForDate: string | null = null;
		let businessDayIdsForRange: string[] = [];
		if (date) {
			const day = await BusinessDay.findOne({
				date,
			}).lean();
			if (!day) return ok([]);
			businessDayIdForDate = String(day._id);
			tabMatch.businessDayId = businessDayIdForDate;
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
			tabMatch.businessDayId = {
				$in: businessDayIdsForRange,
			};
		}

		const [tabDocs, directSalesDocs] =
			await Promise.all([
				shouldLoadTabTransactions
					? TabTransaction.find(tabMatch)
							.sort({ createdAt: -1 })
							.limit(limit)
							.select(
								fieldsQuick
								? {
										_id: 1,
										customerId: 1,
										businessDayId: 1,
										type: 1,
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
								  }
									: {},
							)
							.lean()
					: Promise.resolve([]),
				!shouldLoadDirectSales
					? Promise.resolve([])
					: SaleTransaction.find(
							businessDayIdForDate
								? {
										businessDayId:
											businessDayIdForDate,
								  }
								: businessDayIdsForRange.length > 0
									? {
											businessDayId: {
												$in: businessDayIdsForRange,
											},
									  }
								: {},
					  )
							.sort({ createdAt: -1 })
							.limit(limit)
							.select(
								fieldsQuick
								? {
										_id: 1,
										businessDayId: 1,
										paymentMethod: 1,
										amountCents: 1,
										cashReceivedCents: 1,
										changeCents: 1,
										items: 1,
										createdAt: 1,
										reversalOfId: 1,
								  }
									: {},
							)
							.lean(),
			]);

		const businessDayIds =
			date !== null
				? []
				: Array.from(
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
				tabDocs
					.map((doc) => doc.customerId)
					.filter(
						(customerId): customerId is string =>
							typeof customerId === "string" &&
							customerId.length > 0,
					),
			),
		);

		const [days, customers] = await Promise.all([
			businessDayIds.length > 0
				? BusinessDay.find({
						_id: { $in: businessDayIds },
				  })
						.select({ _id: 1, date: 1 })
						.lean()
				: [],
			customerIds.length > 0
				? Customer.find({
						_id: { $in: customerIds },
				  })
						.select({ _id: 1, name: 1 })
						.lean()
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
					date ??
					dayById.get(doc.businessDayId) ??
					null,
				customerName: doc.type === "EXPENSE"
					? (doc.payee ?? "Business Expense")
					:
					(
						doc.customerId
							? customerById.get(doc.customerId)
							: undefined
					) ??
					"(unknown customer)",
			})),
			...directSalesDocs.map((doc) => ({
				...serializeDoc(doc),
				type: "DIRECT_SALE" as const,
				customerId: null,
				customerName: "Walk-in Sale",
				date:
					date ??
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

		const originalIds = entries
			.map((entry) => entry.id)
			.filter(
				(entryId): entryId is string =>
					typeof entryId === "string" &&
					entryId.length > 0,
			);

		const [tabReversals, saleReversals] =
			originalIds.length > 0
				? await Promise.all([
						shouldLoadTabTransactions
							? TabTransaction.find({
									reversalOfId: {
										$in: originalIds,
									},
							  })
									.select({
										reversalOfId: 1,
									})
									.lean()
							: Promise.resolve([]),
						shouldLoadDirectSales
							? SaleTransaction.find({
									reversalOfId: {
										$in: originalIds,
									},
							  })
									.select({
										reversalOfId: 1,
									})
									.lean()
							: Promise.resolve([]),
				  ])
				: [[], []];

		const reversedIdSet = new Set([
			...tabReversals
				.map((doc) => doc.reversalOfId)
				.filter(Boolean),
			...saleReversals
				.map((doc) => doc.reversalOfId)
				.filter(Boolean),
		]);

		const entriesWithFlags = entries.map((entry) => ({
			...entry,
			isReversal: Boolean(entry.reversalOfId),
			isReversed: reversedIdSet.has(entry.id),
		}));

		return ok(entriesWithFlags);
	} catch {
		return fail("Failed to load transactions", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
