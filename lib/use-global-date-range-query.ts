"use client";

import * as React from "react";
import {
	usePathname,
	useRouter,
	useSearchParams,
} from "next/navigation";
import { getTodayJHB } from "@/lib/date-utils";
import {
	inferRangePreset,
	isPreferredRangePreset,
	isRangePreset,
	isYmd,
	rangeFromPreset,
	RANGE_PREFERENCE_KEY,
	type PreferredRangePreset,
	type RangePreset,
} from "@/lib/date-range";

interface UseGlobalDateRangeOptions {
	syncDateParam?: boolean;
}

export function useGlobalDateRangeQuery(
	options: UseGlobalDateRangeOptions = {},
) {
	const { syncDateParam = true } = options;
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const today = React.useMemo(() => getTodayJHB(), []);

	const [preferredPreset, setPreferredPreset] =
		React.useState<PreferredRangePreset>("month");
	const [preferenceLoaded, setPreferenceLoaded] =
		React.useState(false);

	const fromRaw = searchParams.get("from");
	const toRaw = searchParams.get("to");
	const rangeRaw = searchParams.get("range");
	const fromParam = isYmd(fromRaw) ? fromRaw : null;
	const toParam = isYmd(toRaw) ? toRaw : null;
	const rangeParam = isRangePreset(rangeRaw)
		? rangeRaw
		: null;

	const to = toParam ?? today;
	const from =
		fromParam ??
		rangeFromPreset(preferredPreset, to).from;

	const updateQuery = React.useCallback(
		(
			updates: Record<string, string | null>,
		) => {
			const params = new URLSearchParams(
				searchParams.toString(),
			);
			for (const [key, value] of Object.entries(
				updates,
			)) {
				if (!value) {
					params.delete(key);
				} else {
					params.set(key, value);
				}
			}
			const query = params.toString();
			router.replace(
				query ? `${pathname}?${query}` : pathname,
				{ scroll: false },
			);
		},
		[pathname, router, searchParams],
	);

	React.useEffect(() => {
		try {
			const raw = localStorage.getItem(
				RANGE_PREFERENCE_KEY,
			);
			if (isPreferredRangePreset(raw)) {
				setPreferredPreset(raw);
			}
		} finally {
			setPreferenceLoaded(true);
		}
	}, []);

	const persistPreferredPreset = React.useCallback(
		(next: PreferredRangePreset) => {
			setPreferredPreset(next);
			localStorage.setItem(
				RANGE_PREFERENCE_KEY,
				next,
			);
		},
		[],
	);

	React.useEffect(() => {
		if (!preferenceLoaded) return;
		if (fromParam && toParam) return;
		const baseTo = toParam ?? today;
		const next = rangeFromPreset(
			preferredPreset,
			baseTo,
		);
		updateQuery({
			from: next.from,
			to: next.to,
			range: preferredPreset,
			date: syncDateParam ? next.to : null,
		});
	}, [
		fromParam,
		preferenceLoaded,
		preferredPreset,
		syncDateParam,
		toParam,
		today,
		updateQuery,
	]);

	const preset: RangePreset =
		rangeParam ?? inferRangePreset(from, to);

	const onPresetChange = React.useCallback(
		(value: RangePreset) => {
			if (value === "custom") {
				updateQuery({ range: "custom" });
				return;
			}
			persistPreferredPreset(value);
			const next = rangeFromPreset(value, to);
			updateQuery({
				from: next.from,
				to: next.to,
				range: value,
				date: syncDateParam ? next.to : null,
			});
		},
		[
			persistPreferredPreset,
			syncDateParam,
			to,
			updateQuery,
		],
	);

	const onFromChange = React.useCallback(
		(value: string) => {
			const nextTo = value > to ? value : to;
			updateQuery({
				from: value,
				to: nextTo,
				range: "custom",
				date: syncDateParam ? nextTo : null,
			});
		},
		[syncDateParam, to, updateQuery],
	);

	const onToChange = React.useCallback(
		(value: string) => {
			const nextFrom =
				value < from ? value : from;
			updateQuery({
				from: nextFrom,
				to: value,
				range: "custom",
				date: syncDateParam ? value : null,
			});
		},
		[from, syncDateParam, updateQuery],
	);
	const onRangeChange = React.useCallback(
		(nextFrom: string, nextTo: string) => {
			const start =
				nextFrom <= nextTo ? nextFrom : nextTo;
			const end =
				nextFrom <= nextTo ? nextTo : nextFrom;
			updateQuery({
				from: start,
				to: end,
				range: "custom",
				date: syncDateParam ? end : null,
			});
		},
		[syncDateParam, updateQuery],
	);

	return {
		from,
		to,
		date: to,
		preset,
		onPresetChange,
		onFromChange,
		onToChange,
		onRangeChange,
		updateQuery,
	};
}
