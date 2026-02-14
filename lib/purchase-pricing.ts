import {
	allocateDiscountAcrossLines,
	clampDiscountCents,
} from "@/lib/discount";

interface PurchaseLineInput {
	productId: string;
	cases?: number;
	singles?: number;
	units: number;
	unitCostCents?: number;
	lineSubtotalCents?: number;
	discountCents?: number;
}

export function calculatePurchaseTotals(
	items: PurchaseLineInput[],
	additionalDiscountCents: number | undefined,
) {
	const lineMeta = items.map((item) => {
		const units = Math.max(0, item.units ?? 0);
		const explicitLineSubtotal =
			typeof item.lineSubtotalCents === "number" &&
			item.lineSubtotalCents >= 0
				? item.lineSubtotalCents
				: undefined;
		const explicitUnitCost =
			typeof item.unitCostCents === "number" &&
			item.unitCostCents > 0
				? item.unitCostCents
				: undefined;
		const lineSubtotalCents =
			explicitLineSubtotal ??
			(explicitUnitCost ?? 0) * units;
		const derivedUnitCostCents =
			explicitUnitCost ??
			(units > 0 && lineSubtotalCents > 0
				? Math.round(lineSubtotalCents / units)
				: 0);

		return {
			units,
			lineSubtotalCents,
			derivedUnitCostCents,
		};
	});
	const lineSubtotals = lineMeta.map(
		(item) => item.lineSubtotalCents,
	);
	const subtotalCents = lineSubtotals.reduce(
		(sum, value) => sum + value,
		0,
	);

	const baseLineDiscounts = items.map((item, index) =>
		clampDiscountCents(
			item.discountCents,
			lineSubtotals[index],
		),
	);
	const baseDiscountTotal = baseLineDiscounts.reduce(
		(sum, value) => sum + value,
		0,
	);

	const remainingSubtotals = lineSubtotals.map(
		(value, index) =>
			Math.max(0, value - baseLineDiscounts[index]),
	);
	const additionalDiscount = clampDiscountCents(
		additionalDiscountCents,
		remainingSubtotals.reduce(
			(sum, value) => sum + value,
			0,
		),
	);
	const additionalByLine =
		allocateDiscountAcrossLines(
			remainingSubtotals,
			additionalDiscount,
		);

	const normalizedItems = items.map((item, index) => {
		const lineDiscountCents =
			baseLineDiscounts[index] +
			additionalByLine[index];
		return {
			productId: item.productId,
			cases: item.cases ?? 0,
			singles: item.singles ?? 0,
			units: lineMeta[index].units,
			unitCostCents:
				lineMeta[index].derivedUnitCostCents > 0
					? lineMeta[index].derivedUnitCostCents
					: undefined,
			discountCents:
				lineDiscountCents > 0
					? lineDiscountCents
					: undefined,
			lineTotalCostCents: Math.max(
				0,
				lineSubtotals[index] - lineDiscountCents,
			),
		};
	});

	const discountCents =
		baseDiscountTotal + additionalDiscount;
	const totalCostCents = Math.max(
		0,
		subtotalCents - discountCents,
	);

	return {
		items: normalizedItems,
		subtotalCents,
		discountCents,
		totalCostCents,
	};
}
