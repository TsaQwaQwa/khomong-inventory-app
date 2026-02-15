type QueueEndpoint =
	| "/api/sales"
	| "/api/tabs/charge"
	| "/api/tabs/payment"
	| "/api/purchases"
	| "/api/adjustments";

interface OfflineQueueItem {
	id: string;
	endpoint: QueueEndpoint;
	body: Record<string, unknown>;
	createdAt: string;
	attempts: number;
	lastError?: string;
}

interface FlushResult {
	synced: number;
	dropped: number;
	remaining: number;
	authBlocked: boolean;
}

type PostSaleResult =
	| { queued: true; response: null }
	| { queued: false; response: Response };

const STORAGE_KEY = "offline_sales_queue_v1";
const OFFLINE_QUEUE_EVENT = "offline-queue-changed";

function canUseStorage() {
	return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readQueue(): OfflineQueueItem[] {
	if (!canUseStorage()) return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as OfflineQueueItem[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeQueue(queue: OfflineQueueItem[]) {
	if (!canUseStorage()) return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
	window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}

function makeQueueItem(
	endpoint: QueueEndpoint,
	body: Record<string, unknown>,
	error?: string,
): OfflineQueueItem {
	return {
		id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
		endpoint,
		body,
		createdAt: new Date().toISOString(),
		attempts: 0,
		lastError: error,
	};
}

async function sendItem(item: OfflineQueueItem) {
	return fetch(item.endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(item.body),
	});
}

export function getOfflineSalesQueueCount() {
	return readQueue().length;
}

export function getOfflineQueueCount() {
	return readQueue().length;
}

export const offlineQueueChangedEvent =
	OFFLINE_QUEUE_EVENT;

export async function postWithOfflineQueue(
	endpoint: QueueEndpoint,
	body: Record<string, unknown>,
): Promise<PostSaleResult> {
	if (typeof window !== "undefined" && !navigator.onLine) {
		const queue = readQueue();
		queue.push(makeQueueItem(endpoint, body, "offline"));
		writeQueue(queue);
		return {
			queued: true,
			response: null,
		};
	}

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
		return {
			queued: false,
			response,
		};
	} catch (error) {
		const queue = readQueue();
		queue.push(
			makeQueueItem(
				endpoint,
				body,
				error instanceof Error ? error.message : "network_error",
			),
		);
		writeQueue(queue);
		return {
			queued: true,
			response: null,
		};
	}
}

export async function postSaleWithOfflineQueue(
	endpoint: "/api/sales" | "/api/tabs/charge",
	body: Record<string, unknown>,
): Promise<PostSaleResult> {
	return postWithOfflineQueue(endpoint, body);
}

export async function postPurchaseWithOfflineQueue(
	body: Record<string, unknown>,
): Promise<PostSaleResult> {
	return postWithOfflineQueue("/api/purchases", body);
}

export async function postAdjustmentWithOfflineQueue(
	body: Record<string, unknown>,
): Promise<PostSaleResult> {
	return postWithOfflineQueue("/api/adjustments", body);
}

export async function postTabPaymentWithOfflineQueue(
	body: Record<string, unknown>,
): Promise<PostSaleResult> {
	return postWithOfflineQueue("/api/tabs/payment", body);
}

export async function flushOfflineQueue(): Promise<FlushResult> {
	return flushOfflineSalesQueue();
}

export async function flushOfflineSalesQueue(): Promise<FlushResult> {
	let queue = readQueue();
	let synced = 0;
	let dropped = 0;
	let authBlocked = false;

	while (queue.length > 0) {
		const item = queue[0];
		try {
			const response = await sendItem(item);
			if (response.ok) {
				synced += 1;
				queue.shift();
				continue;
			}

			const body = await response.json().catch(() => ({}));
			const message =
				(typeof body?.error === "string" ? body.error : body?.error?.message) ??
				`HTTP_${response.status}`;

			// Permanent invalid payload cases:
			// drop from queue to avoid infinite loop.
			// Keep auth failures (401/403) queued
			// so user can re-auth and retry.
			if (
				response.status >= 400 &&
				response.status < 500 &&
				response.status !== 401 &&
				response.status !== 403 &&
				response.status !== 429
			) {
				dropped += 1;
				queue.shift();
				continue;
			}
			if (
				response.status === 401 ||
				response.status === 403
			) {
				authBlocked = true;
			}

			item.attempts += 1;
			item.lastError = message;
			queue[0] = item;
			break;
		} catch (error) {
			item.attempts += 1;
				item.lastError =
					error instanceof Error
						? error.message
						: "network_error";
			queue[0] = item;
			break;
		}
	}

	writeQueue(queue);
	return {
		synced,
		dropped,
		remaining: queue.length,
		authBlocked,
	};
}
