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
import type { Product } from "@/lib/types";

interface ProductSelectProps {
	products: Product[];
	value: string;
	onChange: (productId: string) => void;
	label?: string;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
}

export function ProductSelect({
	products,
	value,
	onChange,
	label,
	placeholder = "Select product",
	className,
	disabled,
}: ProductSelectProps) {
	// Group products by category
	const groupedProducts = React.useMemo(() => {
		const groups: Record<string, Product[]> = {};
		for (const product of products) {
			const cat = product.category || "Other";
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(product);
		}
		return groups;
	}, [products]);

	const categories = Object.keys(
		groupedProducts,
	).sort();

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
					{categories.map((category) => (
						<React.Fragment key={category}>
							<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
								{category}
							</div>
							{groupedProducts[category].map(
								(product) => (
									<SelectItem
										key={product.id}
										value={product.id}
									>
										{product.name}
									</SelectItem>
								),
							)}
						</React.Fragment>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
