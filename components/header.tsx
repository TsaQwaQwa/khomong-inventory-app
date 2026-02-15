"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlobalCommandSearch } from "@/components/global-command-search";
import {
	getOfflineQueueCount,
	offlineQueueChangedEvent,
} from "@/lib/offline-sales-queue";
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
	ShieldAlert,
	Bell,
	Receipt,
	CreditCard,
	Truck,
	ClipboardList,
	History,
	Menu,
	LogOut,
} from "lucide-react";

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
		href: "/exceptions",
		label: "Exceptions",
		icon: ShieldAlert,
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

interface HeaderSummary {
	isAdmin: boolean;
	unreadCount: number;
	todayOutOfStockCount: number;
}

const headerSummaryFetcher = async (url: string) => {
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok)
		return {
			isAdmin: false,
			unreadCount: 0,
			todayOutOfStockCount: 0,
		} as HeaderSummary;
	return (json?.data ?? json) as HeaderSummary;
};

export function Header() {
	const pathname = usePathname();
	const [open, setOpen] = React.useState(false);
	const [isOnline, setIsOnline] = React.useState(
		true,
	);
	const [offlineQueueCount, setOfflineQueueCount] =
		React.useState(0);
	const { data: headerSummary } = useSWR<
		HeaderSummary
	>(
		"/api/header/summary",
		headerSummaryFetcher,
	);
	const unreadAlertCount =
		headerSummary?.unreadCount ?? 0;
	const outOfStockCount =
		headerSummary?.todayOutOfStockCount ?? 0;
	const isAdmin =
		headerSummary?.isAdmin ?? false;
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
	React.useEffect(() => {
		const syncStatus = () => {
			setIsOnline(navigator.onLine);
			setOfflineQueueCount(getOfflineQueueCount());
		};
		syncStatus();
		window.addEventListener("online", syncStatus);
		window.addEventListener(
			"offline",
			syncStatus,
		);
		window.addEventListener(
			offlineQueueChangedEvent,
			syncStatus,
		);
		const id = window.setInterval(syncStatus, 5000);
		return () => {
			window.removeEventListener(
				"online",
				syncStatus,
			);
			window.removeEventListener(
				"offline",
				syncStatus,
			);
			window.removeEventListener(
				offlineQueueChangedEvent,
				syncStatus,
			);
			window.clearInterval(id);
		};
	}, []);

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
					<div
						className={cn(
							"hidden md:inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium",
							isOnline
								? "border-emerald-200 bg-emerald-50 text-emerald-700"
								: "border-amber-200 bg-amber-50 text-amber-700",
						)}
						title={
							offlineQueueCount > 0
								? `${offlineQueueCount} pending offline action${offlineQueueCount === 1 ? "" : "s"}`
								: "No pending offline actions"
						}
					>
						{isOnline ? "Online" : "Offline"}
						{offlineQueueCount > 0
							? ` - ${offlineQueueCount} pending`
							: ""}
					</div>
					<GlobalCommandSearch />
					<SignOutButton redirectUrl="/sign-in">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="hidden md:inline-flex"
						>
							<LogOut className="mr-2 h-4 w-4" />
							Logout
						</Button>
					</SignOutButton>
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
							<div
								className={cn(
									"mb-2 rounded-md border px-3 py-2 text-xs font-medium",
									isOnline
										? "border-emerald-200 bg-emerald-50 text-emerald-700"
										: "border-amber-200 bg-amber-50 text-amber-700",
								)}
							>
								{isOnline ? "Online" : "Offline"}
								{offlineQueueCount > 0
									? ` - ${offlineQueueCount} pending`
									: " - no pending actions"}
							</div>
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
						<div className="mt-4 border-t pt-4">
							<SignOutButton redirectUrl="/sign-in">
								<Button
									type="button"
									variant="outline"
									className="w-full justify-start"
									onClick={() =>
										setOpen(false)
									}
								>
									<LogOut className="mr-2 h-4 w-4" />
									Logout
								</Button>
							</SignOutButton>
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</header>
	);
}
