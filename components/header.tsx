"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlobalCommandSearch } from "@/components/global-command-search";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	BarChart3,
	LineChart,
	Package,
	ShoppingCart,
	AlertTriangle,
	Bell,
	Receipt,
	CreditCard,
	Truck,
	ClipboardList,
	History,
	Menu,
} from "lucide-react";
import { getTodayJHB } from "@/lib/date-utils";

const navItems = [
	{
		href: "/dashboard",
		label: "Daily Overview",
		icon: BarChart3,
	},
	{
		href: "/reports",
		label: "Reports",
		icon: LineChart,
		adminOnly: true,
		desktopGroup: "more",
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
		href: "/suppliers",
		label: "Suppliers",
		icon: Truck,
	},
	{
		href: "/purchase-assistant",
		label: "Purchase Assistant",
		icon: ClipboardList,
		desktopGroup: "more",
	},
	{
		href: "/adjustments",
		label: "Stock Adjustments",
		icon: AlertTriangle,
		desktopGroup: "more",
	},
	{
		href: "/alerts",
		label: "Alerts",
		icon: Bell,
	},
	{
		href: "/audit",
		label: "Audit Trail",
		icon: History,
		adminOnly: true,
		desktopGroup: "more",
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

interface HeaderReport {
	stockRecommendations: {
		priority: "HIGH" | "MEDIUM";
	}[];
}
interface AccessData {
	isAdmin: boolean;
}
interface HeaderAlert {
	id: string;
	status: "UNREAD" | "READ";
}

const reportFetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) return null;
	return (json?.data ?? json) as HeaderReport;
};

const alertsFetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) return [];
	return (json?.data ?? json) as HeaderAlert[];
};

const accessFetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) return { isAdmin: false } as AccessData;
	return (json?.data ?? json) as AccessData;
};

export function Header() {
	const pathname = usePathname();
	const [open, setOpen] = React.useState(false);
	const today = React.useMemo(() => getTodayJHB(), []);
	const { data: report } = useSWR<HeaderReport | null>(
		`/api/reports/daily?date=${today}`,
		reportFetcher,
	);
	const lowStockCount =
		report?.stockRecommendations?.length ?? 0;
	const outOfStockCount =
		report?.stockRecommendations?.filter(
			(item) => item.priority === "HIGH",
		).length ?? 0;
	const { data: unreadAlerts = [] } = useSWR<
		HeaderAlert[]
	>(
		"/api/alerts?status=UNREAD&limit=100",
		alertsFetcher,
	);
	const unreadAlertCount = unreadAlerts.length;
	const { data: access } = useSWR<AccessData>(
		"/api/session/access",
		accessFetcher,
	);
	const isAdmin = access?.isAdmin ?? false;
	const visibleNavItems = React.useMemo(
		() =>
			navItems.filter(
				(item) => !item.adminOnly || isAdmin,
			),
		[isAdmin],
	);
	const desktopPrimaryItems = React.useMemo(
		() =>
			visibleNavItems.filter(
				(item) => item.desktopGroup !== "more",
			),
		[visibleNavItems],
	);
	const desktopMoreItems = React.useMemo(
		() =>
			visibleNavItems.filter(
				(item) => item.desktopGroup === "more",
			),
		[visibleNavItems],
	);
	const getBadgeCount = React.useCallback(
		(href: string) => {
			if (href === "/alerts") return unreadAlertCount;
			if (href === "/dashboard") return outOfStockCount;
			return 0;
		},
		[outOfStockCount, unreadAlertCount],
	);

	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="container max-w-none flex h-14 items-center gap-2 px-4">
				<Link
					href="/dashboard"
					className="mr-2 flex shrink-0 items-center space-x-2"
				>
					<span className="font-bold text-lg">
						Kgomong
					</span>
				</Link>

				{/* Desktop Navigation */}
				<nav className="hidden min-w-0 flex-1 items-center space-x-0.5 overflow-x-auto text-sm md:flex">
					{desktopPrimaryItems.map((item) => {
						const isActive =
							pathname === item.href;
						const badgeCount = getBadgeCount(
							item.href,
						);
						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									"flex shrink-0 items-center gap-1.5 px-2 py-2 rounded-md transition-colors",
									isActive
										? "bg-accent text-accent-foreground font-medium"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
								)}
							>
								<item.icon className="h-4 w-4" />
								<span>{item.label}</span>
								{badgeCount > 0 && (
									<span
										className={cn(
											"rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white",
											item.href ===
												"/dashboard"
												? "bg-amber-500"
												: "bg-rose-500",
										)}
									>
										{badgeCount}
									</span>
								)}
							</Link>
						);
					})}
					{desktopMoreItems.length > 0 && (
						<Popover>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="shrink-0"
								>
									More
								</Button>
							</PopoverTrigger>
							<PopoverContent
								align="start"
								className="w-56 p-2"
							>
								<div className="space-y-1">
									{desktopMoreItems.map((item) => {
										const isActive =
											pathname ===
											item.href;
										return (
											<Link
												key={`more-${item.href}`}
												href={
													item.href
												}
												className={cn(
													"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
													isActive
														? "bg-accent text-accent-foreground font-medium"
														: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
												)}
											>
												<item.icon className="h-4 w-4" />
												<span>
													{item.label}
												</span>
											</Link>
										);
									})}
								</div>
							</PopoverContent>
						</Popover>
					)}
				</nav>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					<GlobalCommandSearch />
				</div>

				{/* Mobile Navigation */}
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger
						asChild
						className="md:hidden"
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
						<div className="mb-6 flex items-center gap-2">
							<SheetTitle className="text-left">
								Kgomong
							</SheetTitle>
						</div>
						<nav className="flex flex-col space-y-1">
							{visibleNavItems.map((item) => {
								const isActive =
									pathname === item.href;
								const badgeCount = getBadgeCount(
									item.href,
								);
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
										{badgeCount > 0 && (
											<span
												className={cn(
													"ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white",
													item.href ===
														"/dashboard"
														? "bg-amber-500"
														: "bg-rose-500",
												)}
											>
												{badgeCount}
											</span>
										)}
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
