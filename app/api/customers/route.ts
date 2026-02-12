export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { customerCreateSchema } from "@/lib/schemas";
import { Customer } from "@/models/Customer";
import { TabAccount } from "@/models/TabAccount";
import { TabTransaction } from "@/models/TabTransaction";
import { serializeDoc, serializeDocs } from "@/lib/serialize";
import { todayYMD } from "@/lib/dates";

export async function GET() {
	try {
		await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();
	const docs = await Customer.find({
		isActive: true,
	})
		.sort({ name: 1 })
		.lean();

	const customerIds = docs.map((doc) =>
		doc._id ? String(doc._id) : "",
	);

	const accounts = await TabAccount.find({
		customerId: { $in: customerIds },
	}).lean();

	const balanceAgg =
		customerIds.length > 0
			? await TabTransaction.aggregate([
					{
						$match: {
							customerId: { $in: customerIds },
						},
					},
					{
						$group: {
							_id: "$customerId",
							charges: {
								$sum: {
									$cond: [
										{
											$eq: ["$type", "CHARGE"],
										},
										"$amountCents",
										0,
									],
								},
							},
							payments: {
								$sum: {
									$cond: [
										{
											$eq: ["$type", "PAYMENT"],
										},
										"$amountCents",
										0,
									],
								},
							},
							adjustments: {
								$sum: {
									$cond: [
										{
											$eq: ["$type", "ADJUSTMENT"],
										},
										"$amountCents",
										0,
									],
								},
							},
						},
					},
			  ])
			: [];
	const latestChargeAgg =
		customerIds.length > 0
			? await TabTransaction.aggregate([
					{
						$match: {
							customerId: { $in: customerIds },
							type: "CHARGE",
						},
					},
					{ $sort: { createdAt: -1 } },
					{
						$group: {
							_id: "$customerId",
							latestChargeAt: {
								$first: "$createdAt",
							},
						},
					},
			  ])
			: [];

	const accountMap = new Map(
		accounts.map((account) => [
			account.customerId,
			account,
		]),
	);
	const balanceMap = new Map(
		balanceAgg.map((entry) => [
			entry._id,
			{
				charges: entry.charges ?? 0,
				payments: entry.payments ?? 0,
				adjustments: entry.adjustments ?? 0,
			},
		]),
	);
	const latestChargeMap = new Map(
		latestChargeAgg.map((entry) => [
			entry._id,
			entry.latestChargeAt
				? new Date(entry.latestChargeAt)
				: null,
		]),
	);
	const today = todayYMD();

	const payload = docs
		.map((doc) => serializeDoc(doc))
		.filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
		.map((customer) => {
			const id = customer.id ?? "";
			const account = accountMap.get(id);
			const agg = balanceMap.get(id);
			const balance =
				(agg?.charges ?? 0) -
				(agg?.payments ?? 0) +
				(agg?.adjustments ?? 0);
			const latestChargeAt =
				latestChargeMap.get(id) ?? null;
			let dueDate: string | undefined;
			if (
				balance > 0 &&
				account?.dueDays &&
				latestChargeAt
			) {
				const dueAt = new Date(latestChargeAt);
				dueAt.setDate(
					dueAt.getDate() + account.dueDays,
				);
				dueDate = dueAt
					.toISOString()
					.slice(0, 10);
			}

			return {
				...customer,
				creditLimitCents:
					account?.creditLimitCents ?? 0,
				balanceCents: balance,
				dueDays: account?.dueDays,
				tabStatus: account?.status,
				lastChargeAt: latestChargeAt
					? latestChargeAt.toISOString()
					: undefined,
				dueDate,
				isOverdue:
					Boolean(dueDate) &&
					balance > 0 &&
					dueDate! < today,
			};
		});

	return ok(payload);
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
			customerCreateSchema,
		);

		const customer = await Customer.create({
			name: input.name,
			phone: input.phone,
			note: input.note,
			isActive: true,
		});

		await TabAccount.create({
			customerId: String(customer._id),
			creditLimitCents: input.creditLimitCents,
			status: "ACTIVE",
			dueDays: input.dueDays,
		});

		return ok(serializeDoc(customer.toObject()), {
			status: 201,
		});
	} catch (e: any) {
		const msg = String(e?.message ?? e);
		if (msg.startsWith("VALIDATION_ERROR:"))
			return fail(
				msg.replace("VALIDATION_ERROR:", ""),
				{ status: 400, code: "VALIDATION_ERROR" },
			);
		if (msg.includes("E11000"))
			return fail(
				"Customer already exists (phone)",
				{ status: 409, code: "DUPLICATE" },
			);
		return fail("Failed to create customer", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
