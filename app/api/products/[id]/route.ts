export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import {
	requireOrgAuth,
	requireAdminEmail,
} from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Adjustment } from "@/models/Adjustment";
import { TabTransaction } from "@/models/TabTransaction";
import { SaleTransaction } from "@/models/SaleTransaction";
import { serializeDoc } from "@/lib/serialize";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

export async function GET(
	_: Request,
	ctx: { params: Promise<{ id: string }> },
) {
	const a = await requireOrgAuth().catch(
		() => null,
	);

	const { id } = await ctx.params;

	await connectDB();
	const doc = await Product.findOne({
		_id: id,
	}).lean();
	if (!doc)
		return fail("Not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	return ok(serializeDoc(doc));
}

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
	const patch = await req
		.json()
		.catch(() => null);
	if (!patch)
		return fail("Invalid JSON", {
			status: 400,
			code: "INVALID_JSON",
		});

	await connectDB();
	const existing = await Product.findOne({
		_id: id,
	}).lean();
	if (!existing)
		return fail("Not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	const updated = await Product.findOneAndUpdate(
		{ _id: id },
		{ $set: patch },
		{ new: true },
	).lean();
	if (!updated)
		return fail("Not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	await writeAuditLog({
		scopeId: getScopeIdFromAuth(a),
		actorUserId: a.userId ?? undefined,
		action: "UPDATE",
		entityType: "Product",
		entityId: id,
		oldValues: toAuditObject(existing),
		newValues: toAuditObject(updated),
	});
	return ok(serializeDoc(updated));
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
	const existing = await Product.findOne({
		_id: id,
	}).lean();
	if (!existing) {
		return fail("Not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	}
	const [
		purchasedTotals,
		adjustmentTotals,
		tabSoldTotals,
		directSoldTotals,
	] = await Promise.all([
		Purchase.aggregate<{ units: number }>([
			{ $unwind: "$items" },
			{ $match: { "items.productId": id } },
			{
				$group: {
					_id: null,
					units: {
						$sum: {
							$ifNull: ["$items.units", 0],
						},
					},
				},
			},
		]),
		Adjustment.aggregate<{ units: number }>([
			{ $unwind: "$items" },
			{ $match: { "items.productId": id } },
			{
				$group: {
					_id: null,
					units: {
						$sum: {
							$ifNull: ["$items.unitsDelta", 0],
						},
					},
				},
			},
		]),
		TabTransaction.aggregate<{ units: number }>([
			{ $match: { type: "CHARGE" } },
			{ $unwind: "$items" },
			{ $match: { "items.productId": id } },
			{
				$group: {
					_id: null,
					units: {
						$sum: {
							$ifNull: ["$items.units", 0],
						},
					},
				},
			},
		]),
		SaleTransaction.aggregate<{ units: number }>([
			{ $unwind: "$items" },
			{ $match: { "items.productId": id } },
			{
				$group: {
					_id: null,
					units: {
						$sum: {
							$ifNull: ["$items.units", 0],
						},
					},
				},
			},
		]),
	]);
	const purchased = purchasedTotals[0]?.units ?? 0;
	const adjusted = adjustmentTotals[0]?.units ?? 0;
	const sold =
		(tabSoldTotals[0]?.units ?? 0) +
		(directSoldTotals[0]?.units ?? 0);
	const currentUnits = purchased + adjusted - sold;
	if (currentUnits > 0) {
		return fail(
			"Cannot delete product while stock is still available.",
			{
				status: 400,
				code: "PRODUCT_HAS_STOCK",
			},
		);
	}

	const updated = await Product.findOneAndUpdate(
		{ _id: id },
		{ $set: { isActive: false } },
		{ new: true },
	).lean();
	if (!updated) {
		return fail("Not found", {
			status: 404,
			code: "NOT_FOUND",
		});
	}

	await writeAuditLog({
		scopeId: getScopeIdFromAuth(a),
		actorUserId: a.userId ?? undefined,
		action: "DELETE",
		entityType: "Product",
		entityId: id,
		oldValues: toAuditObject(existing),
		newValues: toAuditObject(updated),
	});

	return ok(serializeDoc(updated));
}
