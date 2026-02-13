"use client";
/* eslint-disable max-len */

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
	whatsappRecipients?: Array<{
		to: string;
		sendStatus: "SENT" | "FAILED";
		sendError?: string;
		messageId?: string;
		deliveryStatus?: string;
		deliveryError?: string;
		lastStatusAt?: string;
	}>;
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
interface AccessData {
	isAdmin: boolean;
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
const accessFetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) return { isAdmin: false } as AccessData;
	return (json?.data ?? json) as AccessData;
};

export function AlertsClient() {
	const [sectionTab, setSectionTab] = React.useState<
		"alerts" | "whatsapp"
	>("alerts");

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
	const { data: waActivity = [] } = useSWR<
		WhatsAppActivity[]
	>(
		"/api/whatsapp/activity?limit=120",
		activityFetcher,
	);
	const { data: access } = useSWR<AccessData>(
		"/api/session/access",
		accessFetcher,
	);
	const isAdmin = access?.isAdmin ?? false;
	const recipientRows = React.useMemo(
		() =>
			alerts.flatMap((alert) =>
				(alert.whatsappRecipients ?? []).map(
					(recipient) => ({
						alertId: alert.id,
						alertTitle: alert.title,
						alertDate: alert.date,
						priority: alert.priority,
						to: recipient.to,
						sendStatus: recipient.sendStatus,
						sendError: recipient.sendError,
						deliveryStatus:
							recipient.deliveryStatus,
						deliveryError:
							recipient.deliveryError,
						lastStatusAt:
							recipient.lastStatusAt,
						messageId: recipient.messageId,
					}),
				),
			),
		[alerts],
	);
	const alertsWithoutRecipientRows = React.useMemo(
		() =>
			alerts.filter(
				(alert) =>
					Boolean(alert.whatsappSentAt) &&
					(alert.whatsappRecipients ?? [])
						.length === 0,
			),
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

	const resendFailed = async (alertId: string) => {
		try {
			const res = await fetch(
				"/api/alerts/resend-failed",
				{
					method: "POST",
					headers: {
						"Content-Type":
							"application/json",
					},
					body: JSON.stringify({ alertId }),
				},
			);
			const body = await res
				.json()
				.catch(() => ({}));
			if (!res.ok) {
				throw new Error(
					body?.error?.message ??
						body?.error ??
						"Failed to resend",
				);
			}
			toast.success(
				body?.data?.message ??
					"Resend complete",
			);
			mutate();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to resend",
			);
		}
	};

	return (
		<PageWrapper
			title="Alerts Inbox"
			description="Review stock alerts and track WhatsApp delivery per recipient."
			actions={
				sectionTab === "alerts" ? (
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
				) : undefined
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
					value={sectionTab}
					onValueChange={(value) =>
						setSectionTab(
							value as
								| "alerts"
								| "whatsapp",
						)
					}
					className="space-y-4"
				>
					<TabsList
						className={`grid w-full max-w-sm ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}
					>
						<TabsTrigger value="alerts">
							Alerts
						</TabsTrigger>
						{isAdmin && (
							<TabsTrigger value="whatsapp">
								WhatsApp
							</TabsTrigger>
						)}
					</TabsList>

					<TabsContent
						value="alerts"
						className="space-y-3"
					>
						{isLoading ? (
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
											{isAdmin &&
												(
													alert.whatsappRecipients ?? []
												).some(
													(recipient) =>
														recipient.sendStatus ===
															"FAILED" ||
														recipient.deliveryStatus ===
															"FAILED",
												) && (
													<Button
														type="button"
														size="sm"
														variant="secondary"
														onClick={() =>
															resendFailed(
																alert.id,
															)
														}
													>
														Resend Failed
													</Button>
												)}
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
					</TabsContent>

					{isAdmin && (
						<TabsContent
							value="whatsapp"
							className="space-y-4"
						>
						<Card>
							<CardHeader>
								<CardTitle>
									Recipient
									Delivery Status
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="rounded border bg-muted/30 p-3 text-xs">
									<p className="font-medium">
										Send timeline
									</p>
									<p className="text-muted-foreground">
										Attempted (created instantly){" "}
										{"->"} Pending {"->"} Delivered / Read / Failed
									</p>
								</div>
								{isLoading ? (
									<p className="text-sm text-muted-foreground">
										Loading WhatsApp
										status...
									</p>
								) : recipientRows.length ===
								  0 ? (
									<EmptyState
										title="No recipient status rows yet"
										description="New alerts with WhatsApp sends will show each number, message id, and delivery/read progress here."
									/>
								) : (
									<>
										<div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_120px_100px] gap-2 rounded border px-3 py-2 text-xs font-medium text-muted-foreground">
											<p>
												Recipient /
												Alert
											</p>
											<p>
												Message
											</p>
											<p>
												Send
											</p>
											<p>
												Delivery
											</p>
											<p>
												Action
											</p>
										</div>
										{recipientRows.map(
											(row) => {
												const canRetry =
													row.sendStatus ===
														"FAILED" ||
													row.deliveryStatus ===
														"FAILED";
												return (
													<div
														key={`${row.alertId}-${row.to}-${row.messageId ?? "none"}`}
														className="rounded border p-3"
													>
														<div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_120px_100px] md:items-start">
															<div className="text-sm">
																<p className="font-medium">
																	{
																		row.to
																	}
																</p>
																<p className="text-xs text-muted-foreground">
																	{
																		row.alertTitle
																	}
																	{" | "}
																	{formatDateDisplay(
																		row.alertDate,
																	)}
																</p>
															</div>
															<div className="text-xs text-muted-foreground">
																<p>
																	{row.messageId ??
																		"No message id"}
																</p>
																{row.lastStatusAt && (
																	<p>
																		{new Date(
																			row.lastStatusAt,
																		).toLocaleString()}
																	</p>
																)}
															</div>
															<div className="text-xs">
																<p>
																	{
																		row.sendStatus
																	}
																</p>
																{row.sendError && (
																	<p className="text-destructive">
																		{
																			row.sendError
																		}
																	</p>
																)}
															</div>
															<div className="text-xs">
																<p>
																	{row.deliveryStatus ??
																		"-"}
																</p>
																{row.deliveryError && (
																	<p className="text-destructive">
																		{
																			row.deliveryError
																		}
																	</p>
																)}
															</div>
															<div>
																{canRetry ? (
																	<Button
																		type="button"
																		size="sm"
																		variant="outline"
																		onClick={() =>
																			resendFailed(
																				row.alertId,
																			)
																		}
																	>
																		Retry
																	</Button>
																) : (
																	<p className="text-xs text-muted-foreground">
																		-
																	</p>
																)}
															</div>
														</div>
													</div>
												);
											},
										)}
									</>
								)}
								{alertsWithoutRecipientRows.length >
									0 && (
									<div className="rounded border border-dashed p-3 text-xs text-muted-foreground">
										<p className="font-medium text-foreground">
											Some sent
											alerts have
											no recipient
											rows
										</p>
										{alertsWithoutRecipientRows.map(
											(alert) => (
												<p
													key={`missing-${alert.id}`}
												>
													{
														alert.title
													}
													{" | "}
													{formatDateDisplay(
														alert.date,
													)}
													{alert.whatsappError
														? ` | ${alert.whatsappError}`
														: ""}
												</p>
											),
										)}
									</div>
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>
									WhatsApp Callback
									Activity
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								{waActivity.length ===
								0 ? (
									<p className="text-sm text-muted-foreground">
										No callback
										events yet.
									</p>
								) : (
									waActivity.map(
										(event) => (
											<div
												key={
													event.id
												}
												className="rounded border p-2 text-sm"
											>
												<p className="font-medium">
													{
														event.status
													}
												</p>
												<p className="text-xs text-muted-foreground">
													{event.recipientId ??
														"No recipient id"}
												</p>
												<p className="text-xs text-muted-foreground">
													{event.createdAt
														? new Date(
																event.createdAt,
														  ).toLocaleString()
														: "-"}
												</p>
												<p className="text-xs text-muted-foreground">
													Message
													ID:{" "}
													{
														event.messageId
													}
												</p>
												{event.errorMessage && (
													<p className="text-xs text-destructive">
														{
															event.errorMessage
														}
													</p>
												)}
											</div>
										),
									)
								)}
							</CardContent>
						</Card>
						</TabsContent>
					)}
				</Tabs>
			)}
		</PageWrapper>
	);
}
