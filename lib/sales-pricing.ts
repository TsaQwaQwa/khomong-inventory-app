interface SaleLineInput {
	productId: string;
	units: number;
	unitPriceCents: number;
}

export function calculateSaleTotals(
	items: SaleLineInput[],
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

	const normalizedItems = items.map((item, index) => ({
		productId: item.productId,
		units: item.units,
		unitPriceCents: item.unitPriceCents,
		subtotalCents: lineSubtotals[index],
		lineTotalCents: lineSubtotals[index],
	}));

	return {
		items: normalizedItems,
		subtotalCents,
		amountCents: subtotalCents,
	};
}
