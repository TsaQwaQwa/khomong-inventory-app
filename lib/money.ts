/**
 * Convert a Rands string (e.g., "123.45") to cents (integer)
 */
export function toCents(
	rands: string | number,
): number {
	if (typeof rands === "number") {
		return Math.round(rands * 100);
	}
	const cleaned = rands.replace(/[^\d.-]/g, "");
	const parsed = parseFloat(cleaned);
	if (isNaN(parsed)) return 0;
	return Math.round(parsed * 100);
}

/**
 * Convert cents (integer) to Rands string (e.g., 12345 -> "123.45")
 */
export function fromCents(cents: number): string {
	return (cents / 100).toFixed(2);
}

/**
 * Format cents as ZAR currency display (e.g., 12345 -> "R 123.45")
 */
export function formatZAR(cents: number | undefined | null): string {
	const safeCents =
		typeof cents === "number" && Number.isFinite(cents)
			? cents
			: 0;
	const rands = safeCents / 100;
	return new Intl.NumberFormat("en-ZA", {
		style: "currency",
		currency: "ZAR",
		minimumFractionDigits: 2,
	}).format(rands);
}
