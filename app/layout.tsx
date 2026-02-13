import React from "react";
import type { Metadata } from "next";
import {
	Geist,
	Geist_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { Header } from "@/components/header";
import { GlobalQuickActions } from "@/components/global-quick-actions";
import { OfflineSalesSync } from "@/components/offline-sales-sync";
import { ClerkProvider } from "@clerk/nextjs";
import { SwrProvider } from "@/components/swr-provider";

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
	icons: {
		icon: [
			{
				url: "/icon-light-32x32.png",
				media: "(prefers-color-scheme: light)",
			},
			{
				url: "/icon-dark-32x32.png",
				media: "(prefers-color-scheme: dark)",
			},
			{
				url: "/icon.svg",
				type: "image/svg+xml",
			},
		],
		apple: "/apple-icon.png",
	},
};

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
				<ClerkProvider>
					<Header />
					<SwrProvider>
						<OfflineSalesSync />
						<main className="flex-1 w-full">
							{children}
						</main>
						<GlobalQuickActions />
					</SwrProvider>
					<Toaster
						position="top-right"
						richColors
						closeButton
					/>
					<Analytics />
				</ClerkProvider>
			</body>
		</html>
	);
}
