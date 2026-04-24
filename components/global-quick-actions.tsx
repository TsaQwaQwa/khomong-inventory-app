"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	ClipboardList,
	CreditCard,
	PackageMinus,
	Plus,
	Receipt,
	ShoppingCart,
	Truck,
} from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getTodayJHB } from "@/lib/date-utils";

const ENABLED_PATHS = [
	"/dashboard",
	"/stock-counts",
	"/reports",
	"/products",
	"/purchases",
	"/suppliers",
	"/purchase-assistant",
	"/adjustments",
	"/tabs",
	"/transactions",
];

type QuickAction = {
	label: string;
	description: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	primary?: boolean;
};

const buildQuickActions = (date: string): QuickAction[] => [
	{
		label: "Start Morning Count",
		description: "Count opening stock before trading starts.",
		href: `/stock-counts?date=${date}`,
		icon: ClipboardList,
		primary: true,
	},
	{
		label: "Record Delivery",
		description: "Add supplier purchases received today.",
		href: "/purchases",
		icon: ShoppingCart,
	},
	{
		label: "Record Adjustment",
		description: "Capture breakage, freebies, theft, or corrections.",
		href: "/adjustments",
		icon: PackageMinus,
	},
	{
		label: "Customer Payment",
		description: "Record tab/customer account payments.",
		href: "/tabs?action=payment",
		icon: CreditCard,
	},
	{
		label: "Review Daily Movement",
		description: "Check calculated sold units and count warnings.",
		href: `/dashboard?tab=movement&to=${date}`,
		icon: Receipt,
	},
	{
		label: "Purchase Assistant",
		description: "Review restock recommendations.",
		href: "/purchase-assistant",
		icon: Truck,
	},
];

const getPagePrimaryHref = (pathname: string, date: string) => {
	if (pathname.startsWith("/stock-counts")) return null;
	if (pathname.startsWith("/dashboard")) return `/stock-counts?date=${date}`;
	if (pathname.startsWith("/purchases")) return "/purchases";
	if (pathname.startsWith("/adjustments")) return "/adjustments";
	if (pathname.startsWith("/tabs")) return "/tabs?action=payment";
	if (pathname.startsWith("/reports")) return `/dashboard?tab=movement&to=${date}`;
	return null;
};

export function GlobalQuickActions() {
	const pathname = usePathname();
	const [open, setOpen] = React.useState(false);
	const date = React.useMemo(() => getTodayJHB(), []);
	const show = ENABLED_PATHS.some((path) => pathname.startsWith(path));
	const actions = React.useMemo(() => buildQuickActions(date), [date]);
	const pagePrimaryHref = getPagePrimaryHref(pathname, date);
	const orderedActions = React.useMemo(() => {
		if (!pagePrimaryHref) return actions;
		const primary = actions.find((action) => action.href === pagePrimaryHref);
		if (!primary) return actions;
		return [
			{ ...primary, primary: true },
			...actions.filter((action) => action.href !== pagePrimaryHref),
		];
	}, [actions, pagePrimaryHref]);

	if (!show) return null;

	return (
		<div className="fixed bottom-4 right-4 z-40">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
						<Plus className="h-5 w-5" />
						<span className="sr-only">Open quick actions</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent
					side="top"
					align="end"
					className="w-[calc(100vw-2rem)] max-w-sm p-2 md:w-90"
				>
					<div className="space-y-2">
						<div className="px-1 pb-1">
							<p className="text-sm font-semibold">Daily operations</p>
							<p className="text-xs text-muted-foreground">
								Use these for today&apos;s stock workflow. Checkout is no longer the operating model.
							</p>
						</div>
						{orderedActions.map((action) => {
							const Icon = action.icon;
							return (
								<Button
									key={action.href}
									asChild
									variant={action.primary ? "default" : "outline"}
									className="h-auto w-full justify-start gap-3 py-3 text-left"
									onClick={() => setOpen(false)}
								>
									<Link href={action.href}>
										<Icon className="h-4 w-4 shrink-0" />
										<span className="min-w-0">
											<span className="block text-sm font-medium leading-none">
												{action.label}
											</span>
											<span className="mt-1 block text-xs font-normal text-muted-foreground">
												{action.description}
											</span>
										</span>
									</Link>
								</Button>
							);
						})}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
