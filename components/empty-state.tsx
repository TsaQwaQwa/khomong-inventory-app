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
				"flex flex-col items-center justify-center py-12 text-center",
				className,
			)}
		>
			<div className="rounded-full bg-muted p-4 mb-4">
				{icon || (
					<Package className="h-8 w-8 text-muted-foreground" />
				)}
			</div>
			<h3 className="text-lg font-medium">
				{title}
			</h3>
			{description && (
				<p className="text-muted-foreground mt-1 max-w-sm">
					{description}
				</p>
			)}
			{action && (
				<div className="mt-4">{action}</div>
			)}
		</div>
	);
}
