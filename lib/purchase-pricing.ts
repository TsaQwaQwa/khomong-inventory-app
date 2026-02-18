interface PurchaseLineInput {
	productId: string;
	cases?: number;
	singles?: number;
	units: number;
	unitCostCents?: number;
	lineSubtotalCents?: number;
}

export function calculatePurchaseTotals(
	items: PurchaseLineInput[],
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

	const normalizedItems = items.map((item, index) => ({
		productId: item.productId,
		cases: item.cases ?? 0,
		singles: item.singles ?? 0,
		units: lineMeta[index].units,
		unitCostCents:
			lineMeta[index].derivedUnitCostCents > 0
				? lineMeta[index].derivedUnitCostCents
				: undefined,
		lineTotalCostCents: Math.max(0, lineSubtotals[index]),
	}));

	return {
		items: normalizedItems,
		subtotalCents,
		totalCostCents: subtotalCents,
	};
}
