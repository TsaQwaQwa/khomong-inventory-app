"use client";

import * as React from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
	flushOfflineQueue,
	getOfflineQueueCount,
} from "@/lib/offline-sales-queue";

let isFlushing = false;

export function OfflineSalesSync() {
	const { mutate } = useSWRConfig();

	React.useEffect(() => {
		const flushNow = async (source: "online" | "startup" | "interval") => {
			if (isFlushing) return;
			if (!navigator.onLine) return;
			if (getOfflineQueueCount() === 0) return;

			isFlushing = true;
			try {
				const result = await flushOfflineQueue();
				if (result.synced > 0) {
					toast.success(
						`Synced ${result.synced} offline action${result.synced === 1 ? "" : "s"}.`,
					);
					await Promise.all([
						mutate((key) => typeof key === "string" && key.startsWith("/api/transactions")),
						mutate((key) => typeof key === "string" && key.startsWith("/api/reports")),
						mutate((key) => typeof key === "string" && key.startsWith("/api/tabs")),
						mutate((key) => typeof key === "string" && key.startsWith("/api/alerts")),
						mutate((key) => typeof key === "string" && key.startsWith("/api/purchases")),
						mutate((key) => typeof key === "string" && key.startsWith("/api/adjustments")),
						mutate((key) => typeof key === "string" && key.startsWith("/api/products")),
						mutate((key) => typeof key === "string" && key.startsWith("/api/customers")),
					]);
				}
				if (result.dropped > 0) {
					toast.error(
						`${result.dropped} queued action${result.dropped === 1 ? "" : "s"} failed validation and was dropped.`,
					);
				}
				if (source === "online" && result.remaining > 0 && result.synced === 0) {
					toast.error(
						"Still offline or server unavailable. Pending actions remain queued.",
					);
				}
			} finally {
				isFlushing = false;
			}
		};

		void flushNow("startup");
		const onOnline = () => {
			void flushNow("online");
		};
		window.addEventListener("online", onOnline);
		const id = window.setInterval(() => {
			void flushNow("interval");
		}, 30000);

		return () => {
			window.removeEventListener("online", onOnline);
			window.clearInterval(id);
		};
	}, [mutate]);

	return null;
}
