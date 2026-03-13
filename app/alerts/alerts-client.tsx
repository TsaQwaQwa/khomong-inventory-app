"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Alert,
	AlertTitle,
	AlertDescription,
} from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { formatDateDisplay } from "@/lib/date-utils";
import { useOfflineCachedArraySWR } from "@/lib/use-offline-cached-swr";

type AlertStatus = "UNREAD" | "READ";
type AlertPriority = "HIGH" | "MEDIUM" | "LOW";

interface InboxAlert {
	id: string;
	date: string;
	type: string;
	priority: AlertPriority;
	title: string;
	detail: string;
	affectedCount?: number;
	items?: Array<{
		productId: string;
		label: string;
	}>;
	status: AlertStatus;
	createdAt?: string;
}

const alertsFetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(
			json?.error?.message ??
				json?.error ??
				"Failed to fetch alerts",
		);
	}
	return (json?.data ?? json) as InboxAlert[];
};

export function AlertsClient() {
	const router = useRouter();

	const {
		data: alertsData,
		error: effectiveError,
		isLoading: effectiveLoading,
		mutate,
		items: alerts,
	} = useOfflineCachedArraySWR<InboxAlert>({
		key: "/api/alerts?status=all&limit=500",
		cacheKey: "alerts:list:all:500",
		fetcher: alertsFetcher,
		onError: (err) => toast.error(err.message),
	});

	const displayAlerts = React.useMemo(
		() =>
			[...alerts].sort((a, b) => {
				const aTime = new Date(
					a.createdAt ?? a.date,
				).getTime();
				const bTime = new Date(
					b.createdAt ?? b.date,
				).getTime();
				return bTime - aTime;
			}),
		[alerts],
	);

	const updateStatus = async (
		ids: string[],
		status: AlertStatus,
	) => {
		if (!ids.length) return;
		const res = await fetch("/api/alerts", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ ids, status }),
		});
		if (!res.ok) {
			const body = await res
				.json()
				.catch(() => ({}));
			throw new Error(
				body?.error?.message ??
					body?.error ??
					"Failed to update alerts",
			);
		}
	};

	const markAllRead = async () => {
		try {
			const ids = alerts
				.filter((alert) => alert.status === "UNREAD")
				.map((alert) => alert.id);
			await updateStatus(ids, "READ");
			toast.success("Marked as read");
			mutate();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to update alerts",
			);
		}
	};

	const markOneRead = async (alertId: string) => {
		try {
			await updateStatus([alertId], "READ");
			mutate();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to update alert",
			);
		}
	};

	const getAlertBrowseHref = (alert: InboxAlert) => {
		if (alert.type === "OUT_OF_STOCK") {
			return "/products?stockStatus=OUT";
		}
		if (alert.type === "LOW_STOCK") {
			return "/products?stockStatus=LOW";
		}
		if (alert.type === "DAILY_PURCHASE_PLAN") {
			return "/products?stockStatus=LOW";
		}
		return "/products";
	};

	const handleAlertClick = (alert: InboxAlert) => {
		if (alert.status === "UNREAD") {
			void markOneRead(alert.id);
		}
		router.push(getAlertBrowseHref(alert));
	};

	return (
		<PageWrapper
			title="Alerts Inbox"
			description="Click an alert to open its related view."
			actions={
				<Button
					type="button"
					variant="outline"
					onClick={markAllRead}
					disabled={
						alerts.filter(
							(a) =>
								a.status ===
								"UNREAD",
						).length === 0
					}
				>
					Mark All Read
				</Button>
			}
		>
			{effectiveError ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{effectiveError.message}
					</AlertDescription>
				</Alert>
			) : effectiveLoading ? (
				<p className="text-sm text-muted-foreground">
					Loading alerts...
				</p>
			) : displayAlerts.length === 0 ? (
				<EmptyState
					title="No alerts"
					description="No alerts found."
				/>
			) : (
				displayAlerts.map((alert) => (
					<Card
						key={alert.id}
						role="button"
						tabIndex={0}
						onClick={() => handleAlertClick(alert)}
						onKeyDown={(e) => {
							if (
								e.key === "Enter" ||
								e.key === " "
							) {
								e.preventDefault();
								handleAlertClick(alert);
							}
						}}
						className={
							alert.status === "UNREAD"
								? "border-amber-400 bg-amber-50/40 cursor-pointer"
								: "opacity-80 cursor-pointer"
						}
					>
						<CardHeader className="pb-2">
							<div className="flex items-start justify-between gap-3">
								<div>
									<CardTitle className="text-base">
										{alert.title}
									</CardTitle>
									<p className="mt-1 text-xs text-muted-foreground">
										{formatDateDisplay(
											alert.date,
										)}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<span
										className={`rounded border px-2 py-0.5 text-xs ${
											alert.status === "UNREAD"
												? "border-amber-500 text-amber-700"
												: "border-muted-foreground/30 text-muted-foreground"
										}`}
									>
										{alert.status === "UNREAD"
											? "Unread"
											: "Read"}
									</span>
									<span className="rounded border px-2 py-0.5 text-xs">
										{alert.priority}
									</span>
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<p>{alert.detail}</p>
							<p className="text-xs text-muted-foreground">
								Open related products
							</p>
						</CardContent>
					</Card>
				))
			)}
		</PageWrapper>
	);
}
