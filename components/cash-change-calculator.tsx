"use client";

import * as React from "react";
import { MoneyInput } from "@/components/money-input";
import { formatZAR } from "@/lib/money";

interface CashChangeCalculatorProps {
	totalCents: number;
	cashReceivedCents: number;
	onCashReceivedChange: (value: number) => void;
}

export function CashChangeCalculator({
	totalCents,
	cashReceivedCents,
	onCashReceivedChange,
}: CashChangeCalculatorProps) {
	const safeTotal = Math.max(0, totalCents);
	const safeReceived = Math.max(0, cashReceivedCents);
	const deltaCents = safeReceived - safeTotal;
	const hasChange = deltaCents >= 0;

	return (
		<div className="space-y-2 rounded-md border p-3">
			<MoneyInput
				label="Cash Received"
				value={safeReceived}
				onChange={onCashReceivedChange}
				placeholder="0.00"
			/>
			<div className="text-sm">
				<p className="text-muted-foreground">
					Due: {formatZAR(safeTotal)}
				</p>
				<p
					className={
						hasChange
							? "font-medium text-emerald-700"
							: "font-medium text-destructive"
					}
				>
					{hasChange
						? `Change: ${formatZAR(deltaCents)}`
						: `Short: ${formatZAR(Math.abs(deltaCents))}`}
				</p>
			</div>
		</div>
	);
}
