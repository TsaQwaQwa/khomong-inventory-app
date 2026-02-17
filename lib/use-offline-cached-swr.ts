"use client";

import * as React from "react";
import useSWR, { type KeyedMutator } from "swr";
import {
	readOfflineResource,
	writeOfflineResource,
} from "@/lib/offline-resource-cache";

interface UseOfflineCachedSwrOptions<T> {
	key: string | null;
	cacheKey?: string;
	fetcher: (url: string) => Promise<T>;
	maxAgeMs?: number;
	isCachedDataUsable?: (data: T) => boolean;
	onError?: (error: Error) => void;
}

interface UseOfflineCachedSwrResult<T> {
	data: T | undefined;
	liveData: T | undefined;
	cachedData: T | null;
	error: Error | undefined;
	isLoading: boolean;
	usingCachedData: boolean;
	mutate: KeyedMutator<T>;
}

interface UseOfflineCachedArraySwrOptions<T>
	extends Omit<
		UseOfflineCachedSwrOptions<T[]>,
		"isCachedDataUsable"
	> {
	requireNonEmptyCache?: boolean;
}

interface UseOfflineCachedArraySwrResult<T>
	extends UseOfflineCachedSwrResult<T[]> {
	items: T[];
}

const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

export function useOfflineCachedSWR<T>(
	options: UseOfflineCachedSwrOptions<T>,
): UseOfflineCachedSwrResult<T> {
	const {
		key,
		cacheKey,
		fetcher,
		maxAgeMs = DEFAULT_MAX_AGE_MS,
		isCachedDataUsable = (data) => data !== null && data !== undefined,
		onError,
	} = options;

	const resolvedCacheKey = cacheKey ?? (key ? `swr:${key}` : null);
	const [cachedData, setCachedData] = React.useState<T | null>(null);
	const [usingCachedData, setUsingCachedData] =
		React.useState(false);

	const {
		data: liveData,
		error: swrError,
		isLoading: swrLoading,
		mutate,
	} = useSWR<T>(
		key,
		key
			? async (url: string) => {
					const data = await fetcher(url);
					if (resolvedCacheKey) {
						void writeOfflineResource(
							resolvedCacheKey,
							data,
						);
					}
					return data;
				}
			: null,
		{
			onError: (error) => {
				const offline =
					typeof window !== "undefined" &&
					!navigator.onLine;
				if (
					offline &&
					cachedData !== null &&
					isCachedDataUsable(cachedData)
				) {
					setUsingCachedData(true);
					return;
				}
				onError?.(error as Error);
			},
		},
	);

	React.useEffect(() => {
		if (!resolvedCacheKey) return;
		let cancelled = false;
		setUsingCachedData(false);

		const loadCached = async () => {
			const cached = await readOfflineResource<T>(
				resolvedCacheKey,
				maxAgeMs,
			);
			if (cancelled || !cached) return;
			setCachedData(cached.value);
		};

		void loadCached();
		return () => {
			cancelled = true;
		};
	}, [resolvedCacheKey, maxAgeMs]);

	React.useEffect(() => {
		if (liveData === undefined) return;
		setCachedData(liveData);
		setUsingCachedData(false);
	}, [liveData]);

	const data = liveData ?? cachedData ?? undefined;
	const isLoading = swrLoading && data === undefined;
	const error =
		usingCachedData && data !== undefined
			? undefined
			: (swrError as Error | undefined);

	return {
		data,
		liveData,
		cachedData,
		error,
		isLoading,
		usingCachedData,
		mutate,
	};
}

export function useOfflineCachedArraySWR<T>(
	options: UseOfflineCachedArraySwrOptions<T>,
): UseOfflineCachedArraySwrResult<T> {
	const {
		requireNonEmptyCache = true,
		...rest
	} = options;
	const result = useOfflineCachedSWR<T[]>({
		...rest,
		isCachedDataUsable: (data) =>
			Array.isArray(data) &&
			(requireNonEmptyCache
				? data.length > 0
				: true),
	});

	return {
		...result,
		items: result.data ?? [],
	};
}
