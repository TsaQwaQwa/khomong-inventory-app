"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import {
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
} from "@/components/ui/tabs";
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
	whatsappSentAt?: string;
	whatsappDeliveryStatus?: string;
	whatsappStatusAt?: string;
	whatsappError?: string;
	createdAt?: string;
}

interface WhatsAppActivity {
	id: string;
	messageId: string;
	status: string;
	recipientId?: string;
	errorMessage?: string;
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

const activityFetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) return [] as WhatsAppActivity[];
	return (json?.data ?? json) as WhatsAppActivity[];
};

export function AlertsClient() {
	const [tab, setTab] = React.useState<
		"all" | "unread" | "read"
	>("unread");
	const statusParam =
		tab === "all"
			? "all"
			: tab === "unread"
				? "UNREAD"
				: "READ";

	const {
		data: alerts = [],
		error,
		isLoading,
		mutate,
	} = useSWR<InboxAlert[]>(
		`/api/alerts?status=${statusParam}&limit=300`,
		alertsFetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);
	const { data: waActivity = [] } = useSWR<
		WhatsAppActivity[]
	>(
		"/api/whatsapp/activity?limit=120",
		activityFetcher,
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
			description="Review low-stock and out-of-stock alerts. WhatsApp delivery status is shown per alert."
			actions={
				<Button
					type="button"
					variant="outline"
					onClick={markAllRead}
					disabled={
						alerts.filter(
							(a) => a.status === "UNREAD",
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
			) : (
				<Tabs
					value={tab}
					onValueChange={(value) =>
						setTab(
							value as "all" | "unread" | "read",
						)
					}
					className="space-y-4"
				>
					<TabsList className="grid w-full max-w-sm grid-cols-3">
						<TabsTrigger value="unread">
							Unread
						</TabsTrigger>
						<TabsTrigger value="read">
							Read
						</TabsTrigger>
						<TabsTrigger value="all">
							All
						</TabsTrigger>
					</TabsList>

					<TabsContent
						value={tab}
						className="space-y-3"
					>
						{isLoading ? (
							<p className="text-sm text-muted-foreground">
								Loading alerts...
							</p>
						) : alerts.length === 0 ? (
							<EmptyState
								title="No alerts"
								description="No alerts match this view."
							/>
						) : (
							alerts.map((alert) => (
								<Card key={alert.id}>
									<CardHeader className="pb-2">
										<div className="flex items-start justify-between gap-3">
											<div>
												<CardTitle className="text-base">
													{alert.title}
												</CardTitle>
												<p className="text-xs text-muted-foreground mt-1">
													{formatDateDisplay(
														alert.date,
													)}
												</p>
											</div>
											<span className="rounded border px-2 py-0.5 text-xs">
												{alert.priority}
											</span>
										</div>
									</CardHeader>
									<CardContent className="space-y-2 text-sm">
										<p>{alert.detail}</p>
										<p className="text-xs text-muted-foreground">
											WhatsApp:{" "}
											{alert.whatsappDeliveryStatus
												? `${alert.whatsappDeliveryStatus}${
														alert.whatsappStatusAt
															? ` (${new Date(alert.whatsappStatusAt).toLocaleString()})`
															: ""
												  }`
												: alert.whatsappSentAt
													? "Sent"
												: alert.whatsappError
													? `Failed (${alert.whatsappError})`
													: "Pending / Not configured"}
										</p>
										<div className="flex gap-2">
											{alert.status ===
											"UNREAD" ? (
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
					</TabsContent>
				</Tabs>
			)}
			<Card className="mt-6">
				<CardHeader>
					<CardTitle>
						WhatsApp Activity
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{waActivity.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No WhatsApp callback events yet.
						</p>
					) : (
						waActivity.map((event) => (
							<div
								key={event.id}
								className="rounded border p-2 text-sm"
							>
								<p className="font-medium">
									{event.status}
								</p>
								<p className="text-xs text-muted-foreground">
									{event.createdAt
										? new Date(
												event.createdAt,
										  ).toLocaleString()
										: "-"}
								</p>
								<p className="text-xs text-muted-foreground">
									Message ID:{" "}
									{event.messageId}
								</p>
								{event.errorMessage && (
									<p className="text-xs text-destructive">
										{event.errorMessage}
									</p>
								)}
							</div>
						))
					)}
				</CardContent>
			</Card>
		</PageWrapper>
	);
}
