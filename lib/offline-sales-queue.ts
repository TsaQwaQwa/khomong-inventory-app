type QueueEndpoint =
	| "/api/sales"
	| "/api/tabs/charge"
	| "/api/tabs/payment"
	| "/api/tabs/expense"
	| "/api/purchases"
	| "/api/adjustments";

interface FlushResult {
	synced: number;
	dropped: number;
	remaining: number;
	authBlocked: boolean;
}

const OFFLINE_QUEUE_EVENT = "offline-queue-changed";
type PostSaleResult = {
	queued: false;
	response: Response;
};

export function getOfflineSalesQueueCount() {
	return 0;
}

export function getOfflineQueueCount() {
	return 0;
}

export const offlineQueueChangedEvent =
	OFFLINE_QUEUE_EVENT;

export async function postWithOfflineQueue(
	endpoint: QueueEndpoint,
	body: Record<string, unknown>,
): Promise<PostSaleResult> {
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

export async function postTabExpenseWithOfflineQueue(
	body: Record<string, unknown>,
): Promise<PostSaleResult> {
	return postWithOfflineQueue("/api/tabs/expense", body);
}

export async function flushOfflineQueue(): Promise<FlushResult> {
	return {
		synced: 0,
		dropped: 0,
		remaining: 0,
		authBlocked: false,
	};
}

export async function flushOfflineSalesQueue(): Promise<FlushResult> {
	return {
		synced: 0,
		dropped: 0,
		remaining: 0,
		authBlocked: false,
	};
}
