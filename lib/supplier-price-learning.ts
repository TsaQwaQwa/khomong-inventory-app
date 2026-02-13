import { addDays } from "@/lib/dates";
import { writeAuditLog, toAuditObject } from "@/lib/audit";
import { SupplierProductPrice } from "@/models/SupplierProductPrice";

interface PurchaseLike {
	_id?: unknown;
	supplierId?: string;
	invoiceNo?: string;
	purchaseDate: string;
	items?: {
		productId?: string;
		unitCostCents?: number;
	}[];
}

interface LearnSupplierPricesArgs {
	purchase: PurchaseLike;
	scopeId: string;
	actorUserId?: string;
}

function toEntityId(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	return String(value);
}

function buildAutoNote(purchase: PurchaseLike): string {
	if (purchase.invoiceNo && purchase.invoiceNo.trim().length > 0) {
		return `Auto from purchase invoice ${purchase.invoiceNo.trim()}`;
	}
	const purchaseId = toEntityId(purchase._id);
	if (purchaseId) return `Auto from purchase ${purchaseId}`;
	return "Auto from purchase";
}

export async function learnSupplierPricesFromPurchase({
	purchase,
	scopeId,
	actorUserId,
}: LearnSupplierPricesArgs) {
	if (!purchase.supplierId) return;

	const changedByUserId = actorUserId ?? "system";
	const learnedCosts = new Map<string, number>();
	for (const item of purchase.items ?? []) {
		if (!item.productId) continue;
		if (
			typeof item.unitCostCents !== "number" ||
			item.unitCostCents <= 0
		) {
			continue;
		}
		learnedCosts.set(item.productId, item.unitCostCents);
	}

	for (const [productId, unitCostCents] of learnedCosts.entries()) {
		const openPrice = await SupplierProductPrice.findOne({
			supplierId: purchase.supplierId,
			productId,
			$or: [
				{ effectiveTo: { $exists: false } },
				{ effectiveTo: null },
			],
		})
			.sort({
				effectiveFrom: -1,
				createdAt: -1,
			})
			.lean();

		if (!openPrice) {
			const created = await SupplierProductPrice.create({
				supplierId: purchase.supplierId,
				productId,
				unitCostCents,
				effectiveFrom: purchase.purchaseDate,
				note: buildAutoNote(purchase),
				changedByUserId,
			});
			await writeAuditLog({
				scopeId,
				actorUserId,
				action: "AUTO_SET_SUPPLIER_PRICE_FROM_PURCHASE",
				entityType: "SupplierProductPrice",
				entityId: String(created._id),
				oldValues: null,
				newValues: toAuditObject(created.toObject()),
				meta: {
					source: "PURCHASE",
					purchaseId: toEntityId(purchase._id),
					supplierId: purchase.supplierId,
					productId,
				},
			});
			continue;
		}

		if (openPrice.unitCostCents === unitCostCents) continue;
		if (purchase.purchaseDate < openPrice.effectiveFrom) continue;

		if (purchase.purchaseDate === openPrice.effectiveFrom) {
			const updated = await SupplierProductPrice.findOneAndUpdate(
				{ _id: openPrice._id },
				{
					$set: {
						unitCostCents,
						note: buildAutoNote(purchase),
						changedByUserId,
					},
				},
				{ new: true },
			).lean();
			if (updated) {
				await writeAuditLog({
					scopeId,
					actorUserId,
					action: "AUTO_SET_SUPPLIER_PRICE_FROM_PURCHASE",
					entityType: "SupplierProductPrice",
					entityId: String(updated._id),
					oldValues: toAuditObject(openPrice),
					newValues: toAuditObject(updated),
					meta: {
						source: "PURCHASE",
						purchaseId: toEntityId(purchase._id),
						supplierId: purchase.supplierId,
						productId,
					},
				});
			}
			continue;
		}

		await SupplierProductPrice.updateOne(
			{ _id: openPrice._id },
			{
				$set: {
					effectiveTo: addDays(purchase.purchaseDate, -1),
				},
			},
		);

		const created = await SupplierProductPrice.create({
			supplierId: purchase.supplierId,
			productId,
			unitCostCents,
			effectiveFrom: purchase.purchaseDate,
			note: buildAutoNote(purchase),
			changedByUserId,
		});
		await writeAuditLog({
			scopeId,
			actorUserId,
			action: "AUTO_SET_SUPPLIER_PRICE_FROM_PURCHASE",
			entityType: "SupplierProductPrice",
			entityId: String(created._id),
			oldValues: toAuditObject(openPrice),
			newValues: toAuditObject(created.toObject()),
			meta: {
				source: "PURCHASE",
				purchaseId: toEntityId(purchase._id),
				supplierId: purchase.supplierId,
				productId,
			},
		});
	}
}

