"use client";

import * as React from "react";
import useSWR from "swr";
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

type AlertStatus = "UNREAD" | "READ";
type AlertPriority = "HIGH" | "MEDIUM" | "LOW";

interface InboxAlert {
	id: string;
	date: string;
	type: string;
	priority: AlertPriority;
	title: string;
	detail: string;
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
	const {
		data: alerts = [],
		error,
		isLoading,
		mutate,
	} = useSWR<InboxAlert[]>(
		"/api/alerts?status=all&limit=500",
		alertsFetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);

	const displayAlerts = React.useMemo(
		() =>
			[...alerts].sort((a, b) => {
				if (a.status !== b.status) {
					return a.status === "UNREAD"
						? -1
						: 1;
				}
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

	const markOne = async (
		alertId: string,
		status: AlertStatus,
	) => {
		try {
			await updateStatus([alertId], status);
			mutate();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to update alert",
			);
		}
	};

	return (
		<PageWrapper
			title="Alerts Inbox"
			description="Review stock alerts and mark read/unread."
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
			{error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{error.message}
					</AlertDescription>
				</Alert>
			) : isLoading ? (
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
						className={
							alert.status === "UNREAD"
								? "border-amber-400 bg-amber-50/40"
								: "opacity-80"
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
							<div className="flex gap-2">
								{alert.status === "UNREAD" ? (
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() =>
											markOne(
												alert.id,
												"READ",
											)
										}
									>
										Mark Read
									</Button>
								) : (
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() =>
											markOne(
												alert.id,
												"UNREAD",
											)
										}
									>
										Mark Unread
									</Button>
								)}
							</div>
						</CardContent>
					</Card>
				))
			)}
		</PageWrapper>
	);
}
