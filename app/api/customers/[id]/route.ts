export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { customerUpdateSchema } from "@/lib/schemas";
import { Customer } from "@/models/Customer";
import { TabAccount } from "@/models/TabAccount";
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
