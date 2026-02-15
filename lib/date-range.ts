import { addDays } from "@/lib/dates";

export type RangePreset =
	| "day"
	| "week"
	| "month"
	| "year"
	| "custom";

export type PreferredRangePreset = Exclude<
	RangePreset,
	"custom"
>;

export const RANGE_PREFERENCE_KEY =
	"global-date-range-preference:v1";

export const isYmd = (value: string | null) =>
	Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export const isRangePreset = (
	value: string | null,
): value is RangePreset =>
	value === "day" ||
	value === "week" ||
	value === "month" ||
	value === "year" ||
	value === "custom";

export const isPreferredRangePreset = (
	value: string | null,
): value is PreferredRangePreset =>
	value === "day" ||
	value === "week" ||
	value === "month" ||
	value === "year";

export const rangeFromPreset = (
	preset: PreferredRangePreset,
	to: string,
) => {
	if (preset === "day") return { from: to, to };
	if (preset === "week")
		return { from: addDays(to, -6), to };
	if (preset === "year")
		return { from: addDays(to, -364), to };
	return { from: addDays(to, -29), to };
};

const rangeDaysInclusive = (
	from: string,
	to: string,
) => {
	const a = new Date(`${from}T00:00:00.000Z`).getTime();
	const b = new Date(`${to}T00:00:00.000Z`).getTime();
	const diff = Math.floor((b - a) / 86400000);
	return Math.max(1, diff + 1);
};

export const inferRangePreset = (
	from: string,
	to: string,
): RangePreset => {
	if (from === to) return "day";
	const days = rangeDaysInclusive(from, to);
	if (days === 7) return "week";
	if (days === 30) return "month";
	if (days >= 365 && days <= 366) return "year";
	return "custom";
};
