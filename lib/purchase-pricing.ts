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
	discountCents?: number;
}

export function calculatePurchaseTotals(
	items: PurchaseLineInput[],
	additionalDiscountCents: number | undefined,
) {
	const lineSubtotals = items.map((item) => {
		const unitCost =
			typeof item.unitCostCents === "number" &&
			item.unitCostCents > 0
				? item.unitCostCents
				: 0;
		const units = Math.max(0, item.units ?? 0);
		return unitCost * units;
	});
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
			...item,
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
