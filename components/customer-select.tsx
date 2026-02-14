"use client";

import * as React from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatZAR } from "@/lib/money";
import type { Customer } from "@/lib/types";

interface CustomerSelectProps {
	customers: Customer[];
	value: string;
	onChange: (customerId: string) => void;
	label?: string;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	showBalance?: boolean;
}

export function CustomerSelect({
	customers,
	value,
	onChange,
	label,
	placeholder = "Select customer",
	className,
	disabled,
	showBalance = true,
}: CustomerSelectProps) {
	return (
		<div className={cn("space-y-2", className)}>
			{label && <Label>{label}</Label>}
			<Select
				value={value}
				onValueChange={onChange}
				disabled={disabled}
			>
				<SelectTrigger className="w-full">
					<SelectValue
						placeholder={placeholder}
					/>
				</SelectTrigger>
				<SelectContent>
					{customers.map((customer) => (
						<SelectItem
							key={customer.id}
							value={customer.id}
						>
							<span className="flex items-center justify-between gap-2">
								<span className="flex items-center gap-2">
									<span>{customer.name}</span>
									{customer.isTemporaryTab && (
										<span className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
											Temp
										</span>
									)}
									{customer.customerMode ===
										"DEBT_ONLY" && (
										<span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
											Debt-only
										</span>
									)}
								</span>
								{showBalance &&
									customer.balanceCents !==
										undefined && (
										<span
											className={cn(
												"text-xs",
												customer.balanceCents > 0
													? "text-destructive"
													: "text-muted-foreground",
											)}
										>
											{formatZAR(
												customer.balanceCents,
											)}
										</span>
									)}
							</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
