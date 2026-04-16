"use client";
/* eslint-disable max-len */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
	Plus,
	Trash2,
	AlertCircle,
	Users,
	Receipt,
	Pencil,
	RotateCcw,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DateRangeControls } from "@/components/date-range-controls";
import {
	LoadingTable,
	LoadingForm,
} from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { CustomerSelect } from "@/components/customer-select";
import { MoneyInput } from "@/components/money-input";
import { CashChangeCalculator } from "@/components/cash-change-calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-utils";
import { postTabPaymentWithOfflineQueue } from "@/lib/offline-sales-queue";
import { formatZAR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useGlobalDateRangeQuery } from "@/lib/use-global-date-range-query";
import type {
	Product,
	Customer,
	PaymentMethod,
} from "@/lib/types";

const fetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		const message =
			json?.error?.message ??
			json?.error ??
			"Failed to fetch data";
		throw new Error(message);
	}
	return json?.data ?? json;
};

const getApiErrorMessage = (
	payload: unknown,
	fallback: string,
) => {
	if (!payload || typeof payload !== "object")
		return fallback;

	const maybePayload = payload as Record<
		string,
		unknown
	>;
	const maybeError = maybePayload.error;

	if (typeof maybeError === "string") {
		return maybeError;
	}

	if (
		maybeError &&
		typeof maybeError === "object"
	) {
		const maybeErrorObj = maybeError as Record<
			string,
			unknown
		>;
		if (
			typeof maybeErrorObj.message === "string"
		) {
			return maybeErrorObj.message;
		}
	}

	return fallback;
};

interface TabTransactionHistory {
	id: string;
	date: string | null;
	customerId: string | null;
	customerName: string;
	type:
		| "CHARGE"
		| "PAYMENT"
		| "ADJUSTMENT"
		| "EXPENSE"
		| "DIRECT_SALE";
	amountCents: number;
	manualAmountCents?: number;
	paymentMethod?: PaymentMethod;
	cashReceivedCents?: number;
	changeCents?: number;
	note?: string;
	reason?: string;
	expenseCategory?: string;
	payee?: string;
	reference?: string;
	createdAt?: string;
	items?: {
		productId: string;
		units: number;
	}[];
	reversalOfId?: string;
	reversalReason?: string;
	isReversal?: boolean;
	isReversed?: boolean;
}

interface TabsClientProps {
	view?: "both" | "accounts" | "transactions";
}

interface CustomerStatementResponse {
	customer: {
		id: string;
		name: string;
		phone: string | null;
	};
	range: {
		from: string;
		to: string;
	};
	summary: {
		chargesCents: number;
		paymentsCents: number;
		adjustmentsCents: number;
		balanceCents: number;
	};
	ledger: Array<{
		id: string;
		date: string | null;
		type: "CHARGE" | "PAYMENT" | "ADJUSTMENT";
		amountCents: number;
		signedAmountCents: number;
		paymentMethod: PaymentMethod | null;
		reference: string | null;
		note: string | null;
		createdAt: string | null;
	}>;
	reminderText: string;
}

const timeFormatter = new Intl.DateTimeFormat(
	undefined,
	{
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	},
);

const dateFormatter = new Intl.DateTimeFormat(
	undefined,
	{
		year: "numeric",
		month: "short",
		day: "numeric",
	},
);

const relativeTimeFormatter =
	new Intl.RelativeTimeFormat(undefined, {
		numeric: "always",
	});

const formatRelativeFromNow = (
	date: Date,
	now: Date,
) => {
	const diffMs = now.getTime() - date.getTime();
	if (diffMs < 60_000) return "just now";

	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 60) {
		return relativeTimeFormatter.format(
			-minutes,
			"minute",
		);
	}

	const hours = Math.floor(minutes / 60);
	return relativeTimeFormatter.format(
		-hours,
		"hour",
	);
};

const formatTransactionHistoryTime = (
	createdAt?: string,
) => {
	if (!createdAt) return "-";
	const created = new Date(createdAt);
	if (Number.isNaN(created.getTime())) return "-";

	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	const startOfYesterday = new Date(
		startOfToday.getTime() - 24 * 60 * 60 * 1000,
	);

	if (created >= startOfToday) {
		return formatRelativeFromNow(created, now);
	}

	if (
		created >= startOfYesterday &&
		created < startOfToday
	) {
		return `Yesterday ${timeFormatter.format(created)}`;
	}

	return `${dateFormatter.format(created)} ${timeFormatter.format(created)}`;
};

const getTransactionTypeLabel = (
	type: TabTransactionHistory["type"],
) => {
	switch (type) {
		case "PAYMENT":
			return "Payment";
		case "EXPENSE":
			return "Expense";
		case "ADJUSTMENT":
			return "Adjustment";
		case "DIRECT_SALE":
			return "Legacy Direct Sale";
		case "CHARGE":
			return "Legacy Account Charge";
	}
};

export function TabsClient({
	view = "both",
}: TabsClientProps) {
	const searchParams = useSearchParams();
	const {
		from,
		to: date,
		preset,
		onPresetChange,
		onFromChange,
		onToChange,
		onRangeChange,
	} = useGlobalDateRangeQuery();
	const isAccountsOnly = view === "accounts";
	const isTransactionsOnly =
		view === "transactions";
	const { mutate: mutateGlobal } = useSWRConfig();

	const {
		data: customers,
		error: customersError,
		isLoading: customersLoading,
		mutate: mutateCustomers,
	} = useSWR<Customer[]>(
		"/api/customers",
		fetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);

	const { data: access } = useSWR<{
		isAdmin: boolean;
	}>("/api/session/access", fetcher);
	const isAdmin = access?.isAdmin ?? false;

	const {
		data: products,
		error: productsError,
		isLoading: productsLoading,
	} = useSWR<Product[]>(
		"/api/products",
		fetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);

	const {
		data: transactionsHistory,
		error: transactionsError,
		isLoading: transactionsLoading,
		mutate: mutateTransactions,
	} = useSWR<TabTransactionHistory[]>(
		`/api/transactions?from=${from}&to=${date}&limit=200`,
		fetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);

	const refreshConnectedViews =
		React.useCallback(async () => {
			await Promise.all([
				mutateTransactions(),
				mutateCustomers(),
				mutateGlobal(
					(key) =>
						typeof key === "string" &&
						(key.startsWith("/api/reports") ||
							key.startsWith(
								"/api/transactions",
							) ||
							key.startsWith("/api/customers") ||
							key.startsWith("/api/tabs") ||
							key.startsWith("/api/products") ||
							key.startsWith("/api/exceptions") ||
							key.startsWith("/api/header")),
				),
			]);
		}, [
			mutateCustomers,
			mutateGlobal,
			mutateTransactions,
		]);

	const normalizedProducts = React.useMemo(
		() =>
			Array.isArray(products) ? products : [],
		[products],
	);
	const normalizedCustomers = React.useMemo(
		() =>
			Array.isArray(customers) ? customers : [],
		[customers],
	);
	const normalizedTransactions = React.useMemo(
		() =>
			Array.isArray(transactionsHistory)
				? transactionsHistory
				: [],
		[transactionsHistory],
	);

	const selectedCustomerId =
		searchParams.get("customerId");
	const customerFilter = searchParams.get(
		"customerFilter",
	);
	const action = searchParams.get("action");

	const displayedCustomers = React.useMemo(() => {
		const baseList =
			customerFilter === "overdue"
				? normalizedCustomers.filter((customer) =>
						Boolean(customer.isOverdue),
					)
				: normalizedCustomers;

		if (!selectedCustomerId) return baseList;

		const selected = normalizedCustomers.find(
			(customer) =>
				customer.id === selectedCustomerId,
		);

		return selected ? [selected] : baseList;
	}, [
		customerFilter,
		normalizedCustomers,
		selectedCustomerId,
	]);

	const [transactionQuery, setTransactionQuery] =
		React.useState("");
	const [addCustomerOpen, setAddCustomerOpen] =
		React.useState(false);
	const [editingCustomer, setEditingCustomer] =
		React.useState<Customer | null>(null);
	const [
		paymentDialogOpen,
		setPaymentDialogOpen,
	] = React.useState(false);
	const [
		statementCustomerId,
		setStatementCustomerId,
	] = React.useState("");
	const [statementLoading, setStatementLoading] =
		React.useState(false);
	const [
		deletingCustomerId,
		setDeletingCustomerId,
	] = React.useState<string | null>(null);
	const [
		pendingDeleteCustomer,
		setPendingDeleteCustomer,
	] = React.useState<Customer | null>(null);
	const [historyDetailTxn, setHistoryDetailTxn] =
		React.useState<TabTransactionHistory | null>(
			null,
		);
	const [reversingTxn, setReversingTxn] =
		React.useState<TabTransactionHistory | null>(
			null,
		);
	const [reverseReason, setReverseReason] =
		React.useState("");
	const [reverseLoading, setReverseLoading] =
		React.useState(false);

	React.useEffect(() => {
		const qsQuery = searchParams.get("q");
		setTransactionQuery(qsQuery ?? "");
	}, [searchParams]);

	React.useEffect(() => {
		if (
			selectedCustomerId &&
			normalizedCustomers.some(
				(customer) =>
					customer.id === selectedCustomerId,
			)
		) {
			setStatementCustomerId(selectedCustomerId);
			return;
		}
		if (
			!statementCustomerId &&
			normalizedCustomers[0]
		) {
			setStatementCustomerId(
				normalizedCustomers[0].id,
			);
		}
	}, [
		normalizedCustomers,
		selectedCustomerId,
		statementCustomerId,
	]);

	React.useEffect(() => {
		if (!isTransactionsOnly) return;
		if (action === "account-payment") {
			setPaymentDialogOpen(true);
		}
	}, [action, isTransactionsOnly]);

	const productNameById = React.useMemo(
		() =>
			new Map(
				normalizedProducts.map((product) => [
					product.id,
					product.name,
				]),
			),
		[normalizedProducts],
	);

	const filteredTransactions =
		React.useMemo(() => {
			const normalizedQuery = transactionQuery
				.trim()
				.toLowerCase();

			return normalizedTransactions.filter(
				(txn) => {
					if (
						selectedCustomerId &&
						txn.customerId !== selectedCustomerId
					) {
						return false;
					}

					if (!normalizedQuery) {
						return true;
					}

					const productNames = (txn.items ?? [])
						.map((item) =>
							productNameById.get(item.productId),
						)
						.filter(Boolean)
						.join(" ")
						.toLowerCase();

					const searchable = [
						txn.customerName,
						getTransactionTypeLabel(txn.type),
						txn.payee,
						txn.expenseCategory,
						txn.reference,
						txn.reason,
						txn.note,
						txn.paymentMethod,
						formatZAR(txn.amountCents),
						productNames,
					]
						.filter(Boolean)
						.join(" ")
						.toLowerCase();

					return searchable.includes(
						normalizedQuery,
					);
				},
			);
		}, [
			normalizedTransactions,
			productNameById,
			selectedCustomerId,
			transactionQuery,
		]);

	const transactionSearchOptions =
		React.useMemo(() => {
			const options = new Set<string>([
				"Payment",
				"Expense",
				"Adjustment",
				"Legacy Direct Sale",
				"Legacy Account Charge",
			]);

			for (const customer of normalizedCustomers) {
				options.add(customer.name);
			}

			for (const product of normalizedProducts) {
				options.add(product.name);
				if (product.barcode) {
					options.add(String(product.barcode));
				}
			}

			for (const txn of normalizedTransactions) {
				if (txn.reference) {
					options.add(txn.reference);
				}
				if (txn.payee) {
					options.add(txn.payee);
				}
			}

			return Array.from(options).slice(0, 200);
		}, [
			normalizedCustomers,
			normalizedProducts,
			normalizedTransactions,
		]);

	const openHistoryDetails = React.useCallback(
		(txn: TabTransactionHistory) => {
			setHistoryDetailTxn(txn);
		},
		[],
	);

	const handleReverseTransaction = async () => {
		if (!reversingTxn) return;

		setReverseLoading(true);
		try {
			const res = await fetch(
				"/api/transactions/reverse",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						transactionId: reversingTxn.id,
						type: reversingTxn.type,
						reason: reverseReason.trim(),
					}),
				},
			);

			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to reverse transaction",
					),
				);
			}

			toast.success("Transaction reversed");
			setReversingTxn(null);
			setReverseReason("");
			await refreshConnectedViews();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to reverse transaction",
			);
		} finally {
			setReverseLoading(false);
		}
	};

	const handleDeleteCustomer = React.useCallback(
		async (customer: Customer) => {
			setDeletingCustomerId(customer.id);
			try {
				const res = await fetch(
					`/api/customers/${customer.id}`,
					{
						method: "DELETE",
					},
				);
				const body = await res
					.json()
					.catch(() => ({}));
				if (!res.ok) {
					throw new Error(
						getApiErrorMessage(
							body,
							"Failed to delete customer",
						),
					);
				}
				toast.success("Customer deleted");
				await refreshConnectedViews();
				setPendingDeleteCustomer(null);
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to delete customer",
				);
			} finally {
				setDeletingCustomerId(null);
			}
		},
		[refreshConnectedViews],
	);

	const fetchCustomerStatement = async () => {
		if (!statementCustomerId) {
			toast.error("Select a customer first");
			return null;
		}
		setStatementLoading(true);
		try {
			const res = await fetch(
				`/api/customers/${statementCustomerId}/statement?from=${from}&to=${date}`,
			);
			const body = await res
				.json()
				.catch(() => ({}));
			if (!res.ok) {
				throw new Error(
					getApiErrorMessage(
						body,
						"Failed to load customer statement",
					),
				);
			}
			return (body?.data ??
				body) as CustomerStatementResponse;
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to load customer statement",
			);
			return null;
		} finally {
			setStatementLoading(false);
		}
	};

	const exportStatementCsv = async () => {
		const statement =
			await fetchCustomerStatement();
		if (!statement) return;

		const rows = [
			[
				"Date",
				"Type",
				"Amount",
				"Signed Amount",
				"Payment Method",
				"Reference",
				"Note",
			],
			...statement.ledger.map((row) => [
				row.date ?? "",
				row.type,
				String(row.amountCents),
				String(row.signedAmountCents),
				row.paymentMethod ?? "",
				row.reference ?? "",
				row.note ?? "",
			]),
		];

		const csv = rows
			.map((row) =>
				row
					.map(
						(cell) =>
							`"${String(cell).replaceAll('"', '""')}"`,
					)
					.join(","),
			)
			.join("\n");

		const blob = new Blob([csv], {
			type: "text/csv;charset=utf-8",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `statement_${statement.customer.name.replaceAll(
			/\s+/g,
			"_",
		)}_${statement.range.from}_to_${statement.range.to}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	};

	const exportStatementPdf = async () => {
		const statement =
			await fetchCustomerStatement();
		if (!statement) return;

		const htmlRows = statement.ledger
			.map(
				(row) =>
					`<tr><td>${row.date ?? ""}</td><td>${row.type}</td><td>${formatZAR(row.signedAmountCents)}</td><td>${row.paymentMethod ?? "-"}</td><td>${row.reference ?? "-"}</td><td>${row.note ?? "-"}</td></tr>`,
			)
			.join("");

		const printWindow = window.open(
			"",
			"_blank",
			"width=900,height=700",
		);
		if (!printWindow) {
			toast.error("Could not open print window");
			return;
		}

		printWindow.document.write(`
			<html>
				<head>
					<title>Statement - ${statement.customer.name}</title>
					<style>
						body { font-family: Arial, sans-serif; padding: 16px; }
						table { width: 100%; border-collapse: collapse; margin-top: 12px; }
						th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
						h1 { font-size: 18px; margin: 0 0 8px 0; }
						p { margin: 4px 0; }
					</style>
				</head>
				<body>
					<h1>Customer Statement</h1>
					<p><strong>Customer:</strong> ${statement.customer.name}</p>
					<p><strong>Period:</strong> ${statement.range.from} to ${statement.range.to}</p>
					<p><strong>Balance:</strong> ${formatZAR(statement.summary.balanceCents)}</p>
					<table>
						<thead>
							<tr><th>Date</th><th>Type</th><th>Amount</th><th>Method</th><th>Reference</th><th>Note</th></tr>
						</thead>
						<tbody>${htmlRows}</tbody>
					</table>
				</body>
			</html>
		`);
		printWindow.document.close();
		printWindow.focus();
		printWindow.print();
	};

	const copyReminderText = async () => {
		const statement =
			await fetchCustomerStatement();
		if (!statement) return;

		try {
			await navigator.clipboard.writeText(
				statement.reminderText,
			);
			toast.success(
				"WhatsApp reminder text copied",
			);
		} catch {
			toast.error("Failed to copy reminder text");
		}
	};

	return (
		<PageWrapper
			title={
				isTransactionsOnly
					? "Transactions"
					: "Customer Accounts"
			}
			description={
				isTransactionsOnly
					? "Review payments, expenses, adjustments, reversals, and legacy transaction history."
					: "Track customer balances, statements, and account settings."
			}
			actions={
				isAccountsOnly ? undefined : (
					<DateRangeControls
						from={from}
						to={date}
						preset={preset}
						onPresetChange={onPresetChange}
						onFromChange={onFromChange}
						onToChange={onToChange}
						onRangeChange={onRangeChange}
					/>
				)
			}
		>
			<Tabs
				defaultValue={
					isTransactionsOnly
						? "transactions"
						: "customers"
				}
				className="space-y-6"
			>
				{view === "both" && (
					<TabsList className="grid w-full max-w-md grid-cols-2">
						<TabsTrigger
							value="customers"
							className="flex items-center gap-2"
						>
							<Users className="h-4 w-4" />
							Accounts
						</TabsTrigger>
						<TabsTrigger
							value="transactions"
							className="flex items-center gap-2"
						>
							<Receipt className="h-4 w-4" />
							Transactions
						</TabsTrigger>
					</TabsList>
				)}

				{!isTransactionsOnly && (
					<TabsContent value="customers">
						{customersLoading ? (
							<LoadingTable />
						) : customersError ? (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>
									{customersError.message}
								</AlertDescription>
							</Alert>
						) : (
							<>
								<div className="mb-4 flex justify-end">
									<Button
										type="button"
										onClick={() =>
											setAddCustomerOpen(true)
										}
									>
										<Plus className="mr-2 h-4 w-4" />
										Add Customer
									</Button>
								</div>

								<Card className="mb-4 shadow-sm">
									<CardHeader className="pb-2">
										<CardTitle className="text-base">
											Statements & Reminders
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3">
										<CustomerSelect
											customers={
												normalizedCustomers
											}
											value={statementCustomerId}
											onChange={
												setStatementCustomerId
											}
											label="Customer"
										/>
										<div className="grid gap-2 sm:grid-cols-3">
											<Button
												type="button"
												variant="outline"
												disabled={
													statementLoading ||
													!statementCustomerId
												}
												onClick={
													exportStatementCsv
												}
											>
												Export CSV
											</Button>
											<Button
												type="button"
												variant="outline"
												disabled={
													statementLoading ||
													!statementCustomerId
												}
												onClick={
													exportStatementPdf
												}
											>
												Export PDF
											</Button>
											<Button
												type="button"
												variant="outline"
												disabled={
													statementLoading ||
													!statementCustomerId
												}
												onClick={copyReminderText}
											>
												Copy WhatsApp
											</Button>
										</div>
									</CardContent>
								</Card>

								{displayedCustomers.length ===
								0 ? (
									<EmptyState
										icon={
											<Users className="h-8 w-8 text-muted-foreground" />
										}
										title="No customer accounts yet"
										description="Add your first customer to start tracking balances."
									/>
								) : (
									<Card className="shadow-lg">
										<CardContent className="pt-6">
											<div className="space-y-3 md:hidden">
												{displayedCustomers.map(
													(customer) => {
														const balanceCents =
															customer.balanceCents ??
															0;
														const hasBalance =
															balanceCents > 0;
														const canDeleteCustomer =
															isAdmin &&
															!hasBalance;
														const dueDateLabel =
															customer.dueDate
																? formatDateDisplay(
																		customer.dueDate,
																	)
																: "-";

														return (
															<div
																key={customer.id}
																className="rounded-lg border p-3"
															>
																<div className="flex items-start justify-between gap-2">
																	<div>
																		<div className="flex items-center gap-2">
																			<p className="font-medium">
																				{
																					customer.name
																				}
																			</p>
																			{customer.isTemporaryTab && (
																				<span className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
																					Temp Tab
																				</span>
																			)}
																			{customer.customerMode ===
																				"DEBT_ONLY" && (
																				<span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
																					Debt-only
																				</span>
																			)}
																		</div>
																		<p className="text-xs text-muted-foreground">
																			{customer.phone ??
																				"No phone"}
																		</p>
																	</div>
																	<div className="flex items-center gap-2">
																		<Button
																			type="button"
																			size="sm"
																			variant="outline"
																			onClick={() =>
																				setEditingCustomer(
																					customer,
																				)
																			}
																		>
																			<Pencil className="mr-2 h-3.5 w-3.5" />
																			Edit
																		</Button>
																		{canDeleteCustomer && (
																			<Button
																				type="button"
																				size="sm"
																				variant="destructive"
																				disabled={
																					deletingCustomerId ===
																					customer.id
																				}
																				onClick={() =>
																					setPendingDeleteCustomer(
																						customer,
																					)
																				}
																			>
																				<Trash2 className="mr-2 h-3.5 w-3.5" />
																				Delete
																			</Button>
																		)}
																	</div>
																</div>
																<div className="mt-3 grid grid-cols-2 gap-2 text-sm">
																	<div>
																		<p className="text-muted-foreground">
																			Limit
																		</p>
																		<p>
																			{customer.customerMode ===
																			"DEBT_ONLY"
																				? "Not enforced"
																				: formatZAR(
																						customer.creditLimitCents,
																					)}
																		</p>
																	</div>
																	<div className="text-right">
																		<p className="text-muted-foreground">
																			Owing
																		</p>
																		<p
																			className={cn(
																				hasBalance &&
																					"text-destructive font-medium",
																			)}
																		>
																			{formatZAR(
																				balanceCents,
																			)}
																		</p>
																	</div>
																</div>
																<div className="mt-2 flex items-center justify-between text-xs">
																	<span className="text-muted-foreground">
																		Due:{" "}
																		{dueDateLabel}
																	</span>
																	{customer.isOverdue &&
																		hasBalance && (
																			<span className="rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
																				Overdue
																			</span>
																		)}
																</div>
															</div>
														);
													},
												)}
											</div>

											<div className="hidden md:block">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>
																Name
															</TableHead>
															<TableHead>
																Phone
															</TableHead>
															<TableHead className="text-right">
																Credit Limit
															</TableHead>
															<TableHead className="text-right">
																Owing
															</TableHead>
															<TableHead>
																Due Date
															</TableHead>
															<TableHead>
																Note
															</TableHead>
															<TableHead className="text-right">
																Actions
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{displayedCustomers.map(
															(customer) => {
																const balanceCents =
																	customer.balanceCents ??
																	0;
																const hasBalance =
																	balanceCents >
																	0;
																const canDeleteCustomer =
																	isAdmin &&
																	!hasBalance;
																const dueDateLabel =
																	customer.dueDate
																		? formatDateDisplay(
																				customer.dueDate,
																			)
																		: "-";

																return (
																	<TableRow
																		key={
																			customer.id
																		}
																	>
																		<TableCell className="font-medium">
																			<div className="flex items-center gap-2">
																				{
																					customer.name
																				}
																				{customer.isTemporaryTab && (
																					<span className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
																						Temp
																						Tab
																					</span>
																				)}
																				{customer.customerMode ===
																					"DEBT_ONLY" && (
																					<span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
																						Debt-only
																					</span>
																				)}
																			</div>
																		</TableCell>
																		<TableCell>
																			{customer.phone ??
																				"-"}
																		</TableCell>
																		<TableCell className="text-right">
																			{customer.customerMode ===
																			"DEBT_ONLY"
																				? "Not enforced"
																				: formatZAR(
																						customer.creditLimitCents,
																					)}
																		</TableCell>
																		<TableCell
																			className={cn(
																				"text-right font-medium",
																				hasBalance &&
																					"text-destructive",
																			)}
																		>
																			{formatZAR(
																				balanceCents,
																			)}
																		</TableCell>
																		<TableCell>
																			<div className="flex items-center gap-2">
																				<span className="text-muted-foreground">
																					{
																						dueDateLabel
																					}
																				</span>
																				{customer.isOverdue &&
																					hasBalance && (
																						<span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
																							Overdue
																						</span>
																					)}
																			</div>
																		</TableCell>
																		<TableCell className="max-w-50 truncate text-muted-foreground">
																			{customer.note ??
																				"-"}
																		</TableCell>
																		<TableCell className="text-right">
																			<div className="flex items-center justify-end gap-2">
																				<Button
																					type="button"
																					size="sm"
																					variant="outline"
																					onClick={() =>
																						setEditingCustomer(
																							customer,
																						)
																					}
																				>
																					<Pencil className="mr-2 h-3.5 w-3.5" />
																					Edit
																				</Button>
																				{canDeleteCustomer && (
																					<Button
																						type="button"
																						size="sm"
																						variant="destructive"
																						disabled={
																							deletingCustomerId ===
																							customer.id
																						}
																						onClick={() =>
																							setPendingDeleteCustomer(
																								customer,
																							)
																						}
																					>
																						<Trash2 className="mr-2 h-3.5 w-3.5" />
																						Delete
																					</Button>
																				)}
																			</div>
																		</TableCell>
																	</TableRow>
																);
															},
														)}
													</TableBody>
												</Table>
											</div>
										</CardContent>
									</Card>
								)}
							</>
						)}
					</TabsContent>
				)}

				{!isAccountsOnly && (
					<TabsContent value="transactions">
						{productsLoading ||
						customersLoading ? (
							<LoadingForm />
						) : productsError ||
						  customersError ||
						  transactionsError ? (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>
									{productsError?.message ??
										customersError?.message ??
										transactionsError?.message ??
										"Failed to load data"}
								</AlertDescription>
							</Alert>
						) : (
							<>
								<Alert className="mb-4">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>
										Sale capture removed
									</AlertTitle>
									<AlertDescription>
										New sales are no longer
										captured from this page. Use
										stock counts, purchases, and
										adjustments for stock
										movement. Payments, expenses,
										reversals, and legacy
										transaction history remain
										here.
									</AlertDescription>
								</Alert>

								<div className="mb-4 flex flex-wrap justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											setPaymentDialogOpen(true)
										}
									>
										Add Payment
									</Button>
								</div>

								<Card className="mt-6 shadow-md">
									<CardHeader>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<CardTitle>
												Transaction History
											</CardTitle>
											<div className="w-full sm:w-[24rem]">
												<Input
													value={transactionQuery}
													onChange={(e) =>
														setTransactionQuery(
															e.target.value,
														)
													}
													list="transaction-search-options"
													placeholder="Search customer, product, reference, payee, or type"
												/>
												<datalist id="transaction-search-options">
													{transactionSearchOptions.map(
														(option) => (
															<option
																key={option}
																value={option}
															/>
														),
													)}
												</datalist>
												<p className="mt-1 text-[11px] text-muted-foreground">
													Search current and
													legacy transactions.
												</p>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										{transactionsLoading ? (
											<LoadingTable />
										) : !filteredTransactions.length ? (
											<p className="text-sm text-muted-foreground">
												No transactions found for
												this date range.
											</p>
										) : (
											<>
												<div className="space-y-3 md:hidden">
													{filteredTransactions.map(
														(txn) => (
															<div
																key={txn.id}
																role="button"
																tabIndex={0}
																className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
																onClick={() =>
																	openHistoryDetails(
																		txn,
																	)
																}
																onKeyDown={(
																	event,
																) => {
																	if (
																		event.key ===
																			"Enter" ||
																		event.key ===
																			" "
																	) {
																		event.preventDefault();
																		openHistoryDetails(
																			txn,
																		);
																	}
																}}
															>
																<div className="flex items-start justify-between gap-2">
																	<div>
																		<p className="font-medium">
																			{
																				txn.customerName
																			}
																		</p>
																		<p className="text-xs text-muted-foreground">
																			{formatTransactionHistoryTime(
																				txn.createdAt,
																			)}
																		</p>
																	</div>
																	<p className="font-semibold">
																		{formatZAR(
																			txn.amountCents,
																		)}
																	</p>
																</div>
																<div className="mt-2 flex items-center justify-between text-sm">
																	<span className="text-muted-foreground">
																		{getTransactionTypeLabel(
																			txn.type,
																		)}
																	</span>
																	<span className="text-muted-foreground">
																		{txn.paymentMethod ??
																			"-"}
																	</span>
																</div>
																{txn.paymentMethod ===
																	"CASH" && (
																	<p className="mt-1 text-xs text-muted-foreground">
																		Received{" "}
																		{typeof txn.cashReceivedCents ===
																		"number"
																			? formatZAR(
																					txn.cashReceivedCents,
																				)
																			: "-"}{" "}
																		| Change{" "}
																		{typeof txn.changeCents ===
																		"number"
																			? formatZAR(
																					txn.changeCents,
																				)
																			: "-"}
																	</p>
																)}
																{txn.payee && (
																	<p className="mt-1 text-xs text-muted-foreground">
																		Payee:{" "}
																		{txn.payee}
																	</p>
																)}
																{txn.expenseCategory && (
																	<p className="mt-1 text-xs text-muted-foreground">
																		Category:{" "}
																		{txn.expenseCategory.replaceAll(
																			"_",
																			" ",
																		)}
																	</p>
																)}
																{txn.reason && (
																	<p className="mt-1 text-xs text-muted-foreground">
																		Reason:{" "}
																		{txn.reason}
																	</p>
																)}
																<div className="mt-3 flex items-center justify-end gap-2">
																	{txn.isReversal && (
																		<span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
																			Reversal
																		</span>
																	)}
																	{txn.isReversed && (
																		<span className="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-700">
																			Reversed
																		</span>
																	)}
																	{!txn.isReversal &&
																		!txn.isReversed && (
																			<Button
																				type="button"
																				size="sm"
																				variant="outline"
																				onClick={(
																					event,
																				) => {
																					event.stopPropagation();
																					setReversingTxn(
																						txn,
																					);
																				}}
																			>
																				<RotateCcw className="mr-2 h-3.5 w-3.5" />
																				Reverse
																			</Button>
																		)}
																</div>
															</div>
														),
													)}
												</div>

												<div className="hidden md:block">
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>
																	Time
																</TableHead>
																<TableHead>
																	Customer
																</TableHead>
																<TableHead>
																	Type
																</TableHead>
																<TableHead className="text-right">
																	Amount
																</TableHead>
																<TableHead>
																	Details
																</TableHead>
																<TableHead className="text-right">
																	Actions
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{filteredTransactions.map(
																(txn) => (
																	<TableRow
																		key={txn.id}
																		className="cursor-pointer"
																		onClick={() =>
																			openHistoryDetails(
																				txn,
																			)
																		}
																	>
																		<TableCell className="text-muted-foreground">
																			{formatTransactionHistoryTime(
																				txn.createdAt,
																			)}
																		</TableCell>
																		<TableCell>
																			{
																				txn.customerName
																			}
																		</TableCell>
																		<TableCell>
																			{getTransactionTypeLabel(
																				txn.type,
																			)}
																		</TableCell>
																		<TableCell className="text-right">
																			{formatZAR(
																				txn.amountCents,
																			)}
																		</TableCell>
																		<TableCell className="text-muted-foreground">
																			<div className="space-y-0.5">
																				<p>
																					{txn.paymentMethod ??
																						"-"}
																				</p>
																				{txn.paymentMethod ===
																					"CASH" && (
																					<p className="text-xs">
																						Received{" "}
																						{typeof txn.cashReceivedCents ===
																						"number"
																							? formatZAR(
																									txn.cashReceivedCents,
																								)
																							: "-"}{" "}
																						|
																						Change{" "}
																						{typeof txn.changeCents ===
																						"number"
																							? formatZAR(
																									txn.changeCents,
																								)
																							: "-"}
																					</p>
																				)}
																				{txn.reference && (
																					<p className="max-w-48 truncate text-xs">
																						Ref:{" "}
																						{
																							txn.reference
																						}
																					</p>
																				)}
																				{txn.payee && (
																					<p className="max-w-48 truncate text-xs">
																						Payee:{" "}
																						{
																							txn.payee
																						}
																					</p>
																				)}
																				{txn.expenseCategory && (
																					<p className="max-w-48 truncate text-xs">
																						Category:{" "}
																						{txn.expenseCategory.replaceAll(
																							"_",
																							" ",
																						)}
																					</p>
																				)}
																				{txn.reason && (
																					<p className="max-w-48 truncate text-xs">
																						Reason:{" "}
																						{
																							txn.reason
																						}
																					</p>
																				)}
																				{txn.note && (
																					<p className="max-w-48 truncate text-xs">
																						{
																							txn.note
																						}
																					</p>
																				)}
																			</div>
																		</TableCell>
																		<TableCell className="text-right">
																			{txn.isReversal ? (
																				<span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
																					Reversal
																				</span>
																			) : txn.isReversed ? (
																				<span className="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-700">
																					Reversed
																				</span>
																			) : (
																				<Button
																					type="button"
																					size="sm"
																					variant="outline"
																					onClick={(
																						event,
																					) => {
																						event.stopPropagation();
																						setReversingTxn(
																							txn,
																						);
																					}}
																				>
																					<RotateCcw className="mr-2 h-3.5 w-3.5" />
																					Reverse
																				</Button>
																			)}
																		</TableCell>
																	</TableRow>
																),
															)}
														</TableBody>
													</Table>
												</div>
											</>
										)}
									</CardContent>
								</Card>
							</>
						)}
					</TabsContent>
				)}
			</Tabs>

			<Dialog
				open={addCustomerOpen}
				onOpenChange={setAddCustomerOpen}
			>
				<AddCustomerDialog
					onSuccess={() => {
						setAddCustomerOpen(false);
						void refreshConnectedViews();
					}}
				/>
			</Dialog>

			<Dialog
				open={Boolean(editingCustomer)}
				onOpenChange={(open) => {
					if (!open) {
						setEditingCustomer(null);
					}
				}}
			>
				{editingCustomer && (
					<EditCustomerDialog
						customer={editingCustomer}
						onSuccess={() => {
							setEditingCustomer(null);
							void refreshConnectedViews();
						}}
					/>
				)}
			</Dialog>

			<Dialog
				open={paymentDialogOpen}
				onOpenChange={setPaymentDialogOpen}
			>
				<DialogContent className="h-[70vh] w-[90vw] max-w-[90vw] overflow-hidden p-0 sm:max-w-[90vw]">
					<DialogHeader className="h-16 shrink-0 space-y-0.5 border-b px-4 py-1.5">
						<DialogTitle>
							Record Account Payment
						</DialogTitle>
						<DialogDescription className="text-xs leading-tight">
							Save a customer payment for{" "}
							{formatDateDisplay(date)}.
						</DialogDescription>
					</DialogHeader>
					<TabPaymentForm
						customers={normalizedCustomers}
						date={date}
						onSuccess={() => {
							void refreshConnectedViews();
							setPaymentDialogOpen(false);
						}}
					/>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(pendingDeleteCustomer)}
				onOpenChange={(open) => {
					if (!open) {
						setPendingDeleteCustomer(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Delete Customer
						</DialogTitle>
						<DialogDescription>
							Delete{" "}
							<strong>
								{pendingDeleteCustomer?.name}
							</strong>
							? This is only allowed when their
							balance is zero.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						</DialogClose>
						<Button
							type="button"
							variant="destructive"
							disabled={
								!pendingDeleteCustomer ||
								deletingCustomerId ===
									pendingDeleteCustomer.id
							}
							onClick={() => {
								if (!pendingDeleteCustomer)
									return;
								void handleDeleteCustomer(
									pendingDeleteCustomer,
								);
							}}
						>
							{pendingDeleteCustomer &&
							deletingCustomerId ===
								pendingDeleteCustomer.id
								? "Deleting..."
								: "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(historyDetailTxn)}
				onOpenChange={(open) => {
					if (!open) {
						setHistoryDetailTxn(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Transaction Details
						</DialogTitle>
						<DialogDescription>
							{historyDetailTxn?.customerName} at{" "}
							{formatTransactionHistoryTime(
								historyDetailTxn?.createdAt,
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="rounded-md border p-3 text-sm">
							<p>
								Type:{" "}
								{historyDetailTxn
									? getTransactionTypeLabel(
											historyDetailTxn.type,
										)
									: "-"}
							</p>
							<p>
								Amount:{" "}
								{formatZAR(
									historyDetailTxn?.amountCents ??
										0,
								)}
							</p>
							{typeof historyDetailTxn?.manualAmountCents ===
								"number" &&
							historyDetailTxn.manualAmountCents >
								0 ? (
								<p>
									Extra owed:{" "}
									{formatZAR(
										historyDetailTxn.manualAmountCents,
									)}
								</p>
							) : null}
							{historyDetailTxn?.paymentMethod && (
								<p>
									Payment Method:{" "}
									{historyDetailTxn.paymentMethod}
								</p>
							)}
							{historyDetailTxn?.reference && (
								<p>
									Reference:{" "}
									{historyDetailTxn.reference}
								</p>
							)}
							{historyDetailTxn?.reason && (
								<p>
									Reason:{" "}
									{historyDetailTxn.reason}
								</p>
							)}
							{historyDetailTxn?.payee && (
								<p>
									Payee: {historyDetailTxn.payee}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<p className="text-sm font-medium">
								Items
							</p>
							{(historyDetailTxn?.items ?? [])
								.length > 0 ? (
								<div className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-3">
									{(historyDetailTxn?.items ?? [])
										.filter(
											(item) =>
												(item.units ?? 0) > 0,
										)
										.map((item, index) => (
											<div
												key={`${item.productId}-${index}`}
												className="flex items-center justify-between text-sm"
											>
												<span className="truncate pr-2">
													{productNameById.get(
														item.productId,
													) ?? "Unknown product"}
												</span>
												<span className="text-muted-foreground">
													x{item.units}
												</span>
											</div>
										))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									No items on this transaction.
								</p>
							)}
						</div>

						{historyDetailTxn?.note && (
							<div className="space-y-2">
								<p className="text-sm font-medium">
									Note
								</p>
								<div className="rounded-md border p-3 text-sm text-muted-foreground">
									{historyDetailTxn.note}
								</div>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(reversingTxn)}
				onOpenChange={(open) => {
					if (!open) {
						setReversingTxn(null);
						setReverseReason("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Reverse Transaction
						</DialogTitle>
						<DialogDescription>
							This creates a new compensating
							entry and keeps audit history.
							Provide a reason for the reversal.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="rounded-md border p-3 text-sm">
							<p className="font-medium">
								{reversingTxn?.customerName}
							</p>
							<p className="text-muted-foreground">
								Amount:{" "}
								{formatZAR(
									reversingTxn?.amountCents ?? 0,
								)}
							</p>
						</div>
						<div className="space-y-2">
							<Label>Reason</Label>
							<Textarea
								value={reverseReason}
								onChange={(e) =>
									setReverseReason(e.target.value)
								}
								placeholder="Reason for reversal..."
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						</DialogClose>
						<Button
							type="button"
							disabled={
								reverseLoading ||
								reverseReason.trim().length < 3
							}
							onClick={handleReverseTransaction}
						>
							{reverseLoading
								? "Reversing..."
								: "Reverse"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageWrapper>
	);
}

function AddCustomerDialog({
	onSuccess,
}: {
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [formData, setFormData] = React.useState({
		name: "",
		phone: "",
		note: "",
		customerMode: "ACCOUNT" as
			| "ACCOUNT"
			| "DEBT_ONLY",
		openingBalanceCents: 0,
		creditLimitCents: 0,
		dueDays: "",
	});

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		try {
			const res = await fetch("/api/customers", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: formData.name,
					phone:
						formData.phone.trim() || undefined,
					note: formData.note || undefined,
					customerMode: formData.customerMode,
					openingBalanceCents:
						formData.openingBalanceCents,
					creditLimitCents:
						formData.customerMode === "ACCOUNT"
							? formData.creditLimitCents
							: 0,
					dueDays: formData.dueDays
						? formData.customerMode === "ACCOUNT"
							? parseInt(formData.dueDays, 10)
							: undefined
						: undefined,
				}),
			});

			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to add customer",
					),
				);
			}

			toast.success("Customer account added");
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to add customer",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Add Customer</DialogTitle>
				<DialogDescription>
					Create a customer account for balances
					and payments.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) =>
								setFormData({
									...formData,
									name: e.target.value,
								})
							}
							placeholder="John Doe"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="customerMode">
							Customer Type
						</Label>
						<Select
							value={formData.customerMode}
							onValueChange={(value) =>
								setFormData({
									...formData,
									customerMode: value as
										| "ACCOUNT"
										| "DEBT_ONLY",
								})
							}
						>
							<SelectTrigger id="customerMode">
								<SelectValue placeholder="Select customer type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ACCOUNT">
									Account Customer
								</SelectItem>
								<SelectItem value="DEBT_ONLY">
									Debt-only Customer
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="phone">
							Phone (optional)
						</Label>
						<Input
							id="phone"
							type="tel"
							value={formData.phone}
							onChange={(e) =>
								setFormData({
									...formData,
									phone: e.target.value,
								})
							}
							placeholder="072 123 4567"
						/>
					</div>
					<MoneyInput
						label="Opening Owing Amount"
						value={formData.openingBalanceCents}
						onChange={(v) =>
							setFormData({
								...formData,
								openingBalanceCents: v,
							})
						}
					/>
					{formData.customerMode ===
						"ACCOUNT" && (
						<>
							<MoneyInput
								label="Credit Limit"
								value={formData.creditLimitCents}
								onChange={(v) =>
									setFormData({
										...formData,
										creditLimitCents: v,
									})
								}
							/>
							<div className="space-y-2">
								<Label htmlFor="dueDays">
									Payment Due Days (optional)
								</Label>
								<Input
									id="dueDays"
									type="number"
									min="1"
									value={formData.dueDays}
									onChange={(e) =>
										setFormData({
											...formData,
											dueDays: e.target.value,
										})
									}
									placeholder="30"
								/>
							</div>
						</>
					)}
					<div className="space-y-2">
						<Label htmlFor="note">
							Note (optional)
						</Label>
						<Textarea
							id="note"
							value={formData.note}
							onChange={(e) =>
								setFormData({
									...formData,
									note: e.target.value,
								})
							}
							placeholder="Any notes about this customer..."
							rows={2}
						/>
					</div>
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</DialogClose>
					<Button
						type="submit"
						disabled={loading}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

function EditCustomerDialog({
	customer,
	onSuccess,
}: {
	customer: Customer;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const currentBalanceCents =
		customer.balanceCents ?? 0;
	const [formData, setFormData] = React.useState({
		name: customer.name ?? "",
		phone: customer.phone ?? "",
		note: customer.note ?? "",
		customerMode:
			customer.customerMode ?? "ACCOUNT",
		creditLimitCents:
			customer.creditLimitCents ?? 0,
		dueDays: customer.dueDays
			? String(customer.dueDays)
			: "",
	});
	const [
		targetBalanceCents,
		setTargetBalanceCents,
	] = React.useState(currentBalanceCents);
	const [
		balanceAdjustmentNote,
		setBalanceAdjustmentNote,
	] = React.useState("");

	React.useEffect(() => {
		setFormData({
			name: customer.name ?? "",
			phone: customer.phone ?? "",
			note: customer.note ?? "",
			customerMode:
				customer.customerMode ?? "ACCOUNT",
			creditLimitCents:
				customer.creditLimitCents ?? 0,
			dueDays: customer.dueDays
				? String(customer.dueDays)
				: "",
		});
		setTargetBalanceCents(
			customer.balanceCents ?? 0,
		);
		setBalanceAdjustmentNote("");
	}, [customer]);

	const balanceDeltaCents =
		targetBalanceCents - currentBalanceCents;

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		try {
			const res = await fetch(
				`/api/customers/${customer.id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: formData.name,
						phone: formData.phone || undefined,
						note: formData.note || undefined,
						customerMode: formData.customerMode,
						creditLimitCents:
							formData.customerMode === "ACCOUNT"
								? formData.creditLimitCents
								: 0,
						dueDays: formData.dueDays
							? formData.customerMode ===
								"ACCOUNT"
								? parseInt(formData.dueDays, 10)
								: undefined
							: undefined,
					}),
				},
			);

			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to update customer",
					),
				);
			}

			if (balanceDeltaCents !== 0) {
				const adjustmentRes = await fetch(
					"/api/tabs/adjustment",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							customerId: customer.id,
							amountCents: balanceDeltaCents,
							note:
								balanceAdjustmentNote.trim() ||
								`Customer balance set from ${formatZAR(
									currentBalanceCents,
								)} to ${formatZAR(
									targetBalanceCents,
								)}`,
						}),
					},
				);

				if (!adjustmentRes.ok) {
					const errorBody = await adjustmentRes
						.json()
						.catch(() => ({}));
					throw new Error(
						getApiErrorMessage(
							errorBody,
							"Failed to update customer owing amount",
						),
					);
				}
			}

			toast.success("Customer updated");
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to update customer",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Edit Customer</DialogTitle>
				<DialogDescription>
					Update account details and balance
					settings.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="edit-name">
							Name
						</Label>
						<Input
							id="edit-name"
							value={formData.name}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									name: e.target.value,
								}))
							}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-customer-mode">
							Customer Type
						</Label>
						<Select
							value={formData.customerMode}
							onValueChange={(value) =>
								setFormData((prev) => ({
									...prev,
									customerMode: value as
										| "ACCOUNT"
										| "DEBT_ONLY",
								}))
							}
						>
							<SelectTrigger id="edit-customer-mode">
								<SelectValue placeholder="Select customer type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ACCOUNT">
									Account Customer
								</SelectItem>
								<SelectItem value="DEBT_ONLY">
									Debt-only Customer
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-phone">
							Phone (optional)
						</Label>
						<Input
							id="edit-phone"
							value={formData.phone}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									phone: e.target.value,
								}))
							}
						/>
					</div>
					{formData.customerMode ===
						"ACCOUNT" && (
						<>
							<MoneyInput
								label="Credit Limit"
								value={formData.creditLimitCents}
								onChange={(value) =>
									setFormData((prev) => ({
										...prev,
										creditLimitCents: value,
									}))
								}
							/>
							<div className="space-y-2">
								<Label htmlFor="edit-dueDays">
									Payment Due Days (optional)
								</Label>
								<Input
									id="edit-dueDays"
									type="number"
									min="1"
									value={formData.dueDays}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											dueDays: e.target.value,
										}))
									}
								/>
							</div>
						</>
					)}
					<div className="space-y-2">
						<Label htmlFor="edit-note">
							Note (optional)
						</Label>
						<Textarea
							id="edit-note"
							value={formData.note}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									note: e.target.value,
								}))
							}
							rows={2}
						/>
					</div>
					<div className="rounded-md border p-3 text-sm">
						<p>
							Current owing:{" "}
							{formatZAR(currentBalanceCents)}
						</p>
						<p>
							New owing:{" "}
							{formatZAR(targetBalanceCents)}
						</p>
						<p>
							Adjustment:{" "}
							{balanceDeltaCents > 0 ? "+" : ""}
							{formatZAR(balanceDeltaCents)}
						</p>
					</div>
					<MoneyInput
						label="Set Current Owing"
						value={targetBalanceCents}
						onChange={setTargetBalanceCents}
					/>
					<div className="space-y-2">
						<Label htmlFor="edit-balance-note">
							Owing Adjustment Note (optional)
						</Label>
						<Textarea
							id="edit-balance-note"
							value={balanceAdjustmentNote}
							onChange={(e) =>
								setBalanceAdjustmentNote(
									e.target.value,
								)
							}
							placeholder="Reason for changing the customer's owing amount"
							rows={2}
						/>
					</div>
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</DialogClose>
					<Button
						type="submit"
						disabled={loading}
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

function TabPaymentForm({
	customers,
	date,
	onSuccess,
}: {
	customers: Customer[];
	date: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [customerId, setCustomerId] =
		React.useState("");
	const [amountCents, setAmountCents] =
		React.useState(0);
	const [
		cashReceivedCents,
		setCashReceivedCents,
	] = React.useState(0);
	const [paymentMethod, setPaymentMethod] =
		React.useState<PaymentMethod | "">("");
	const [reference, setReference] =
		React.useState("");
	const [showReference, setShowReference] =
		React.useState(false);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);
	const [cashStep, setCashStep] =
		React.useState(false);

	React.useEffect(() => {
		const stored = localStorage.getItem(
			"default_payment_method",
		);
		if (
			stored === "CASH" ||
			stored === "CARD" ||
			stored === "EFT"
		) {
			setPaymentMethod(stored);
		}
	}, []);

	React.useEffect(() => {
		if (!paymentMethod) return;
		localStorage.setItem(
			"default_payment_method",
			paymentMethod,
		);
	}, [paymentMethod]);

	React.useEffect(() => {
		if (paymentMethod !== "CASH") {
			setCashStep(false);
		}
	}, [paymentMethod]);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();

		if (paymentMethod === "CASH" && !cashStep) {
			setCashStep(true);
			return;
		}

		if (
			paymentMethod === "CASH" &&
			cashReceivedCents < amountCents
		) {
			toast.error(
				"Cash received is less than the payment amount.",
			);
			return;
		}

		setLoading(true);

		try {
			const payload = {
				date,
				customerId,
				amountCents,
				paymentMethod,
				cashReceivedCents:
					paymentMethod === "CASH"
						? cashReceivedCents
						: undefined,
				reference:
					showReference && reference
						? reference
						: undefined,
				note: showNote && note ? note : undefined,
			};

			const { response: res } =
				await postTabPaymentWithOfflineQueue(
					payload,
				);

			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to record payment",
					),
				);
			}

			await res.json().catch(() => ({}));

			toast.success(
				"Payment recorded successfully",
			);

			setCustomerId("");
			setAmountCents(0);
			setCashReceivedCents(0);
			setCashStep(false);
			setReference("");
			setShowReference(false);
			setNote("");
			setShowNote(false);

			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to record payment",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex h-[60vh] flex-col"
		>
			<div className="flex h-[60vh] min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2">
				{cashStep && paymentMethod === "CASH" ? (
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
						<div className="rounded-md border p-3">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Cash Settlement
							</p>
							<p className="text-sm font-medium">
								Confirm cash received and change
							</p>
							<p className="text-xs text-muted-foreground">
								Payment amount:{" "}
								{formatZAR(amountCents)}
							</p>
						</div>
						<CashChangeCalculator
							totalCents={amountCents}
							cashReceivedCents={
								cashReceivedCents
							}
							onCashReceivedChange={
								setCashReceivedCents
							}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setCashStep(false)}
						>
							Back
						</Button>
					</div>
				) : (
					<>
						<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
							<CustomerSelect
								customers={customers}
								value={customerId}
								onChange={setCustomerId}
								label="Tab Holder"
							/>
							<MoneyInput
								label="Amount"
								value={amountCents}
								onChange={setAmountCents}
							/>
						</div>

						<div className="space-y-3">
							<Label>Payment Method</Label>
							<Select
								value={paymentMethod}
								onValueChange={(v) =>
									setPaymentMethod(
										v as PaymentMethod,
									)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select method" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="CASH">
										Cash
									</SelectItem>
									<SelectItem value="CARD">
										Card
									</SelectItem>
									<SelectItem value="EFT">
										EFT
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-3">
							<div className="space-y-2">
								<div className="grid grid-cols-2 gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="w-full"
										onClick={() =>
											setShowReference(
												(prev) => !prev,
											)
										}
									>
										{showReference
											? "Hide Ref"
											: "Add Ref"}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="w-full"
										onClick={() =>
											setShowNote((prev) => !prev)
										}
									>
										{showNote
											? "Hide Note"
											: "Add Note"}
									</Button>
								</div>
								{showReference && (
									<div className="space-y-2">
										<Label>
											Reference (optional)
										</Label>
										<Input
											value={reference}
											onChange={(e) =>
												setReference(
													e.target.value,
												)
											}
											placeholder="e.g. Receipt #123"
										/>
									</div>
								)}
								{showNote && (
									<Textarea
										value={note}
										onChange={(e) =>
											setNote(e.target.value)
										}
										placeholder="Any notes..."
										rows={2}
									/>
								)}
							</div>
						</div>
					</>
				)}
			</div>
			<div className="shrink-0 border-t px-4 py-3">
				<Button
					type="submit"
					className="w-full"
					disabled={
						loading ||
						!customerId ||
						!paymentMethod ||
						amountCents <= 0
					}
				>
					{loading
						? "Saving..."
						: cashStep && paymentMethod === "CASH"
							? "Confirm Payment"
							: "Save"}
				</Button>
			</div>
		</form>
	);
}
