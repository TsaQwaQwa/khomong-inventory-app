/**
 * Get today's date in Africa/Johannesburg timezone as YYYY-MM-DD
 */
export function getTodayJHB(): string {
	return new Date().toLocaleDateString("en-CA", {
		timeZone: "Africa/Johannesburg",
	});
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateYMD(
	date: Date,
): string {
	return date.toLocaleDateString("en-CA");
}

/**
 * Parse a YYYY-MM-DD string to a Date object
 */
export function parseDateYMD(
	dateStr: string,
): Date {
	const [year, month, day] = dateStr
		.split("-")
		.map(Number);
	return new Date(year, month - 1, day);
}

/**
 * Format a date for display (e.g., "2 Feb 2026")
 */
export function formatDateDisplay(
	dateStr: string,
): string {
	const date = parseDateYMD(dateStr);
	return date.toLocaleDateString("en-ZA", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}
