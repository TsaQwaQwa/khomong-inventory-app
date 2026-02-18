export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import {
	requireOrgAuth,
	requireAdminEmail,
} from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { customerUpdateSchema } from "@/lib/schemas";
import { Customer } from "@/models/Customer";
import { TabAccount } from "@/models/TabAccount";
import { TabTransaction } from "@/models/TabTransaction";
import { serializeDoc } from "@/lib/serialize";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

export async function PATCH(
	req: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	let a;
	try {
		a = await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	const { id } = await ctx.params;
	await connectDB();

	try {
		const input = await parseJson(
			req,
			customerUpdateSchema,
		);

		const customerPatch: Record<
			string,
			unknown
		> = {};
		if (input.name !== undefined)
			customerPatch.name = input.name;
		if (input.phone !== undefined)
			customerPatch.phone = input.phone;
		if (input.note !== undefined)
			customerPatch.note = input.note;
		if (input.customerMode !== undefined)
			customerPatch.customerMode = input.customerMode;
		if (input.isTemporaryTab !== undefined)
			customerPatch.isTemporaryTab = input.isTemporaryTab;

		const accountPatch: Record<
			string,
			unknown
		> = {};
		if (input.creditLimitCents !== undefined) {
			accountPatch.creditLimitCents =
				input.creditLimitCents;
		}
		if (input.dueDays !== undefined) {
			accountPatch.dueDays = input.dueDays;
		}

		const customer = await Customer.findOne({
			_id: id,
			isActive: true,
		}).lean();
		const accountBefore = await TabAccount.findOne({
			customerId: id,
		}).lean();
		if (!customer)
			return fail("Customer not found", {
				status: 404,
				code: "NOT_FOUND",
			});

		const updates: Promise<unknown>[] = [];
		if (Object.keys(customerPatch).length > 0) {
			updates.push(
				Customer.updateOne(
					{ _id: id },
					{ $set: customerPatch },
				),
			);
		}
		if (Object.keys(accountPatch).length > 0) {
			updates.push(
				TabAccount.updateOne(
					{ customerId: id },
					{ $set: accountPatch },
				),
			);
		}
		if (updates.length > 0) {
			await Promise.all(updates);
		}

		const [updatedCustomer, updatedAccount] =
			await Promise.all([
				Customer.findOne({ _id: id }).lean(),
				TabAccount.findOne({
					customerId: id,
				}).lean(),
			]);

		if (!updatedCustomer)
			return fail("Customer not found", {
				status: 404,
				code: "NOT_FOUND",
			});
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "UPDATE",
			entityType: "Customer",
			entityId: id,
			oldValues: toAuditObject({
				customer,
				tabAccount: accountBefore,
			}),
			newValues: toAuditObject({
				customer: updatedCustomer,
				tabAccount: updatedAccount,
			}),
		});

		return ok({
			...serializeDoc(updatedCustomer),
			creditLimitCents:
				updatedAccount?.creditLimitCents ?? 0,
			dueDays: updatedAccount?.dueDays,
			tabStatus: updatedAccount?.status,
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
		if (msg.includes("E11000")) {
			return fail(
				"Customer already exists (phone)",
				{ status: 409, code: "DUPLICATE" },
			);
		}
		return fail("Failed to update customer", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}

export async function DELETE(
	_: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	let a;
	try {
		a = await requireAdminEmail();
	} catch (error) {
		const message = String(
			(error as Error)?.message ?? "",
		);
		if (message === "FORBIDDEN_ADMIN") {
			return fail("Admin access required", {
				status: 403,
				code: "FORBIDDEN",
			});
		}
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	const { id } = await ctx.params;
	await connectDB();

	const [customer, accountBefore] = await Promise.all([
		Customer.findOne({
			_id: id,
			isActive: true,
		}).lean(),
		TabAccount.findOne({ customerId: id }).lean(),
	]);
	if (!customer) {
		return fail("Customer not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	}
	const [balance] = await TabTransaction.aggregate<{
		_id: string;
		charges: number;
		payments: number;
		adjustments: number;
	}>([
		{
			$match: {
				customerId: id,
			},
		},
		{
			$group: {
				_id: "$customerId",
				charges: {
					$sum: {
						$cond: [
							{ $eq: ["$type", "CHARGE"] },
							"$amountCents",
							0,
						],
					},
				},
				payments: {
					$sum: {
						$cond: [
							{ $eq: ["$type", "PAYMENT"] },
							"$amountCents",
							0,
						],
					},
				},
				adjustments: {
					$sum: {
						$cond: [
							{
								$eq: [
									"$type",
									"ADJUSTMENT",
								],
							},
							"$amountCents",
							0,
						],
					},
				},
			},
		},
	]);
	const balanceCents =
		(balance?.charges ?? 0) -
		(balance?.payments ?? 0) +
		(balance?.adjustments ?? 0);
	if (balanceCents > 0) {
		return fail(
			"Cannot delete customer with outstanding balance.",
			{
				status: 400,
				code: "OUTSTANDING_BALANCE",
			},
		);
	}

	await Promise.all([
		Customer.updateOne(
			{ _id: id },
			{ $set: { isActive: false } },
		),
		TabAccount.updateOne(
			{ customerId: id },
			{ $set: { status: "BLOCKED" } },
		),
	]);

	const [updatedCustomer, updatedAccount] =
		await Promise.all([
			Customer.findOne({ _id: id }).lean(),
			TabAccount.findOne({ customerId: id }).lean(),
		]);

	await writeAuditLog({
		scopeId: getScopeIdFromAuth(a),
		actorUserId: a.userId ?? undefined,
		action: "DELETE",
		entityType: "Customer",
		entityId: id,
		oldValues: toAuditObject({
			customer,
			tabAccount: accountBefore,
		}),
		newValues: toAuditObject({
			customer: updatedCustomer,
			tabAccount: updatedAccount,
		}),
	});

	return ok({ id });
}
