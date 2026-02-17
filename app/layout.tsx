import React from "react";
import type {
	Metadata,
	Viewport,
} from "next";
import {
	Geist,
	Geist_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { Header } from "@/components/header";
import { DeferredGlobalQuickActions } from "@/components/deferred-global-quick-actions";
import { OfflineSalesSync } from "@/components/offline-sales-sync";
import { PwaRegister } from "@/components/pwa-register";
import { ClerkProvider } from "@clerk/nextjs";
import { SwrProvider } from "@/components/swr-provider";
import { AppAuthShell } from "@/components/app-auth-shell";

import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Kgomong",
	description:
		"Simple stock, sales, and customer account tracking for Kgomong",
	generator: "v0.app",
	manifest: "/manifest.webmanifest",
	icons: {
		icon: [
			{
				url: "/icon.svg",
				type: "image/svg+xml",
			},
		],
		apple: "/icon-maskable.svg",
	},
};

export const viewport: Viewport = {
	themeColor: "#3b2f2f",
};

const offlineTestMode =
	process.env.NEXT_PUBLIC_OFFLINE_TEST_MODE === "true";

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				suppressHydrationWarning
				className="font-sans antialiased min-h-screen flex flex-col"
			>
				{offlineTestMode ? (
					<AppAuthShell>
						<Header />
						<SwrProvider>
							<PwaRegister />
							<OfflineSalesSync />
							<main className="flex-1 w-full">
								{children}
							</main>
							<DeferredGlobalQuickActions />
						</SwrProvider>
						<Toaster
							position="top-right"
							richColors
							closeButton
						/>
						<Analytics />
					</AppAuthShell>
				) : (
					<ClerkProvider>
						<Header />
						<SwrProvider>
							<PwaRegister />
							<OfflineSalesSync />
							<main className="flex-1 w-full">
								{children}
							</main>
							<DeferredGlobalQuickActions />
						</SwrProvider>
						<Toaster
							position="top-right"
							richColors
							closeButton
						/>
						<Analytics />
					</ClerkProvider>
				)}
			</body>
		</html>
	);
}
