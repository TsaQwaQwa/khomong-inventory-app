"use client";

import * as React from "react";
import useSWR from "swr";
import { AlertCircle } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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

export function AuditClient() {
	const [entityType, setEntityType] = React.useState("all");
	const [action, setAction] = React.useState("all");
	const [entityId, setEntityId] = React.useState("");

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
		data: logs = [],
		error,
		isLoading,
	} = useSWR<AuditLogEntry[]>(query, fetcher);

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

			{error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : isLoading ? (
				<p className="text-sm text-muted-foreground">Loading audit logs...</p>
			) : logs.length === 0 ? (
				<EmptyState
					title="No audit entries"
					description="No matching changes were found."
				/>
			) : (
				<div className="space-y-3">
					{logs.map((log) => (
						<Card key={log.id}>
							<CardHeader className="pb-2">
								<CardTitle className="text-base">
									{log.action} {log.entityType}
								</CardTitle>
									<p className="text-xs text-muted-foreground">
										{log.createdAt
											? new Date(
													log.createdAt,
											  ).toLocaleString()
											: "-"}
									{" | "}Actor: {log.actorUserId ?? "unknown"}
									{" | "}Entity ID: {log.entityId ?? "-"}
								</p>
							</CardHeader>
							<CardContent className="space-y-2">
								{(log.fieldChanges ?? []).length === 0 ? (
									<p className="text-xs text-muted-foreground">
										No field-level differences captured.
									</p>
								) : (
									(log.fieldChanges ?? []).map((change) => (
										<div
											key={`${log.id}-${change.field}`}
											className="rounded border p-2 text-xs"
										>
											<p className="font-medium">{change.field}</p>
												<p className="text-muted-foreground">
													Old:{" "}
													{JSON.stringify(
														change.oldValue,
													)}
												</p>
												<p className="text-muted-foreground">
													New:{" "}
													{JSON.stringify(
														change.newValue,
													)}
												</p>
										</div>
									))
								)}
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</PageWrapper>
	);
}
