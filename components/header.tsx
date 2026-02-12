"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	BarChart3,
	Package,
	ShoppingCart,
	AlertTriangle,
	Receipt,
	CreditCard,
	Menu,
} from "lucide-react";

const navItems = [
	{
		href: "/dashboard",
		label: "Daily Overview",
		icon: BarChart3,
	},
	{
		href: "/products",
		label: "Products & Prices",
		icon: Package,
	},
	{
		href: "/purchases",
		label: "Stock Purchases",
		icon: ShoppingCart,
	},
	{
		href: "/adjustments",
		label: "Stock Adjustments",
		icon: AlertTriangle,
	},
	{
		href: "/transactions",
		label: "Transactions",
		icon: Receipt,
	},
	{
		href: "/tabs",
		label: "Customer Accounts",
		icon: CreditCard,
	},
];

export function Header() {
	const pathname = usePathname();
	const [open, setOpen] = React.useState(false);

	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="container flex h-14 items-center px-4">
				<Link
					href="/dashboard"
					className="mr-6 flex items-center space-x-2"
				>
					<span className="font-bold text-lg">
						Kgomong
					</span>
				</Link>

				{/* Desktop Navigation */}
				<nav className="hidden md:flex items-center space-x-1 text-sm">
					{navItems.map((item) => {
						const isActive =
							pathname === item.href;
						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									"flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors",
									isActive
										? "bg-accent text-accent-foreground font-medium"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
								)}
							>
								<item.icon className="h-4 w-4" />
								<span>{item.label}</span>
							</Link>
						);
					})}
				</nav>

				{/* Mobile Navigation */}
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger
						asChild
						className="md:hidden ml-auto"
					>
						<Button variant="ghost" size="icon">
							<Menu className="h-5 w-5" />
							<span className="sr-only">
								Open navigation menu
							</span>
						</Button>
					</SheetTrigger>
					<SheetContent
						side="left"
						className="w-70"
					>
						<SheetTitle className="text-left mb-6">
							Kgomong
						</SheetTitle>
						<nav className="flex flex-col space-y-1">
							{navItems.map((item) => {
								const isActive =
									pathname === item.href;
								return (
									<Link
										key={item.href}
										href={item.href}
										onClick={() => setOpen(false)}
										className={cn(
											"flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
											isActive
												? "bg-accent text-accent-foreground font-medium"
												: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
										)}
									>
										<item.icon className="h-5 w-5" />
										<span>{item.label}</span>
									</Link>
								);
							})}
						</nav>
					</SheetContent>
				</Sheet>
			</div>
		</header>
	);
}
