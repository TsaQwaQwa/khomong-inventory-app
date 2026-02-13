export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { transactionReverseSchema } from "@/lib/schemas";
import { TabTransaction } from "@/models/TabTransaction";
import { SaleTransaction } from "@/models/SaleTransaction";
import { serializeDoc } from "@/lib/serialize";

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
			transactionReverseSchema,
		);

		if (input.type === "DIRECT_SALE") {
			const original =
				await SaleTransaction.findById(
					input.transactionId,
				);
			if (!original) {
				return fail("Transaction not found", {
					status: 404,
					code: "NOT_FOUND",
				});
			}
			if (original.reversalOfId) {
				return fail(
					"Cannot reverse a reversal transaction",
					{
						status: 400,
						code: "INVALID_STATE",
					},
				);
			}

			const existingReversal =
				await SaleTransaction.findOne({
					reversalOfId: input.transactionId,
				}).lean();
			if (existingReversal) {
				return fail("Transaction already reversed", {
					status: 409,
					code: "ALREADY_REVERSED",
				});
			}

			const reversedItems = (
				original.items ?? []
			).map((item) => ({
				productId: item.productId,
				units: -(item.units ?? 0),
				unitPriceCents: item.unitPriceCents ?? 0,
				subtotalCents:
					-(item.subtotalCents ?? 0),
				discountCents:
					-(item.discountCents ?? 0),
				lineTotalCents:
					-(item.lineTotalCents ?? 0),
			}));

			const created =
				await SaleTransaction.create({
					businessDayId: original.businessDayId,
					paymentMethod: original.paymentMethod,
					subtotalCents:
						-(original.subtotalCents ?? 0),
					discountCents:
						-(original.discountCents ?? 0),
					amountCents: -(original.amountCents ?? 0),
					items: reversedItems,
					note: `REVERSAL_OF:${input.transactionId} | ${input.reason}`,
					reversalOfId: input.transactionId,
					reversalReason: input.reason,
					createdByUserId: a.userId!,
				});

			return ok(serializeDoc(created.toObject()), {
				status: 201,
			});
		}

		const original = await TabTransaction.findById(
			input.transactionId,
		);
		if (!original) {
			return fail("Transaction not found", {
				status: 404,
				code: "NOT_FOUND",
			});
		}

		if (original.type !== input.type) {
			return fail("Transaction type mismatch", {
				status: 400,
				code: "TYPE_MISMATCH",
			});
		}

		if (original.reversalOfId) {
			return fail(
				"Cannot reverse a reversal transaction",
				{
					status: 400,
					code: "INVALID_STATE",
				},
			);
		}

		const existingReversal =
			await TabTransaction.findOne({
				reversalOfId: input.transactionId,
			}).lean();
		if (existingReversal) {
			return fail("Transaction already reversed", {
				status: 409,
				code: "ALREADY_REVERSED",
			});
		}

		const reversedItems = (original.items ?? []).map(
			(item) => ({
				productId: item.productId,
				units: -(item.units ?? 0),
				unitPriceCents: item.unitPriceCents ?? 0,
				subtotalCents:
					-(item.subtotalCents ?? 0),
				discountCents:
					-(item.discountCents ?? 0),
				lineTotalCents: -(item.lineTotalCents ?? 0),
			}),
		);

		const created = await TabTransaction.create({
			customerId: original.customerId,
			businessDayId: original.businessDayId,
			type: original.type,
			subtotalCents: -(original.subtotalCents ?? 0),
			discountCents: -(original.discountCents ?? 0),
			amountCents: -(original.amountCents ?? 0),
			paymentMethod: original.paymentMethod,
			reference: original.reference,
			items:
				original.type === "CHARGE"
					? reversedItems
					: undefined,
			note: `REVERSAL_OF:${input.transactionId} | ${input.reason}`,
			reversalOfId: input.transactionId,
			reversalReason: input.reason,
			createdByUserId: a.userId!,
		});

		return ok(serializeDoc(created.toObject()), {
			status: 201,
		});
	} catch (e: any) {
		const msg = String(e?.message ?? e);
		if (msg.startsWith("VALIDATION_ERROR:")) {
			return fail(
				msg.replace("VALIDATION_ERROR:", ""),
				{
					status: 400,
					code: "VALIDATION_ERROR",
				},
			);
		}
		return fail("Failed to reverse transaction", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
