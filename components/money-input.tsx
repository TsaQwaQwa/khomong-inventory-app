"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fromCents } from "@/lib/money";

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
	const centsRef = React.useRef(
		Math.max(0, value),
	);

	React.useEffect(() => {
		const safeCents = Math.max(0, value);
		centsRef.current = safeCents;
		setDisplayValue(fromCents(safeCents));
	}, [value]);

	const applyCents = React.useCallback(
		(nextCents: number) => {
			const safeCents = Math.max(
				0,
				Math.trunc(nextCents),
			);
			centsRef.current = safeCents;
			onChange(safeCents);
			setDisplayValue(fromCents(safeCents));
		},
		[onChange],
	);

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		// Fallback path for environments where keydown
		// interception is inconsistent (mobile keyboards).
		const digitsOnly = e.target.value.replace(
			/\D/g,
			"",
		);
		const cents = digitsOnly
			? parseInt(digitsOnly, 10)
			: 0;
		applyCents(cents);
	};

	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (disabled) return;

		if (/^\d$/.test(e.key)) {
			e.preventDefault();
			const digit = parseInt(e.key, 10);
			const nextCents = Math.max(
				0,
				centsRef.current * 10 + digit,
			);
			applyCents(nextCents);
			return;
		}

		if (e.key === "Backspace") {
			e.preventDefault();
			const nextCents = Math.floor(
				centsRef.current / 10,
			);
			applyCents(nextCents);
			return;
		}

		if (e.key === "Delete") {
			e.preventDefault();
			applyCents(0);
		}
	};

	const handlePaste = (
		e: React.ClipboardEvent<HTMLInputElement>,
	) => {
		if (disabled) return;
		e.preventDefault();
		const pasted = e.clipboardData.getData("text");
		const digitsOnly = pasted.replace(/\D/g, "");
		if (!digitsOnly) return;
		applyCents(parseInt(digitsOnly, 10));
	};

	const handleFocus = (
		e: React.FocusEvent<HTMLInputElement>,
	) => {
		// Keep caret clear of separators.
		requestAnimationFrame(() => {
			const length = e.target.value.length;
			e.target.setSelectionRange(length, length);
		});
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
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					onFocus={handleFocus}
					placeholder={placeholder}
					disabled={disabled}
					className="pl-7"
				/>
			</div>
		</div>
	);
}
