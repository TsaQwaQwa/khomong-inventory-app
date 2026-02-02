import * as React from "react";
import { cn } from "@/lib/utils";

interface PageWrapperProps {
	children: React.ReactNode;
	title: string;
	description?: string;
	actions?: React.ReactNode;
	className?: string;
}

export function PageWrapper({
	children,
	title,
	description,
	actions,
	className,
}: PageWrapperProps) {
	return (
		<div
			className={cn(
				"container px-4 py-6",
				className,
			)}
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-balance">
						{title}
					</h1>
					{description && (
						<p className="text-muted-foreground mt-1">
							{description}
						</p>
					)}
				</div>
				{actions && (
					<div className="flex items-center gap-2">
						{actions}
					</div>
				)}
			</div>
			{children}
		</div>
	);
}
