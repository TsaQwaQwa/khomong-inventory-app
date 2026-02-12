import * as React from "react";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

interface EmptyStateProps {
	icon?: React.ReactNode;
	title: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}

export function EmptyState({
	icon,
	title,
	description,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border bg-card",
				className,
			)}
		>
			<div className="rounded-full bg-muted p-4 mb-4">
				{icon || (
					<Package className="h-8 w-8 text-muted-foreground" />
				)}
			</div>
			<h3 className="text-lg font-semibold text-foreground">
				{title}
			</h3>
			{description && (
				<p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
					{description}
				</p>
			)}
			{action && (
				<div className="mt-6">{action}</div>
			)}
		</div>
	);
}
