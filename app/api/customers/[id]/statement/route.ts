export const runtime = "nodejs";

import { requireOrgAuth } from "@/lib/authz";
import { connectDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { addDays, todayYMD } from "@/lib/dates";
import { Customer } from "@/models/Customer";
import { BusinessDay } from "@/models/BusinessDay";
import { TabTransaction } from "@/models/TabTransaction";

const isYmd = (value: string | null) =>
	Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export async function GET(
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

	const { id } = await ctx.params;
	const url = new URL(req.url);
	const to = isYmd(url.searchParams.get("to"))
		? (url.searchParams.get("to") as string)
		: todayYMD();
	const from = isYmd(url.searchParams.get("from"))
		? (url.searchParams.get("from") as string)
		: addDays(to, -29);

	await connectDB();

	const customer = await Customer.findOne({
		_id: id,
	})
		.select({ _id: 1, name: 1, phone: 1 })
		.lean();
	if (!customer) {
		return fail("Customer not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	}

	const days = await BusinessDay.find({
		date: { $gte: from, $lte: to },
	})
		.select({ _id: 1, date: 1 })
		.lean();
	const dayById = new Map(
		days.map((day) => [String(day._id), day.date]),
	);
	const dayIds = Array.from(dayById.keys());

	const rows =
		dayIds.length === 0
			? []
			: await TabTransaction.find({
					customerId: id,
					businessDayId: { $in: dayIds },
			  })
					.sort({ createdAt: 1 })
					.select({
						type: 1,
						amountCents: 1,
						paymentMethod: 1,
						reference: 1,
						note: 1,
						createdAt: 1,
						businessDayId: 1,
					})
					.lean();

	const ledger = rows.map((row) => {
		const isPayment = row.type === "PAYMENT";
		const signedAmountCents = isPayment
			? -Math.abs(row.amountCents ?? 0)
			: row.amountCents ?? 0;
		return {
			id: String(row._id),
			date:
				dayById.get(row.businessDayId) ?? null,
			type: row.type,
			amountCents: row.amountCents ?? 0,
			signedAmountCents,
			paymentMethod: row.paymentMethod ?? null,
			reference: row.reference ?? null,
			note: row.note ?? null,
			createdAt: row.createdAt
				? new Date(row.createdAt).toISOString()
				: null,
		};
	});

	const totals = ledger.reduce(
		(acc, row) => {
			if (row.type === "CHARGE") {
				acc.chargesCents += row.amountCents;
			} else if (row.type === "PAYMENT") {
				acc.paymentsCents += row.amountCents;
			} else if (row.type === "ADJUSTMENT") {
				acc.adjustmentsCents += row.amountCents;
			}
			return acc;
		},
		{
			chargesCents: 0,
			paymentsCents: 0,
			adjustmentsCents: 0,
		},
	);
	const balanceCents =
		totals.chargesCents -
		totals.paymentsCents +
		totals.adjustmentsCents;

	const reminderText = [
		`Hi ${customer.name},`,
		`Your account statement (${from} to ${to}) is ready.`,
		`Charges: R${(totals.chargesCents / 100).toFixed(2)}`,
		`Payments: R${(totals.paymentsCents / 100).toFixed(2)}`,
		`Balance due: R${(balanceCents / 100).toFixed(2)}`,
		"Please settle your balance at your earliest convenience.",
	]
		.filter(Boolean)
		.join("\n");

	return ok({
		customer: {
			id: String(customer._id),
			name: customer.name,
			phone: customer.phone ?? null,
		},
		range: { from, to },
		summary: {
			chargesCents: totals.chargesCents,
			paymentsCents: totals.paymentsCents,
			adjustmentsCents: totals.adjustmentsCents,
			balanceCents,
		},
		ledger,
		reminderText,
	});
}
