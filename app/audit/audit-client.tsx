"use client";

import * as React from "react";
import { AlertCircle, ChevronRight, Clock3, UserRound } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { useOfflineCachedArraySWR } from "@/lib/use-offline-cached-swr";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
	id: string;
	action: string;
	entityType: string;
	entityId?: string;
	actorUserId?: string;
	fieldChanges: {
		field: string;
		oldValue: unknown;
		newValue: unknown;
	}[];
	oldValues?: Record<string, unknown> | null;
	newValues?: Record<string, unknown> | null;
	meta?: Record<string, unknown>;
	createdAt?: string;
}

const fetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(
			json?.error?.message ??
				json?.error ??
				"Failed to fetch audit logs",
		);
	}
	return (json?.data ?? json) as AuditLogEntry[];
};

function formatDate(value?: string) {
	if (!value) return "-";
	return new Date(value).toLocaleString();
}

function toJson(value: unknown) {
	if (value === undefined) return "undefined";
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function actionBadgeVariant(action: string) {
	if (action === "CREATE") return "default";
	if (action === "REVERSE") return "destructive";
	return "secondary";
}

function JsonBlock({
	title,
	value,
	emptyText = "No data captured.",
	panelClassName,
}: {
	title: string;
	value: unknown;
	emptyText?: string;
	panelClassName?: string;
}) {
	const hasValue =
		value !== undefined &&
		value !== null &&
		(!(typeof value === "object") ||
			(Array.isArray(value)
				? value.length > 0
				: Object.keys(value).length > 0));

	return (
		<div className="space-y-2">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{title}
			</p>
			{!hasValue ? (
				<p className="text-xs text-muted-foreground">{emptyText}</p>
			) : (
				<pre
					className={cn(
						"max-h-72 overflow-auto rounded-md border p-3 text-xs leading-relaxed",
						panelClassName ?? "bg-muted/40",
					)}
				>
					{toJson(value)}
				</pre>
			)}
		</div>
	);
}

function FieldChangeBlock({
	change,
}: {
	change: AuditLogEntry["fieldChanges"][number];
}) {
	return (
		<div className="rounded-lg border bg-background p-4">
			<p className="mb-3 text-sm font-semibold">{change.field}</p>
			<div className="grid gap-3 md:grid-cols-2">
				<JsonBlock
					title="Old"
					value={change.oldValue}
					emptyText="No old value."
					panelClassName="border-red-200 bg-red-50/50"
				/>
				<JsonBlock
					title="New"
					value={change.newValue}
					emptyText="No new value."
					panelClassName="border-emerald-200 bg-emerald-50/50"
				/>
			</div>
		</div>
	);
}

export function AuditClient() {
	const [entityType, setEntityType] = React.useState("all");
	const [action, setAction] = React.useState("all");
	const [entityId, setEntityId] = React.useState("");
	const [selectedLog, setSelectedLog] =
		React.useState<AuditLogEntry | null>(null);

	const query = React.useMemo(() => {
		const params = new URLSearchParams();
		params.set("limit", "400");
		if (entityType !== "all")
			params.set("entityType", entityType);
		if (action !== "all") params.set("action", action);
		if (entityId.trim()) params.set("entityId", entityId.trim());
		return `/api/audit-logs?${params.toString()}`;
	}, [entityType, action, entityId]);

	const {
		items: logs,
		error: effectiveError,
		isLoading: effectiveLoading,
	} = useOfflineCachedArraySWR<AuditLogEntry>({
		key: query,
		cacheKey: `audit:query:${query}`,
		fetcher,
	});

	return (
		<PageWrapper
			title="Audit Trail"
			description="Who changed what, old value to new value, and when."
		>
			<div className="mb-4 grid gap-3 md:grid-cols-3">
				<div className="space-y-1.5">
					<Label>Entity Type</Label>
					<Select value={entityType} onValueChange={setEntityType}>
						<SelectTrigger>
							<SelectValue placeholder="All entity types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="Product">Product</SelectItem>
							<SelectItem value="Price">Price</SelectItem>
							<SelectItem value="Purchase">Purchase</SelectItem>
							<SelectItem value="Supplier">Supplier</SelectItem>
							<SelectItem value="SupplierProductPrice">Supplier Price</SelectItem>
							<SelectItem value="Customer">Customer</SelectItem>
							<SelectItem value="Adjustment">Adjustment</SelectItem>
							<SelectItem value="SaleTransaction">Sale</SelectItem>
							<SelectItem value="TabTransaction">Tab Transaction</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<Label>Action</Label>
					<Select value={action} onValueChange={setAction}>
						<SelectTrigger>
							<SelectValue placeholder="All actions" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="CREATE">CREATE</SelectItem>
							<SelectItem value="UPDATE">UPDATE</SelectItem>
							<SelectItem value="UPDATE_STATUS">UPDATE_STATUS</SelectItem>
							<SelectItem value="SET_PRICE">SET_PRICE</SelectItem>
							<SelectItem value="SET_SUPPLIER_PRICE">SET_SUPPLIER_PRICE</SelectItem>
							<SelectItem value="REVERSE">REVERSE</SelectItem>
							<SelectItem value="RESEND_FAILED_RECIPIENTS">RESEND_FAILED_RECIPIENTS</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<Label>Entity ID</Label>
					<Input
						value={entityId}
						onChange={(e) => setEntityId(e.target.value)}
						placeholder="Filter by entity id"
					/>
				</div>
			</div>

			{effectiveError ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{effectiveError.message}
					</AlertDescription>
				</Alert>
			) : effectiveLoading ? (
				<p className="text-sm text-muted-foreground">Loading audit logs...</p>
			) : logs.length === 0 ? (
				<EmptyState
					title="No audit entries"
					description="No matching changes were found."
				/>
			) : (
				<div className="space-y-2">
					{logs.map((log) => (
						<Card key={log.id} className="border-muted">
							<CardContent className="p-0">
								<button
									type="button"
									onClick={() => setSelectedLog(log)}
									className="grid w-full gap-3 p-4 text-left transition-colors hover:bg-muted/40 md:grid-cols-[1fr_auto]"
								>
									<div className="space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<Badge
												variant={actionBadgeVariant(
													log.action,
												)}
												className="font-medium"
											>
												{log.action}
											</Badge>
											<p className="text-sm font-medium">
												{log.entityType}
											</p>
											{log.entityId ? (
												<code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
													{log.entityId}
												</code>
											) : null}
										</div>
										<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
											<span className="inline-flex items-center gap-1">
												<Clock3 className="h-3.5 w-3.5" />
												{formatDate(log.createdAt)}
											</span>
											<span className="inline-flex items-center gap-1">
												<UserRound className="h-3.5 w-3.5" />
												{log.actorUserId ?? "unknown"}
											</span>
											<span>
												{
													(log.fieldChanges ?? [])
														.length
												}{" "}
												field
												{(
													log.fieldChanges ?? []
												).length === 1
													? ""
													: "s"}{" "}
												changed
											</span>
										</div>
									</div>
									<div className="inline-flex items-center justify-end text-xs font-medium text-muted-foreground">
										View details
										<ChevronRight className="h-4 w-4" />
									</div>
								</button>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Dialog
				open={selectedLog !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedLog(null);
				}}
			>
				<DialogContent className="flex h-[90vh] w-[96vw] max-w-5xl flex-col overflow-hidden p-0">
					{selectedLog ? (
						<>
							<DialogHeader className="shrink-0 space-y-4 border-b bg-muted/30 px-6 py-5">
								<div className="flex flex-wrap items-center gap-2">
									<Badge
										variant={actionBadgeVariant(
											selectedLog.action,
										)}
										className="font-semibold"
									>
										{selectedLog.action}
									</Badge>
									<DialogTitle className="text-xl">
										{selectedLog.entityType}
									</DialogTitle>
									{selectedLog.entityId ? (
										<code className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
											{selectedLog.entityId}
										</code>
									) : null}
								</div>
								<DialogDescription className="text-sm">
									Review exact before/after values and full
									payload captured for this action.
								</DialogDescription>
								<div className="grid gap-3 rounded-lg border bg-background p-3 text-sm md:grid-cols-3">
									<div>
										<p className="text-xs text-muted-foreground">
											Actor
										</p>
										<p className="font-medium">
											{selectedLog.actorUserId ?? "unknown"}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">
											Timestamp
										</p>
										<p className="font-medium">
											{formatDate(selectedLog.createdAt)}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">
											Changed Fields
										</p>
										<p className="font-medium">
											{selectedLog.fieldChanges.length}
										</p>
									</div>
								</div>
							</DialogHeader>

							<div className="min-h-0 flex-1 overflow-y-auto">
								<div className="grid gap-4 p-6 lg:grid-cols-[1.5fr_1fr]">
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Field Changes
										</p>
										<Badge variant="outline">
											{selectedLog.fieldChanges.length}
										</Badge>
									</div>
									{(selectedLog.fieldChanges ?? []).length ===
									0 ? (
										<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
											No field-level differences were
											recorded for this event.
										</div>
									) : (
										<div className="space-y-3">
											{selectedLog.fieldChanges.map(
												(change, index) => (
													<FieldChangeBlock
														key={`${selectedLog.id}-${change.field}-${index}`}
														change={change}
													/>
												),
											)}
										</div>
									)}
								</div>

								<div className="space-y-4">
									<div className="rounded-lg border bg-muted/20 p-4">
										<p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Event Details
										</p>
										<div className="space-y-3 text-sm">
											<div>
												<p className="text-xs text-muted-foreground">
													Action
												</p>
												<p className="font-medium">
													{selectedLog.action}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													Entity Type
												</p>
												<p className="font-medium">
													{selectedLog.entityType}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													Entity ID
												</p>
												<p className="font-medium">
													{selectedLog.entityId ?? "-"}
												</p>
											</div>
										</div>
									</div>

									<div className="rounded-lg border p-4">
										<p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Object Snapshots
										</p>
										<div className="space-y-4">
											<JsonBlock
												title="Old Object"
												value={selectedLog.oldValues}
											/>
											<JsonBlock
												title="New Object"
												value={selectedLog.newValues}
											/>
										</div>
									</div>

									<div className="rounded-lg border p-4">
										<JsonBlock
											title="Metadata"
											value={selectedLog.meta}
										/>
									</div>
								</div>
							</div>
							</div>

							<div className="shrink-0 flex justify-end border-t bg-muted/20 px-6 py-4">
								<Button
									variant="outline"
									onClick={() => setSelectedLog(null)}
								>
									Close
								</Button>
							</div>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</PageWrapper>
	);
}
