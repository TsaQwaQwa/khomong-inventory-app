"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
	Plus,
	Trash2,
	AlertCircle,
	Users,
	Receipt,
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
	TabChargeItem,
} from "@/lib/types";

const fetcher = async (url: string) => {
	const res = await fetch(url);
	if (!res.ok) {
		const error = await res
			.json()
			.catch(() => ({ error: "Request failed" }));
		throw new Error(
			error.error || "Failed to fetch data",
		);
	}
	return res.json();
};

export function TabsClient() {
	const [date, setDate] = React.useState(
		getTodayJHB(),
	);

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

	const [addCustomerOpen, setAddCustomerOpen] =
		React.useState(false);

	return (
		<PageWrapper
			title="Tabs"
			description="Manage customer credit tabs"
			actions={
				<DatePickerYMD
					value={date}
					onChange={setDate}
				/>
			}
		>
			<Tabs
				defaultValue="customers"
				className="space-y-6"
			>
				<TabsList className="grid w-full max-w-md grid-cols-2">
					<TabsTrigger
						value="customers"
						className="flex items-center gap-2"
					>
						<Users className="h-4 w-4" />
						Customers
					</TabsTrigger>
					<TabsTrigger
						value="transactions"
						className="flex items-center gap-2"
					>
						<Receipt className="h-4 w-4" />
						Transactions
					</TabsTrigger>
				</TabsList>

				{/* Customers Panel */}
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
										<Button>
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
									title="No customers"
									description="Add your first customer to start managing tabs."
									action={
										<Button
											onClick={() =>
												setAddCustomerOpen(true)
											}
										>
											<Plus className="mr-2 h-4 w-4" />
											Add Customer
										</Button>
									}
								/>
							) : (
								<Card className="shadow-lg">
									<CardContent className="pt-6">
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
														Balance
													</TableHead>
													<TableHead>
														Note
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{customers.map(
													(customer) => (
														<TableRow
															key={customer.id}
														>
															<TableCell className="font-medium">
																{customer.name}
															</TableCell>
															<TableCell>
																{customer.phone ||
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
																	(customer.balanceCents ||
																		0) > 0 &&
																		"text-destructive",
																)}
															>
																{formatZAR(
																	customer.balanceCents ||
																		0,
																)}
															</TableCell>
															<TableCell className="text-muted-foreground max-w-[200px] truncate">
																{customer.note ||
																	"-"}
															</TableCell>
														</TableRow>
													),
												)}
											</TableBody>
										</Table>
									</CardContent>
								</Card>
							)}
						</>
					)}
				</TabsContent>

				{/* Transactions Panel */}
				<TabsContent value="transactions">
					{productsLoading || customersLoading ? (
						<LoadingForm />
					) : productsError || customersError ? (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>
								Failed to load data
							</AlertDescription>
						</Alert>
					) : (
						<div className="grid gap-6 lg:grid-cols-2">
							<TabChargeForm
								customers={customers || []}
								products={products || []}
								date={date}
							/>
							<TabPaymentForm
								customers={customers || []}
								date={date}
								onSuccess={() =>
									mutateCustomers()
								}
							/>
						</div>
					)}
				</TabsContent>
			</Tabs>
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
				const error = await res
					.json()
					.catch(() => ({
						error: "Request failed",
					}));
				throw new Error(
					error.error || "Failed to add customer",
				);
			}

			toast.success(
				"Customer added successfully",
			);
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
					Add a new customer for tab management.
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
					<Button
						type="submit"
						disabled={loading}
					>
						{loading
							? "Adding..."
							: "Add Customer"}
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
}: {
	customers: Customer[];
	products: Product[];
	date: string;
}) {
	const [loading, setLoading] =
		React.useState(false);
	const [customerId, setCustomerId] =
		React.useState("");
	const [items, setItems] = React.useState<
		ChargeItem[]
	>([{ productId: "", units: "" }]);
	const [note, setNote] = React.useState("");
	const [receipt, setReceipt] = React.useState<{
		amount: number;
		items: {
			productName: string;
			units: number;
		}[];
		createdAt: string;
	} | null>(null);

	const productMap = React.useMemo(
		() => new Map(products.map((p) => [p.id, p])),
		[products],
	);

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
						note: note || undefined,
					}),
				},
			);

			if (!res.ok) {
				const error = await res
					.json()
					.catch(() => ({
						error: "Request failed",
					}));
				throw new Error(
					error.error || "Failed to charge tab",
				);
			}

			const data = await res.json();
			toast.success("Tab charged successfully");

			// Calculate receipt data
			const receiptItems = validItems.map(
				(item) => ({
					productName:
						productMap.get(item.productId)
							?.name || item.productId,
					units: item.units,
				}),
			);

			const totalAmount = validItems.reduce(
				(sum, item) => {
					const product = productMap.get(
						item.productId,
					);
					return (
						sum +
						(product?.currentPriceCents || 0) *
							item.units
					);
				},
				0,
			);

			setReceipt({
				amount: data.amountCents || totalAmount,
				items: receiptItems,
				createdAt:
					data.createdAt ||
					new Date().toISOString(),
			});

			// Reset form
			setCustomerId("");
			setItems([{ productId: "", units: "" }]);
			setNote("");
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to charge tab",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="shadow-md">
			<CardHeader>
				<CardTitle>Charge Tab</CardTitle>
			</CardHeader>
			<CardContent>
				{receipt ? (
					<div className="space-y-4">
						<Alert className="border-primary/50 bg-primary/5">
							<Receipt className="h-4 w-4 text-primary" />
							<AlertTitle>Tab Charged</AlertTitle>
							<AlertDescription className="mt-2">
								<div className="space-y-2 text-sm">
									<p>
										<strong>Amount:</strong>{" "}
										{formatZAR(receipt.amount)}
									</p>
									<p>
										<strong>Date:</strong>{" "}
										{formatDateDisplay(date)}
									</p>
									<div>
										<strong>Items:</strong>
										<ul className="list-disc list-inside mt-1">
											{receipt.items.map(
												(item, i) => (
													<li key={i}>
														{item.productName} x{" "}
														{item.units}
													</li>
												),
											)}
										</ul>
									</div>
								</div>
							</AlertDescription>
						</Alert>
						<Button
							variant="outline"
							className="w-full bg-transparent"
							onClick={() => setReceipt(null)}
						>
							New Charge
						</Button>
					</div>
				) : (
					<form
						onSubmit={handleSubmit}
						className="space-y-4"
					>
						<CustomerSelect
							customers={customers}
							value={customerId}
							onChange={setCustomerId}
							label="Customer"
						/>

						<div className="space-y-3">
							<Label>Items</Label>
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
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addItem}
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Item
							</Button>
						</div>

						<div className="space-y-2">
							<Label>Note (optional)</Label>
							<Textarea
								value={note}
								onChange={(e) =>
									setNote(e.target.value)
								}
								placeholder="Any notes..."
								rows={2}
							/>
						</div>

						<Button
							type="submit"
							className="w-full"
							disabled={loading || !customerId}
						>
							{loading
								? "Charging..."
								: "Charge Tab"}
						</Button>
					</form>
				)}
			</CardContent>
		</Card>
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
	const [note, setNote] = React.useState("");
	const [receipt, setReceipt] = React.useState<{
		amount: number;
		method: string;
		createdAt: string;
	} | null>(null);

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
						reference: reference || undefined,
						note: note || undefined,
					}),
				},
			);

			if (!res.ok) {
				const error = await res
					.json()
					.catch(() => ({
						error: "Request failed",
					}));
				throw new Error(
					error.error ||
						"Failed to record payment",
				);
			}

			const data = await res.json();
			toast.success(
				"Payment recorded successfully",
			);

			setReceipt({
				amount: amountCents,
				method: paymentMethod,
				createdAt:
					data.createdAt ||
					new Date().toISOString(),
			});

			// Reset form
			setCustomerId("");
			setAmountCents(0);
			setPaymentMethod("");
			setReference("");
			setNote("");

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
		<Card className="shadow-md">
			<CardHeader>
				<CardTitle>Record Payment</CardTitle>
			</CardHeader>
			<CardContent>
				{receipt ? (
					<div className="space-y-4">
						<Alert className="border-primary/50 bg-primary/5">
							<Receipt className="h-4 w-4 text-primary" />
							<AlertTitle>
								Payment Recorded
							</AlertTitle>
							<AlertDescription className="mt-2">
								<div className="space-y-1 text-sm">
									<p>
										<strong>Amount:</strong>{" "}
										{formatZAR(receipt.amount)}
									</p>
									<p>
										<strong>Method:</strong>{" "}
										{receipt.method}
									</p>
									<p>
										<strong>Date:</strong>{" "}
										{formatDateDisplay(date)}
									</p>
								</div>
							</AlertDescription>
						</Alert>
						<Button
							variant="outline"
							className="w-full bg-transparent"
							onClick={() => setReceipt(null)}
						>
							New Payment
						</Button>
					</div>
				) : (
					<form
						onSubmit={handleSubmit}
						className="space-y-4"
					>
						<CustomerSelect
							customers={customers}
							value={customerId}
							onChange={setCustomerId}
							label="Customer"
						/>

						<MoneyInput
							label="Amount"
							value={amountCents}
							onChange={setAmountCents}
						/>

						<div className="space-y-2">
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

						<div className="space-y-2">
							<Label>Reference (optional)</Label>
							<Input
								value={reference}
								onChange={(e) =>
									setReference(e.target.value)
								}
								placeholder="e.g. Receipt #123"
							/>
						</div>

						<div className="space-y-2">
							<Label>Note (optional)</Label>
							<Textarea
								value={note}
								onChange={(e) =>
									setNote(e.target.value)
								}
								placeholder="Any notes..."
								rows={2}
							/>
						</div>

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
								? "Recording..."
								: "Record Payment"}
						</Button>
					</form>
				)}
			</CardContent>
		</Card>
	);
}
