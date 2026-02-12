"use client";
/* eslint-disable max-len */

import * as React from "react";
import {
	usePathname,
	useRouter,
	useSearchParams,
} from "next/navigation";
import useSWR from "swr";
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
import { DatePickerYMD } from "@/components/date-picker-ymd";
import {
	LoadingTable,
	LoadingForm,
} from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { ProductSelect } from "@/components/product-select";
import { CustomerSelect } from "@/components/customer-select";
import { MoneyInput } from "@/components/money-input";
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
	DialogTrigger,
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
import {
	getTodayJHB,
	formatDateDisplay,
} from "@/lib/date-utils";
import { formatZAR } from "@/lib/money";
import { cn } from "@/lib/utils";
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
	if (typeof maybeError === "string")
		return maybeError;

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
		| "DIRECT_SALE";
	amountCents: number;
	paymentMethod?: PaymentMethod;
	note?: string;
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

export function TabsClient({
	view = "both",
}: TabsClientProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [date, setDate] = React.useState(
		getTodayJHB(),
	);
	const isAccountsOnly = view === "accounts";
	const isTransactionsOnly =
		view === "transactions";

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

	const {
		data: products,
		error: productsError,
		isLoading: productsLoading,
	} = useSWR<Product[]>("/api/products", fetcher);
	const {
		data: transactionsHistory,
		isLoading: transactionsLoading,
		mutate: mutateTransactions,
	} = useSWR<TabTransactionHistory[]>(
		`/api/transactions?date=${date}&limit=200`,
		fetcher,
		{
			onError: (err) => toast.error(err.message),
		},
	);
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
	const [addCustomerOpen, setAddCustomerOpen] =
		React.useState(false);
	const [editingCustomer, setEditingCustomer] =
		React.useState<Customer | null>(null);
	const [saleDialogOpen, setSaleDialogOpen] =
		React.useState(false);
	const [
		paymentDialogOpen,
		setPaymentDialogOpen,
	] = React.useState(false);
	const [
		directSaleDialogOpen,
		setDirectSaleDialogOpen,
	] = React.useState(false);
	const [reverseReason, setReverseReason] =
		React.useState("");
	const [
		reversingTxn,
		setReversingTxn,
	] = React.useState<TabTransactionHistory | null>(
		null,
	);
	const [reverseLoading, setReverseLoading] =
		React.useState(false);
	const kindFilter =
		searchParams.get("kind") ?? "all";
	const productFilter =
		searchParams.get("productId");
	const action = searchParams.get("action");

	React.useEffect(() => {
		const qsDate = searchParams.get("date");
		if (qsDate) setDate(qsDate);
	}, [searchParams]);

	React.useEffect(() => {
		if (!isTransactionsOnly) return;
		if (action === "direct-sale") {
			setDirectSaleDialogOpen(true);
			setSaleDialogOpen(false);
			setPaymentDialogOpen(false);
			return;
		}
		if (action === "account-sale") {
			setSaleDialogOpen(true);
			setDirectSaleDialogOpen(false);
			setPaymentDialogOpen(false);
			return;
		}
		if (action === "account-payment") {
			setPaymentDialogOpen(true);
			setSaleDialogOpen(false);
			setDirectSaleDialogOpen(false);
		}
	}, [action, isTransactionsOnly]);

	const filteredTransactions = React.useMemo(
		() =>
			(transactionsHistory ?? []).filter(
				(txn) => {
					const kindMatch =
						kindFilter === "direct"
							? txn.type === "DIRECT_SALE"
							: kindFilter === "account"
								? txn.type === "CHARGE"
								: kindFilter === "payment"
									? txn.type === "PAYMENT"
									: kindFilter === "reversals"
										? Boolean(
												txn.isReversal,
										  )
									: true;
					if (!kindMatch) return false;
					if (!productFilter) return true;
					return (txn.items ?? []).some(
						(item) =>
							item.productId === productFilter,
					);
				},
			),
		[
			transactionsHistory,
			kindFilter,
			productFilter,
		],
	);

	const updateKindFilter = React.useCallback(
		(nextKind: string) => {
			const params = new URLSearchParams(
				searchParams.toString(),
			);
			if (nextKind === "all") {
				params.delete("kind");
			} else {
				params.set("kind", nextKind);
			}
			const qs = params.toString();
			router.replace(
				qs ? `${pathname}?${qs}` : pathname,
			);
		},
		[pathname, router, searchParams],
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
			mutateTransactions();
			mutateCustomers();
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

	return (
		<PageWrapper
			title={
				isTransactionsOnly
					? "Transactions"
					: "Customer Accounts"
			}
			description={
				isTransactionsOnly
					? "Record direct sales, account sales, and payments."
					: "Track customer credit balances and account settings."
			}
			actions={
				isAccountsOnly ? undefined : (
					<DatePickerYMD
						value={date}
						onChange={setDate}
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

				{/* Customers Panel */}
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
								<div className="flex justify-end mb-4">
									<Dialog
										open={addCustomerOpen}
										onOpenChange={
											setAddCustomerOpen
										}
									>
										<DialogTrigger asChild>
											<Button className="hidden">
												<Plus className="mr-2 h-4 w-4" />
												Add Customer
											</Button>
										</DialogTrigger>
										<AddCustomerDialog
											onSuccess={() => {
												setAddCustomerOpen(false);
												mutateCustomers();
											}}
										/>
									</Dialog>
								</div>

								{!customers?.length ? (
									<EmptyState
										icon={
											<Users className="h-8 w-8 text-muted-foreground" />
										}
										title="No customer accounts yet"
										description="Add your first customer to start tracking credit balances."
									/>
								) : (
									<Card className="shadow-lg">
										<CardContent className="pt-6">
											<div className="space-y-3 md:hidden">
												{customers.map(
													(customer) => {
														const balanceCents =
															customer.balanceCents ??
															0;
														const hasBalance =
															balanceCents > 0;
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
																		<p className="font-medium">
																			{
																				customer.name
																			}
																		</p>
																		<p className="text-xs text-muted-foreground">
																			{customer.phone ??
																				"No phone"}
																		</p>
																	</div>
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
																</div>
																<div className="mt-3 grid grid-cols-2 gap-2 text-sm">
																	<div>
																		<p className="text-muted-foreground">
																			Limit
																		</p>
																		<p>
																			{formatZAR(
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
														{customers.map(
															(customer) => {
																const balanceCents =
																	customer.balanceCents ??
																	0;
																const hasBalance =
																	balanceCents >
																	0;
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
																			{
																				customer.name
																			}
																		</TableCell>
																		<TableCell>
																			{customer.phone ??
																				"-"}
																		</TableCell>
																		<TableCell className="text-right">
																			{formatZAR(
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
																		<TableCell className="text-muted-foreground max-w-50 truncate">
																			{customer.note ??
																				"-"}
																		</TableCell>
																		<TableCell className="text-right">
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

						<Dialog
							open={Boolean(editingCustomer)}
							onOpenChange={(open) => {
								if (!open)
									setEditingCustomer(null);
							}}
						>
							{editingCustomer && (
								<EditCustomerDialog
									customer={editingCustomer}
									onSuccess={() => {
										setEditingCustomer(null);
										mutateCustomers();
									}}
								/>
							)}
						</Dialog>
					</TabsContent>
				)}

				{/* Transactions Panel */}
				{!isAccountsOnly && (
					<TabsContent value="transactions">
						{productsLoading ||
						customersLoading ? (
							<LoadingForm />
						) : productsError ||
						  customersError ? (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>
									Failed to load data
								</AlertDescription>
							</Alert>
						) : (
							<>
								<div className="mb-4 hidden flex-wrap justify-end gap-2">
									<Dialog
										open={directSaleDialogOpen}
										onOpenChange={
											setDirectSaleDialogOpen
										}
									>
										<DialogTrigger asChild>
											<Button
												type="button"
												variant="secondary"
											>
												Add Direct Sale
											</Button>
										</DialogTrigger>
										<DialogContent className="h-[70vh] w-[90vw] max-w-[90vw] overflow-hidden p-0 sm:max-w-[90vw]">
											<DialogHeader className="shrink-0 space-y-0.5 border-b px-4 py-1.5 h-16">
												<DialogTitle>
													Add Direct Sale
												</DialogTitle>
												<DialogDescription className="text-xs leading-tight">
													Record an immediate paid
													sale for{" "}
													{formatDateDisplay(
														date,
													)}
													.
												</DialogDescription>
											</DialogHeader>
											<DirectSaleForm
												products={
													normalizedProducts
												}
												date={date}
												onSuccess={() => {
													mutateTransactions();
													setDirectSaleDialogOpen(
														false,
													);
												}}
											/>
										</DialogContent>
									</Dialog>

									<Dialog
										open={saleDialogOpen}
										onOpenChange={
											setSaleDialogOpen
										}
									>
										<DialogTrigger asChild>
											<Button type="button">
												Add Sale
											</Button>
										</DialogTrigger>
										<DialogContent className="h-[70vh] w-[90vw] max-w-[90vw] overflow-hidden p-0 sm:max-w-[90vw]">
											<DialogHeader className="shrink-0 space-y-0.5 border-b px-4 py-1.5 h-16">
												<DialogTitle>
													Add Sale to Account
												</DialogTitle>
												<DialogDescription className="text-xs leading-tight">
													Record a customer
													account sale for{" "}
													{formatDateDisplay(
														date,
													)}
													.
												</DialogDescription>
											</DialogHeader>
											<TabChargeForm
												customers={
													normalizedCustomers
												}
												products={
													normalizedProducts
												}
												date={date}
												onSuccess={() => {
													mutateCustomers();
													mutateTransactions();
													setSaleDialogOpen(
														false,
													);
												}}
											/>
										</DialogContent>
									</Dialog>

									<Dialog
										open={paymentDialogOpen}
										onOpenChange={
											setPaymentDialogOpen
										}
									>
										<DialogTrigger asChild>
											<Button
												type="button"
												variant="outline"
											>
												Add Payment
											</Button>
										</DialogTrigger>
										<DialogContent className="h-[70vh] w-[90vw] max-w-[90vw] overflow-hidden p-0 sm:max-w-[90vw]">
											<DialogHeader className="shrink-0 space-y-0.5 border-b px-4 py-1.5 h-16">
												<DialogTitle>
													Record Account Payment
												</DialogTitle>
												<DialogDescription className="text-xs leading-tight">
													Save a customer payment
													for{" "}
													{formatDateDisplay(
														date,
													)}
													.
												</DialogDescription>
											</DialogHeader>
											<TabPaymentForm
												customers={
													normalizedCustomers
												}
												date={date}
												onSuccess={() => {
													mutateCustomers();
													mutateTransactions();
													setPaymentDialogOpen(
														false,
													);
												}}
											/>
										</DialogContent>
									</Dialog>
								</div>
							</>
						)}

						<Card className="shadow-md mt-6">
							<CardHeader>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<CardTitle>
										Transaction History
									</CardTitle>
									<div className="w-full sm:w-56">
										<Select
											value={kindFilter}
											onValueChange={
												updateKindFilter
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Filter transactions" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">
													All
												</SelectItem>
												<SelectItem value="direct">
													Direct Sales
												</SelectItem>
												<SelectItem value="account">
													Account Sales
												</SelectItem>
												<SelectItem value="payment">
													Payments
												</SelectItem>
												<SelectItem value="reversals">
													Reversals
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								{transactionsLoading ? (
									<LoadingTable />
								) : !filteredTransactions.length ? (
									<p className="text-sm text-muted-foreground">
										No transactions saved for this
										date yet.
									</p>
								) : (
									<>
										{(kindFilter !== "all" ||
											productFilter) && (
											<p className="mb-3 text-xs text-muted-foreground">
												Showing filtered
												transactions for this
												view.
											</p>
										)}
										<div className="space-y-3 md:hidden">
											{filteredTransactions.map(
												(txn) => (
													<div
														key={txn.id}
														className="rounded-lg border p-3"
													>
														<div className="flex items-start justify-between gap-2">
															<div>
																<p className="font-medium">
																	{
																		txn.customerName
																	}
																</p>
																<p className="text-xs text-muted-foreground">
																	{txn.createdAt
																		? new Date(
																				txn.createdAt,
																			).toLocaleTimeString()
																		: "-"}
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
																{txn.type ===
																"DIRECT_SALE"
																	? "Direct Sale"
																	: txn.type ===
																		  "CHARGE"
																		? "Sale"
																		: txn.type ===
																			  "PAYMENT"
																			? "Payment"
																			: "Adjustment"}
															</span>
															<span className="text-muted-foreground">
																{txn.paymentMethod ??
																	"-"}
															</span>
														</div>
														<div className="mt-3 flex items-center justify-end gap-2">
															{txn.isReversal && (
																<span className="rounded px-2 py-1 text-xs bg-muted text-muted-foreground">
																	Reversal
																</span>
															)}
															{txn.isReversed && (
																<span className="rounded px-2 py-1 text-xs bg-amber-500/10 text-amber-700">
																	Reversed
																</span>
															)}
															{!txn.isReversal &&
																!txn.isReversed &&
																(txn.type ===
																	"DIRECT_SALE" ||
																	txn.type ===
																		"CHARGE" ||
																	txn.type ===
																		"PAYMENT") && (
																	<Button
																		type="button"
																		size="sm"
																		variant="outline"
																		onClick={() =>
																			setReversingTxn(
																				txn,
																			)
																		}
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
															>
																<TableCell className="text-muted-foreground">
																	{txn.createdAt
																		? new Date(
																				txn.createdAt,
																			).toLocaleTimeString()
																		: "-"}
																</TableCell>
																<TableCell>
																	{
																		txn.customerName
																	}
																</TableCell>
																<TableCell>
																	{txn.type ===
																	"DIRECT_SALE"
																		? "Direct Sale"
																		: txn.type ===
																			  "CHARGE"
																			? "Sale"
																			: txn.type ===
																				  "PAYMENT"
																				? "Payment"
																				: "Adjustment"}
																</TableCell>
																<TableCell className="text-right">
																	{formatZAR(
																		txn.amountCents,
																	)}
																</TableCell>
																<TableCell className="text-muted-foreground">
																	{txn.paymentMethod ??
																		txn.reference ??
																		txn.note ??
																		"-"}
																</TableCell>
																<TableCell className="text-right">
																	{txn.isReversal ? (
																		<span className="rounded px-2 py-1 text-xs bg-muted text-muted-foreground">
																			Reversal
																		</span>
																	) : txn.isReversed ? (
																		<span className="rounded px-2 py-1 text-xs bg-amber-500/10 text-amber-700">
																			Reversed
																		</span>
																	) : txn.type ===
																			"DIRECT_SALE" ||
																		txn.type ===
																			"CHARGE" ||
																		txn.type ===
																			"PAYMENT" ? (
																		<Button
																			type="button"
																			size="sm"
																			variant="outline"
																			onClick={() =>
																				setReversingTxn(
																					txn,
																				)
																			}
																		>
																			<RotateCcw className="mr-2 h-3.5 w-3.5" />
																			Reverse
																		</Button>
																	) : (
																		"-"
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
					</TabsContent>
				)}
			</Tabs>

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
									reversingTxn?.amountCents ??
										0,
								)}
							</p>
						</div>
						<div className="space-y-2">
							<Label>Reason</Label>
							<Textarea
								value={reverseReason}
								onChange={(e) =>
									setReverseReason(
										e.target.value,
									)
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
					phone: formData.phone || undefined,
					note: formData.note || undefined,
					creditLimitCents:
						formData.creditLimitCents,
					dueDays: formData.dueDays
						? parseInt(formData.dueDays)
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
					Create a customer account for credit
					purchases and payments.
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
	const [formData, setFormData] = React.useState({
		name: customer.name ?? "",
		phone: customer.phone ?? "",
		note: customer.note ?? "",
		creditLimitCents:
			customer.creditLimitCents ?? 0,
		dueDays: customer.dueDays
			? String(customer.dueDays)
			: "",
	});

	React.useEffect(() => {
		setFormData({
			name: customer.name ?? "",
			phone: customer.phone ?? "",
			note: customer.note ?? "",
			creditLimitCents:
				customer.creditLimitCents ?? 0,
			dueDays: customer.dueDays
				? String(customer.dueDays)
				: "",
		});
	}, [customer]);

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
						creditLimitCents:
							formData.creditLimitCents,
						dueDays: formData.dueDays
							? parseInt(formData.dueDays, 10)
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
					Update account details and credit limit.
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

interface ChargeItem {
	productId: string;
	units: string;
}

function TabChargeForm({
	customers,
	products,
	date,
	onSuccess,
}: {
	customers: Customer[];
	products: Product[];
	date: string;
	onSuccess?: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [customerId, setCustomerId] =
		React.useState("");
	const [items, setItems] = React.useState<
		ChargeItem[]
	>([{ productId: "", units: "" }]);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);

	const addItem = () => {
		setItems([
			...items,
			{ productId: "", units: "" },
		]);
	};

	const removeItem = (index: number) => {
		setItems(items.filter((_, i) => i !== index));
	};

	const updateItem = (
		index: number,
		updates: Partial<ChargeItem>,
	) => {
		setItems(
			items.map((item, i) =>
				i === index
					? { ...item, ...updates }
					: item,
			),
		);
	};

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		const validItems = items
			.filter(
				(item) => item.productId && item.units,
			)
			.map((item) => ({
				productId: item.productId,
				units: parseInt(item.units) || 0,
			}));

		if (validItems.length === 0) {
			toast.error("Please add at least one item");
			setLoading(false);
			return;
		}

		try {
			const res = await fetch(
				"/api/tabs/charge",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						date,
						customerId,
						items: validItems,
						note:
							showNote && note ? note : undefined,
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
						"Failed to add sale to account",
					),
				);
			}

			const data = await res.json();
			toast.success(
				"Sale added to customer account",
			);

			onSuccess?.();

			// Reset form
			setCustomerId("");
			setItems([{ productId: "", units: "" }]);
			setNote("");
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to add sale to account",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				<div className="flex min-h-0 flex-1 flex-col space-y-2 h-[50vh]">
					<Label>Items Sold</Label>
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
						{items.map((item, index) => (
							<div
								key={index}
								className="flex gap-2 items-end"
							>
								<div className="flex-1">
									<ProductSelect
										products={products}
										value={item.productId}
										onChange={(v) =>
											updateItem(index, {
												productId: v,
											})
										}
										placeholder="Product"
									/>
								</div>
								<div className="w-20">
									<Input
										type="number"
										min="1"
										value={item.units}
										onChange={(e) =>
											updateItem(index, {
												units: e.target.value,
											})
										}
										placeholder="Qty"
									/>
								</div>
								{items.length > 1 && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() =>
											removeItem(index)
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								)}
							</div>
						))}
					</div>
				</div>

				<div className="space-y-3">
					<CustomerSelect
						customers={customers}
						value={customerId}
						onChange={setCustomerId}
						label="Customer Account"
					/>
				</div>

				<div className="space-y-2">
					<div className="grid grid-cols-2 gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full"
							onClick={addItem}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Item
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
					{showNote && (
						<Textarea
							value={note}
							onChange={(e) =>
								setNote(e.target.value)
							}
							placeholder="Optional note for this account sale"
							rows={2}
						/>
					)}
				</div>
			</div>
			<div className="shrink-0 border-t px-4 py-3">
				<Button
					type="submit"
					className="w-full"
					disabled={loading || !customerId}
				>
					{loading ? "Saving..." : "Save"}
				</Button>
			</div>
		</form>
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
	const [paymentMethod, setPaymentMethod] =
		React.useState<PaymentMethod | "">("");
	const [reference, setReference] =
		React.useState("");
	const [showReference, setShowReference] =
		React.useState(false);
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		try {
			const res = await fetch(
				"/api/tabs/payment",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						date,
						customerId,
						amountCents,
						paymentMethod,
						reference:
							showReference && reference
								? reference
								: undefined,
						note:
							showNote && note ? note : undefined,
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
						"Failed to record payment",
					),
				);
			}

			await res.json();
			toast.success(
				"Payment recorded successfully",
			);

			// Reset form
			setCustomerId("");
			setAmountCents(0);
			setPaymentMethod("");
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
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
					<CustomerSelect
						customers={customers}
						value={customerId}
						onChange={setCustomerId}
						label="Customer Account"
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
							setPaymentMethod(v as PaymentMethod)
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
					{loading ? "Saving..." : "Save"}
				</Button>
			</div>
		</form>
	);
}

function DirectSaleForm({
	products,
	date,
	onSuccess,
}: {
	products: Product[];
	date: string;
	onSuccess: () => void;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [items, setItems] = React.useState<
		ChargeItem[]
	>([{ productId: "", units: "" }]);
	const [paymentMethod, setPaymentMethod] =
		React.useState<PaymentMethod | "">("");
	const [note, setNote] = React.useState("");
	const [showNote, setShowNote] =
		React.useState(false);

	const addItem = () => {
		setItems([
			...items,
			{ productId: "", units: "" },
		]);
	};

	const removeItem = (index: number) => {
		setItems(items.filter((_, i) => i !== index));
	};

	const updateItem = (
		index: number,
		updates: Partial<ChargeItem>,
	) => {
		setItems(
			items.map((item, i) =>
				i === index
					? { ...item, ...updates }
					: item,
			),
		);
	};

	const handleSubmit = async (
		e: React.FormEvent,
	) => {
		e.preventDefault();
		setLoading(true);

		const validItems = items
			.filter(
				(item) => item.productId && item.units,
			)
			.map((item) => ({
				productId: item.productId,
				units: parseInt(item.units) || 0,
			}))
			.filter((item) => item.units > 0);

		if (validItems.length === 0) {
			toast.error("Please add at least one item");
			setLoading(false);
			return;
		}

		try {
			const res = await fetch("/api/sales", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					date,
					paymentMethod,
					items: validItems,
					note:
						showNote && note ? note : undefined,
				}),
			});

			if (!res.ok) {
				const errorBody = await res
					.json()
					.catch(() => ({}));
				throw new Error(
					getApiErrorMessage(
						errorBody,
						"Failed to save direct sale",
					),
				);
			}

			toast.success("Direct sale saved");
			setItems([{ productId: "", units: "" }]);
			setPaymentMethod("");
			setNote("");
			onSuccess();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to save direct sale",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col h-[60vh]"
		>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 h-[60vh]">
				<div className="flex min-h-0 flex-1 flex-col space-y-2 h-[50vh]">
					<Label>Items Sold</Label>
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
						{items.map((item, index) => (
							<div
								key={index}
								className="flex gap-2 items-end"
							>
								<div className="flex-1">
									<ProductSelect
										products={products}
										value={item.productId}
										onChange={(v) =>
											updateItem(index, {
												productId: v,
											})
										}
										placeholder="Product"
									/>
								</div>
								<div className="w-20">
									<Input
										type="number"
										min="1"
										value={item.units}
										onChange={(e) =>
											updateItem(index, {
												units: e.target.value,
											})
										}
										placeholder="Qty"
									/>
								</div>
								{items.length > 1 && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() =>
											removeItem(index)
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								)}
							</div>
						))}
					</div>
				</div>

				<div className="space-y-3">
					<Label>Payment Method</Label>
					<Select
						value={paymentMethod}
						onValueChange={(v) =>
							setPaymentMethod(v as PaymentMethod)
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

				<div className="space-y-2">
					<div className="grid grid-cols-2 gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full"
							onClick={addItem}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Item
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
			<div className="shrink-0 border-t px-4 py-3">
				<Button
					type="submit"
					className="w-full"
					disabled={loading || !paymentMethod}
				>
					{loading ? "Saving..." : "Save"}
				</Button>
			</div>
		</form>
	);
}
