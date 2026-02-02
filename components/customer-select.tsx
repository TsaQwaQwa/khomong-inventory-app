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
								<span>{customer.name}</span>
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
