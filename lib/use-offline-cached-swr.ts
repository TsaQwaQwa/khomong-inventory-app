"use client";

import useSWR, { type KeyedMutator } from "swr";

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
		fetcher,
		maxAgeMs = DEFAULT_MAX_AGE_MS,
		isCachedDataUsable = (data) => data !== null && data !== undefined,
		onError,
	} = options;

	const {
		data: liveData,
		error: swrError,
		isLoading: swrLoading,
		mutate,
	} = useSWR<T>(key, key ? fetcher : null, {
		onError: (error) => {
			onError?.(error as Error);
		},
	});

	void maxAgeMs;
	void isCachedDataUsable;

	return {
		data: liveData,
		liveData,
		cachedData: null,
		error: swrError as Error | undefined,
		isLoading: swrLoading && liveData === undefined,
		usingCachedData: false,
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
