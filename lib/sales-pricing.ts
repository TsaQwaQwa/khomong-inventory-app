import {
	allocateDiscountAcrossLines,
	clampDiscountCents,
} from "@/lib/discount";

interface SaleLineInput {
	productId: string;
	units: number;
	unitPriceCents: number;
	discountCents?: number;
}

export function calculateSaleTotals(
	items: SaleLineInput[],
	additionalDiscountCents: number | undefined,
) {
	const lineSubtotals = items.map(
		(item) =>
			Math.max(0, item.unitPriceCents) *
			Math.max(0, item.units),
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

	const remainingByLine = lineSubtotals.map(
		(value, index) =>
			Math.max(0, value - baseLineDiscounts[index]),
	);
	const additionalDiscount = clampDiscountCents(
		additionalDiscountCents,
		remainingByLine.reduce(
			(sum, value) => sum + value,
			0,
		),
	);
	const additionalByLine =
		allocateDiscountAcrossLines(
			remainingByLine,
			additionalDiscount,
		);

	const normalizedItems = items.map((item, index) => {
		const lineDiscountCents =
			baseLineDiscounts[index] +
			additionalByLine[index];
		return {
			productId: item.productId,
			units: item.units,
			unitPriceCents: item.unitPriceCents,
			subtotalCents: lineSubtotals[index],
			discountCents:
				lineDiscountCents > 0
					? lineDiscountCents
					: undefined,
			lineTotalCents: Math.max(
				0,
				lineSubtotals[index] - lineDiscountCents,
			),
		};
	});

	const discountCents =
		baseDiscountTotal + additionalDiscount;
	const amountCents = Math.max(
		0,
		subtotalCents - discountCents,
	);

	return {
		items: normalizedItems,
		subtotalCents,
		discountCents,
		amountCents,
	};
}
