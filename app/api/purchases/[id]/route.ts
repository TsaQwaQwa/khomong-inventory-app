export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Purchase } from "@/models/Purchase";
import { serializeDoc } from "@/lib/serialize";
import { calculatePurchaseTotals } from "@/lib/purchase-pricing";
import { learnSupplierPricesFromPurchase } from "@/lib/supplier-price-learning";
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
	const payload = await req
		.json()
		.catch(() => null);
	if (
		!payload ||
		(payload.invoiceNo !== undefined &&
			typeof payload.invoiceNo !== "string") ||
		(payload.discountCents !== undefined &&
			typeof payload.discountCents !== "number")
	) {
		return fail("Invalid payload", {
			status: 400,
			code: "INVALID_DATA",
		});
	}

	const invoiceNo =
		payload.invoiceNo &&
		payload.invoiceNo.trim().length
			? payload.invoiceNo.trim()
			: undefined;
	const attachments: string[] = [];
	if (Array.isArray(payload.attachments)) {
		const uploadDir = path.join(
			process.cwd(),
			"public",
			"uploads",
			"purchases",
		);
		fs.mkdirSync(uploadDir, { recursive: true });
		for (const [
			index,
			dataUrl,
		] of payload.attachments.entries()) {
			if (
				typeof dataUrl !== "string" ||
				!dataUrl.includes("base64")
			)
				continue;
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

	await connectDB();
	const updatePayload: Record<string, unknown> =
		{};
	if (invoiceNo !== undefined)
		updatePayload.invoiceNo = invoiceNo;
	const existing = await Purchase.findOne({
		_id: id,
	}).lean();
	if (
		(Array.isArray(payload.items) ||
			payload.discountCents !== undefined) &&
		existing
	) {
		const itemsByProduct = new Map<string, any>(
			Array.isArray(payload.items)
				? payload.items.map((item: any) => [
						item.productId,
						item,
					])
				: [],
		);
		const mergedItems = existing.items.map((item) => {
			const override = itemsByProduct.get(
				item.productId,
			);
			if (!override) return item;
			return {
				...item,
				unitCostCents:
					override.unitCostCents ?? item.unitCostCents,
				discountCents:
					override.discountCents ?? item.discountCents,
			};
		});
		const existingItemDiscountTotal =
			mergedItems.reduce(
				(sum, item) =>
					sum + (item.discountCents ?? 0),
				0,
			);
		const existingAdditionalDiscount = Math.max(
			0,
			(existing.discountCents ?? 0) -
				existingItemDiscountTotal,
		);
		const requestedAdditionalDiscount =
			payload.discountCents !== undefined
				? payload.discountCents
				: existingAdditionalDiscount;
		const totals = calculatePurchaseTotals(
			mergedItems,
			requestedAdditionalDiscount,
		);
		updatePayload.items = totals.items;
		updatePayload.subtotalCents = totals.subtotalCents;
		updatePayload.discountCents = totals.discountCents;
		updatePayload.totalCostCents = totals.totalCostCents;
	}
	if (attachments.length && existing) {
		updatePayload.attachmentIds = [
			...(existing.attachmentIds ?? []),
			...attachments,
		];
	}

	const updated = await Purchase.findOneAndUpdate(
		{ _id: id },
		{ $set: updatePayload },
		{ new: true },
	).lean();
	if (!updated)
		return fail("Purchase not found", {
			status: 404,
			code: "NOT_FOUND",
		});
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
}
