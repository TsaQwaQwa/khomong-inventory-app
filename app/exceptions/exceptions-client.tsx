"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
	AlertCircle,
	AlertTriangle,
	PackageX,
	Tag,
	Users,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { LoadingCards } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
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
import { formatZAR } from "@/lib/money";
import { cn } from "@/lib/utils";

type ExceptionsSummary = {
	asOfDate: string;
	counts: {
		outOfStock: number;
		negativeStock: number;
		noPrice: number;
		overdueTabs: number;
	};
	outOfStock: Array<{
		productId: string;
		productName: string;
		currentUnits: number;
	}>;
	negativeStock: Array<{
		productId: string;
		productName: string;
		currentUnits: number;
	}>;
	noPrice: Array<{
		productId: string;
		productName: string;
	}>;
	overdueTabs: Array<{
		customerId: string;
		customerName: string;
		balanceCents: number;
		dueDate: string;
	}>;
};

const fetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(
			json?.error?.message ??
				json?.error ??
				"Failed to fetch exceptions",
		);
	}
	return (json?.data ?? json) as ExceptionsSummary;
};

export function ExceptionsClient() {
	const { data, error, isLoading } = useSWR<ExceptionsSummary>(
		"/api/exceptions/summary",
		fetcher,
	);

	const totalExceptions =
		(data?.counts.outOfStock ?? 0) +
		(data?.counts.negativeStock ?? 0) +
		(data?.counts.noPrice ?? 0) +
		(data?.counts.overdueTabs ?? 0);

	return (
		<PageWrapper
			title="Exceptions Dashboard"
			description="Actionable issues that need attention now."
		>
			{isLoading ? (
				<LoadingCards />
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						{error.message}
					</AlertDescription>
				</Alert>
			) : !data ? (
				<EmptyState
					title="No data"
					description="Could not load exception data."
				/>
			) : (
				<div className="space-y-6">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<CountCard
							title="Out Of Stock"
							value={data.counts.outOfStock}
							icon={PackageX}
							tone="danger"
						/>
						<CountCard
							title="Negative Stock"
							value={data.counts.negativeStock}
							icon={AlertTriangle}
							tone="danger"
						/>
						<CountCard
							title="No Price"
							value={data.counts.noPrice}
							icon={Tag}
							tone="warn"
						/>
						<CountCard
							title="Overdue Tabs"
							value={data.counts.overdueTabs}
							icon={Users}
							tone="warn"
						/>
					</div>

					{totalExceptions === 0 ? (
						<EmptyState
							title="No exceptions"
							description={`Everything looks good as of ${data.asOfDate}.`}
						/>
					) : (
						<div className="grid gap-4 lg:grid-cols-2">
							<ListCard
								title="Out of Stock"
								rows={data.outOfStock.map((item) => ({
									id: item.productId,
									primary: item.productName,
									secondary: `${item.currentUnits} on hand`,
									actionLabel: "View Product",
									actionHref: `/products?productId=${item.productId}`,
								}))}
							/>
							<ListCard
								title="Negative Stock"
								rows={data.negativeStock.map((item) => ({
									id: item.productId,
									primary: item.productName,
									secondary: `${item.currentUnits} on hand`,
									actionLabel: "View Product",
									actionHref: `/products?productId=${item.productId}`,
								}))}
							/>
							<ListCard
								title="Missing Price"
								rows={data.noPrice.map((item) => ({
									id: item.productId,
									primary: item.productName,
									secondary: "No active price",
									actionLabel: "Set Price",
									actionHref: `/products?productId=${item.productId}`,
								}))}
							/>
							<ListCard
								title="Overdue Tabs"
								rows={data.overdueTabs.map((item) => ({
									id: item.customerId,
									primary: item.customerName,
									secondary: `${formatZAR(item.balanceCents)} due since ${item.dueDate}`,
									actionLabel: "Open Account",
									actionHref: `/tabs?customerId=${item.customerId}`,
								}))}
							/>
						</div>
					)}
				</div>
			)}
		</PageWrapper>
	);
}

function CountCard({
	title,
	value,
	icon: Icon,
	tone,
}: {
	title: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
	tone: "danger" | "warn";
}) {
	return (
		<Card className="shadow-md">
			<CardContent className="pt-5">
				<div className="flex items-center justify-between gap-2">
					<div>
						<p className="text-xs text-muted-foreground">
							{title}
						</p>
						<p
							className={cn(
								"text-2xl font-bold",
								tone === "danger"
									? "text-destructive"
									: "text-amber-700",
							)}
						>
							{value}
						</p>
					</div>
					<Icon
						className={cn(
							"h-5 w-5",
							tone === "danger"
								? "text-destructive"
								: "text-amber-600",
						)}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function ListCard({
	title,
	rows,
}: {
	title: string;
	rows: Array<{
		id: string;
		primary: string;
		secondary: string;
		actionLabel: string;
		actionHref: string;
	}>;
}) {
	return (
		<Card className="shadow-md">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						None
					</p>
				) : (
					<div className="space-y-2">
						{rows.map((row) => (
							<div
								key={row.id}
								className="rounded-lg border p-2"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<p className="text-sm font-medium">
											{row.primary}
										</p>
										<p className="text-xs text-muted-foreground">
											{row.secondary}
										</p>
									</div>
									<Link
										href={row.actionHref}
										className="shrink-0 rounded border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									>
										{row.actionLabel}
									</Link>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
