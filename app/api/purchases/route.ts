export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { parseJson } from "@/lib/validate";
import { purchaseCreateSchema } from "@/lib/schemas";
import { addDays, todayYMD } from "@/lib/dates";
import { Purchase } from "@/models/Purchase";
import { Supplier } from "@/models/Supplier";
import { serializeDoc, serializeDocs } from "@/lib/serialize";
import { calculatePurchaseTotals } from "@/lib/purchase-pricing";
import { learnSupplierPricesFromPurchase } from "@/lib/supplier-price-learning";
import {
	getScopeIdFromAuth,
	toAuditObject,
	writeAuditLog,
} from "@/lib/audit";

export async function GET(req: Request) {
	const a = await requireOrgAuth().catch(
		() => null,
	);

	const url = new URL(req.url);
	const date =
		url.searchParams.get("date") ?? todayYMD();
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");
	const fieldsParam = (
		url.searchParams.get("fields") ?? ""
	).toLowerCase();
	const fieldsLite = fieldsParam === "lite";
	const lookbackDaysParam =
		url.searchParams.get("lookbackDays");
	const lookbackDays = lookbackDaysParam
		? Math.max(
				0,
				parseInt(lookbackDaysParam, 10) || 0,
			)
		: 0;
	const isYmd = (value: string | null) =>
		Boolean(
			value &&
				/^\d{4}-\d{2}-\d{2}$/.test(value),
		);
	const purchaseDateFilter =
		isYmd(from) && isYmd(to)
			? {
					$gte: from,
					$lte: to,
				}
			: lookbackDays > 0
				? {
						$gte: addDays(date, -lookbackDays),
						$lte: date,
					}
				: date;

	await connectDB();
	const docs = await Purchase.find({
		purchaseDate: purchaseDateFilter,
	})
		.select(
			fieldsLite
				? {
						supplierId: 1,
						purchaseDate: 1,
						items: 1,
				  }
				: {},
		)
		.sort({ createdAt: -1 })
		.lean();

	if (fieldsLite) {
		return ok(serializeDocs(docs));
	}

	const supplierIds = Array.from(
		new Set(
			docs
				.map((doc) => doc.supplierId)
				.filter(
					(id): id is string =>
						typeof id === "string" &&
						id.length > 0,
				),
		),
	);

	const suppliers =
		supplierIds.length > 0
			? await Supplier.find({
					_id: { $in: supplierIds },
				})
					.select({ _id: 1, name: 1 })
					.lean()
			: [];
	const supplierById = new Map(
		suppliers.map((supplier) => [
			String(supplier._id),
			supplier.name,
		]),
	);

	return ok(
		docs.map((doc) => ({
			...serializeDoc(doc),
			supplierName: doc.supplierId
				? supplierById.get(doc.supplierId) ??
					"Unknown Supplier"
				: "Unknown Supplier",
		})),
	);
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
			purchaseCreateSchema,
		);
		const purchaseDate =
			input.purchaseDate ?? todayYMD();
		const purchaseTotals = calculatePurchaseTotals(
			input.items,
		);
		const created = await Purchase.create({
			supplierId: input.supplierId,
			invoiceNo: input.invoiceNo,
			purchaseDate,
			items: purchaseTotals.items,
			subtotalCents: purchaseTotals.subtotalCents,
			totalCostCents: purchaseTotals.totalCostCents,
			attachmentIds: input.attachmentIds ?? [],
			createdByUserId: a.userId!,
		});
		await writeAuditLog({
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
			action: "CREATE",
			entityType: "Purchase",
			entityId: String(created._id),
			oldValues: null,
			newValues: toAuditObject(created.toObject()),
		});
		await learnSupplierPricesFromPurchase({
			purchase: created.toObject(),
			scopeId: getScopeIdFromAuth(a),
			actorUserId: a.userId ?? undefined,
		});
		return ok(serializeDoc(created.toObject()), {
			status: 201,
		});
	} catch (e: any) {
		const msg = String(e?.message ?? e);
		if (msg.startsWith("VALIDATION_ERROR:"))
			return fail(
				msg.replace("VALIDATION_ERROR:", ""),
				{ status: 400, code: "VALIDATION_ERROR" },
			);
		return fail("Failed to create purchase", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
