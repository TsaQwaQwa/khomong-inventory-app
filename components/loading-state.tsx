import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Card,
	CardContent,
	CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
	className?: string;
}

export function LoadingCards({
	className,
}: LoadingStateProps) {
	return (
		<div
			className={cn(
				"grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
				className,
			)}
		>
			{[...Array(4)].map((_, i) => (
				<Card key={i} className="shadow-md">
					<CardHeader className="pb-2">
						<Skeleton className="h-4 w-24" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-8 w-32" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function LoadingTable({
	className,
}: LoadingStateProps) {
	return (
		<div className={cn("space-y-3", className)}>
			<Skeleton className="h-10 w-full" />
			{[...Array(5)].map((_, i) => (
				<Skeleton
					key={i}
					className="h-12 w-full"
				/>
			))}
		</div>
	);
}

export function LoadingForm({
	className,
}: LoadingStateProps) {
	return (
		<div className={cn("space-y-4", className)}>
			{[...Array(4)].map((_, i) => (
				<div key={i} className="space-y-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-10 w-full" />
				</div>
			))}
		</div>
	);
}
