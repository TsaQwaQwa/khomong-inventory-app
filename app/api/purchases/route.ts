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

export async function GET(req: Request) {
	const a = await requireOrgAuth().catch(
		() => null,
	);

	const url = new URL(req.url);
	const date =
		url.searchParams.get("date") ?? todayYMD();
	const lookbackDaysParam =
		url.searchParams.get("lookbackDays");
	const lookbackDays = lookbackDaysParam
		? Math.max(
				0,
				parseInt(lookbackDaysParam, 10) || 0,
			)
		: 0;
	const purchaseDateFilter =
		lookbackDays > 0
			? {
					$gte: addDays(date, -lookbackDays),
					$lte: date,
				}
			: date;

	await connectDB();
	const docs = await Purchase.find({
		purchaseDate: purchaseDateFilter,
	})
		.sort({ createdAt: -1 })
		.lean();

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
		const created = await Purchase.create({
			supplierId: input.supplierId,
			invoiceNo: input.invoiceNo,
			purchaseDate,
			items: input.items,
			attachmentIds: input.attachmentIds ?? [],
			createdByUserId: a.userId!,
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
