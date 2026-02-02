"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fromCents, toCents } from "@/lib/money";

interface MoneyInputProps {
	label?: string;
	value: number; // cents
	onChange: (cents: number) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	id?: string;
}

export function MoneyInput({
	label,
	value,
	onChange,
	placeholder = "0.00",
	className,
	disabled,
	id,
}: MoneyInputProps) {
	const [displayValue, setDisplayValue] =
		React.useState(fromCents(value));

	React.useEffect(() => {
		setDisplayValue(fromCents(value));
	}, [value]);

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const inputValue = e.target.value;
		// Allow only numbers and one decimal point
		if (
			/^[\d]*\.?[\d]{0,2}$/.test(inputValue) ||
			inputValue === ""
		) {
			setDisplayValue(inputValue);
		}
	};

	const handleBlur = () => {
		const cents = toCents(displayValue);
		onChange(cents);
		setDisplayValue(fromCents(cents));
	};

	const inputId =
		id ||
		(label
			? label.toLowerCase().replace(/\s+/g, "-")
			: undefined);

	return (
		<div className={cn("space-y-2", className)}>
			{label && (
				<Label htmlFor={inputId}>{label}</Label>
			)}
			<div className="relative">
				<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
					R
				</span>
				<Input
					id={inputId}
					type="text"
					inputMode="decimal"
					value={displayValue}
					onChange={handleChange}
					onBlur={handleBlur}
					placeholder={placeholder}
					disabled={disabled}
					className="pl-7"
				/>
			</div>
		</div>
	);
}
