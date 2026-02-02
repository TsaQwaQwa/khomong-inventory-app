"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
	formatDateYMD,
	parseDateYMD,
	formatDateDisplay,
} from "@/lib/date-utils";

interface DatePickerYMDProps {
	value: string; // YYYY-MM-DD
	onChange: (value: string) => void;
	className?: string;
	disabled?: boolean;
}

export function DatePickerYMD({
	value,
	onChange,
	className,
	disabled,
}: DatePickerYMDProps) {
	const date = value
		? parseDateYMD(value)
		: undefined;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled}
					className={cn(
						"w-[200px] justify-start text-left font-normal",
						!value && "text-muted-foreground",
						className,
					)}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{value ? (
						formatDateDisplay(value)
					) : (
						<span>Pick a date</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-auto p-0"
				align="start"
			>
				<Calendar
					mode="single"
					selected={date}
					onSelect={(d: Date | undefined) =>
						d && onChange(formatDateYMD(d))
					}
					initialFocus
				/>
			</PopoverContent>
		</Popover>
	);
}
