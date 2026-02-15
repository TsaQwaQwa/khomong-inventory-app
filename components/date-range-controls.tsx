"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { RangePreset } from "@/lib/date-range";
import {
	formatDateDisplay,
	formatDateYMD,
	parseDateYMD,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface DateRangeControlsProps {
	from: string;
	to: string;
	preset: RangePreset;
	onPresetChange: (preset: string) => void;
	onFromChange: (value: string) => void;
	onToChange: (value: string) => void;
	onRangeChange?: (from: string, to: string) => void;
	className?: string;
}

export function DateRangeControls({
	from,
	to,
	preset,
	onPresetChange,
	onFromChange,
	onToChange,
	onRangeChange,
	className,
}: DateRangeControlsProps) {
	const selectedRange = React.useMemo<DateRange>(
		() => ({
			from: parseDateYMD(from),
			to: parseDateYMD(to),
		}),
		[from, to],
	);
	const handleRangeSelect = React.useCallback(
		(next: DateRange | undefined) => {
			if (!next?.from) return;
			const fromYmd = formatDateYMD(next.from);
			const toYmd = formatDateYMD(
				next.to ?? next.from,
			);
			if (onRangeChange) {
				onRangeChange(fromYmd, toYmd);
				return;
			}
			onFromChange(fromYmd);
			onToChange(toYmd);
		},
		[
			onFromChange,
			onRangeChange,
			onToChange,
		],
	);
	const rangeLabel =
		from === to
			? formatDateDisplay(to)
			: `${formatDateDisplay(from)} - ${formatDateDisplay(to)}`;

	return (
		<div
			className={
				className ??
				"flex flex-col gap-2 sm:flex-row"
			}
		>
			<Select
				value={preset}
				onValueChange={onPresetChange}
			>
				<SelectTrigger className="w-[170px]">
					<SelectValue placeholder="Range preset" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="day">Day</SelectItem>
					<SelectItem value="week">Week</SelectItem>
					<SelectItem value="month">Month</SelectItem>
					<SelectItem value="year">Year</SelectItem>
					<SelectItem value="custom">Custom</SelectItem>
				</SelectContent>
			</Select>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className={cn(
							"w-[260px] justify-start text-left font-normal",
						)}
					>
						<CalendarIcon className="mr-2 h-4 w-4" />
						{rangeLabel}
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-auto p-0"
					align="start"
				>
					<Calendar
						mode="range"
						selected={selectedRange}
						onSelect={handleRangeSelect}
						numberOfMonths={2}
						initialFocus
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
