export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import {
	requireOrgAuth,
	requireAdminEmail,
} from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Purchase } from "@/models/Purchase";
import { serializeDoc } from "@/lib/serialize";
import { calculatePurchaseTotals } from "@/lib/purchase-pricing";
import { learnSupplierPricesFromPurchase } from "@/lib/supplier-price-learning";
import { parseJson } from "@/lib/validate";
import { purchaseUpdateSchema } from "@/lib/schemas";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

export async function PATCH(
	req: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	const a = await requireOrgAuth().catch(
		() => null,
	);
	if (!a)
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});

	const { id } = await ctx.params;

	try {
		const payload = await parseJson(
			req,
			purchaseUpdateSchema,
		);
		await connectDB();
		const existing = await Purchase.findOne({
			_id: id,
		}).lean();
		if (!existing)
			return fail("Purchase not found", {
				status: 404,
				code: "NOT_FOUND",
			});

		const updatePayload: Record<string, unknown> =
			{};
		if (payload.supplierId !== undefined) {
			const supplierId = payload.supplierId.trim();
			updatePayload.supplierId =
				supplierId.length > 0
					? supplierId
					: undefined;
		}
		if (payload.invoiceNo !== undefined) {
			const invoiceNo = payload.invoiceNo.trim();
			updatePayload.invoiceNo =
				invoiceNo.length > 0
					? invoiceNo
					: undefined;
		}
		if (payload.purchaseDate !== undefined) {
			updatePayload.purchaseDate = payload.purchaseDate;
		}

		if (payload.items !== undefined && existing) {
			const nextItems =
				payload.items ?? existing.items;
			const totals = calculatePurchaseTotals(
				nextItems,
			);
			updatePayload.items = totals.items;
			updatePayload.subtotalCents =
				totals.subtotalCents;
			updatePayload.totalCostCents =
				totals.totalCostCents;
		}

		const attachments: string[] = [];
		if (Array.isArray(payload.attachments)) {
			const uploadDir = path.join(
				process.cwd(),
				"public",
				"uploads",
				"purchases",
			);
			fs.mkdirSync(uploadDir, {
				recursive: true,
			});
			for (const [
				index,
				dataUrl,
			] of payload.attachments.entries()) {
				if (!dataUrl.includes("base64")) continue;
				const matches = dataUrl.match(
					/^data:(image\/[^;]+);base64,(.+)$/,
				);
				if (!matches) continue;
				const [, mime, base64] = matches;
				const ext = mime.split("/")[1] ?? "bin";
				const filename = `${Date.now()}-${randomUUID()}-${index}.${ext}`;
				const filePath = path.join(
					uploadDir,
					filename,
				);
				fs.writeFileSync(
					filePath,
					Buffer.from(base64, "base64"),
				);
				attachments.push(
					`uploads/purchases/${filename}`,
				);
			}
		}
		if (attachments.length) {
			updatePayload.attachmentIds = [
				...(existing.attachmentIds ?? []),
				...attachments,
			];
		}

		const updated = await Purchase.findOneAndUpdate(
			{ _id: id },
			{
				$set: updatePayload,
				$unset: { discountCents: 1 },
			},
			{ new: true },
		).lean();
		if (!updated) {
			return fail("Purchase not found", {
				status: 404,
				code: "NOT_FOUND",
			});
		}
		if (existing) {
			await writeAuditLog({
				scopeId: getScopeIdFromAuth(a),
				actorUserId: a.userId ?? undefined,
				action: "UPDATE",
				entityType: "Purchase",
				entityId: id,
				oldValues: toAuditObject(existing),
				newValues: toAuditObject(updated),
			});
		}
		await learnSupplierPricesFromPurchase({
			purchase: updated,
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
		});

		return ok(serializeDoc(updated));
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
		return fail("Failed to update purchase", {
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

	const existing = await Purchase.findOne({
		_id: id,
	}).lean();
	if (!existing) {
		return fail("Purchase not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	}

	await Purchase.deleteOne({ _id: id });
	await writeAuditLog({
		scopeId: getScopeIdFromAuth(a),
		actorUserId: a.userId ?? undefined,
		action: "DELETE",
		entityType: "Purchase",
		entityId: id,
		oldValues: toAuditObject(existing),
		newValues: null,
	});

	return ok({ id });
}
