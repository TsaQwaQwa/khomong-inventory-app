"use client";

interface CachedEnvelope<T> {
	value: T;
	updatedAt: number;
}

const DB_NAME = "kgomong-offline-cache-v1";
const STORE_NAME = "resources";
const STORAGE_PREFIX = "offline_resource_cache:";

function canUseBrowserStorage() {
	return (
		typeof window !== "undefined" &&
		typeof window.localStorage !== "undefined"
	);
}

function canUseIndexedDb() {
	return (
		typeof window !== "undefined" &&
		typeof window.indexedDB !== "undefined"
	);
}

async function openDb() {
	return await new Promise<IDBDatabase>((resolve, reject) => {
		const request = window.indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function readFromIndexedDb<T>(
	key: string,
): Promise<CachedEnvelope<T> | null> {
	if (!canUseIndexedDb()) return null;
	try {
		const db = await openDb();
		return await new Promise<CachedEnvelope<T> | null>(
			(resolve, reject) => {
				const tx = db.transaction(
					STORE_NAME,
					"readonly",
				);
				const store = tx.objectStore(STORE_NAME);
				const request = store.get(key);
				request.onsuccess = () =>
					resolve(
						(request.result as CachedEnvelope<T>) ??
							null,
					);
				request.onerror = () =>
					reject(request.error);
			},
		);
	} catch {
		return null;
	}
}

async function writeToIndexedDb<T>(
	key: string,
	payload: CachedEnvelope<T>,
) {
	if (!canUseIndexedDb()) return false;
	try {
		const db = await openDb();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(
				STORE_NAME,
				"readwrite",
			);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.objectStore(STORE_NAME).put(payload, key);
		});
		return true;
	} catch {
		return false;
	}
}

function readFromLocalStorage<T>(
	key: string,
): CachedEnvelope<T> | null {
	if (!canUseBrowserStorage()) return null;
	try {
		const raw = window.localStorage.getItem(
			`${STORAGE_PREFIX}${key}`,
		);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CachedEnvelope<T>;
		if (
			!parsed ||
			typeof parsed !== "object" ||
			typeof parsed.updatedAt !== "number" ||
			!("value" in parsed)
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function writeToLocalStorage<T>(
	key: string,
	payload: CachedEnvelope<T>,
) {
	if (!canUseBrowserStorage()) return;
	try {
		window.localStorage.setItem(
			`${STORAGE_PREFIX}${key}`,
			JSON.stringify(payload),
		);
	} catch {
		// best effort cache
	}
}

export async function readOfflineResource<T>(
	key: string,
	maxAgeMs?: number,
) {
	const fromIdb = await readFromIndexedDb<T>(key);
	const payload = fromIdb ?? readFromLocalStorage<T>(key);
	if (!payload) return null;

	const ageMs = Date.now() - payload.updatedAt;
	const isExpired =
		typeof maxAgeMs === "number" &&
		maxAgeMs > 0 &&
		ageMs > maxAgeMs;

	return {
		value: payload.value,
		updatedAt: payload.updatedAt,
		isExpired,
	};
}

export async function writeOfflineResource<T>(
	key: string,
	value: T,
) {
	const payload: CachedEnvelope<T> = {
		value,
		updatedAt: Date.now(),
	};

	const wroteIdb = await writeToIndexedDb(key, payload);
	if (!wroteIdb) {
		writeToLocalStorage(key, payload);
		return;
	}
	writeToLocalStorage(key, payload);
}
