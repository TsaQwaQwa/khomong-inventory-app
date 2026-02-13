export function clampDiscountCents(
	requestedDiscountCents: number | undefined,
	subtotalCents: number,
) {
	if (!requestedDiscountCents) return 0;
	const normalized = Math.max(
		0,
		Math.floor(requestedDiscountCents),
	);
	return Math.min(normalized, subtotalCents);
}

export function allocateDiscountAcrossLines(
	lineSubtotalsCents: number[],
	discountCents: number,
) {
	if (discountCents <= 0 || lineSubtotalsCents.length === 0) {
		return lineSubtotalsCents.map(() => 0);
	}

	const total = lineSubtotalsCents.reduce(
		(sum, value) => sum + Math.max(0, value),
		0,
	);
	if (total <= 0) return lineSubtotalsCents.map(() => 0);

	const baseShares = lineSubtotalsCents.map((value) =>
		Math.floor((Math.max(0, value) * discountCents) / total),
	);
	let allocated = baseShares.reduce(
		(sum, value) => sum + value,
		0,
	);
	let remainder = discountCents - allocated;
	if (remainder <= 0) return baseShares;

	const byWeightDesc = lineSubtotalsCents
		.map((value, index) => ({
			index,
			value: Math.max(0, value),
		}))
		.filter((row) => row.value > 0)
		.sort((a, b) => b.value - a.value);

	let cursor = 0;
	while (remainder > 0 && byWeightDesc.length > 0) {
		const target = byWeightDesc[cursor % byWeightDesc.length];
		baseShares[target.index] += 1;
		allocated += 1;
		remainder = discountCents - allocated;
		cursor += 1;
	}

	return baseShares;
}
