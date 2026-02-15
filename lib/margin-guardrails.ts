import { Product } from "@/models/Product";
import { SupplierProductPrice } from "@/models/SupplierProductPrice";

interface SaleLineForGuardrail {
	productId: string;
	unitPriceCents: number;
}

export interface BelowCostViolation {
	productId: string;
	productName: string;
	unitPriceCents: number;
	baselineCostCents: number;
}

export async function findBelowCostViolations({
	date,
	lines,
}: {
	date: string;
	lines: SaleLineForGuardrail[];
}): Promise<BelowCostViolation[]> {
	const productIds = Array.from(
		new Set(lines.map((line) => line.productId)),
	);
	if (productIds.length === 0) return [];

	const [products, knownCosts] = await Promise.all([
		Product.find({ _id: { $in: productIds } })
			.select({ _id: 1, name: 1 })
			.lean(),
		SupplierProductPrice.find({
			productId: { $in: productIds },
			effectiveFrom: { $lte: date },
			$or: [
				{ effectiveTo: { $exists: false } },
				{ effectiveTo: null },
				{ effectiveTo: { $gte: date } },
			],
		})
			.select({ productId: 1, unitCostCents: 1 })
			.lean(),
	]);

	const productNameById = new Map(
		products.map((product) => [
			String(product._id),
			product.name,
		]),
	);
	const baselineCostByProductId = new Map<
		string,
		number
	>();
	for (const cost of knownCosts) {
		const existing = baselineCostByProductId.get(
			cost.productId,
		);
		if (
			existing === undefined ||
			cost.unitCostCents < existing
		) {
			baselineCostByProductId.set(
				cost.productId,
				cost.unitCostCents,
			);
		}
	}

	const violations: BelowCostViolation[] = [];
	for (const line of lines) {
		const baselineCost =
			baselineCostByProductId.get(line.productId);
		if (
			baselineCost === undefined ||
			line.unitPriceCents >= baselineCost
		) {
			continue;
		}
		violations.push({
			productId: line.productId,
			productName:
				productNameById.get(line.productId) ??
				"Unknown product",
			unitPriceCents: line.unitPriceCents,
			baselineCostCents: baselineCost,
		});
	}
	return violations;
}
