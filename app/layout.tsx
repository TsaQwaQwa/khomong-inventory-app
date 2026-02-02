import React from "react";
import type { Metadata } from "next";
import {
	Geist,
	Geist_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { Header } from "@/components/header";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Tavern Monitor",
	description:
		"Stock control and cash management for your tavern",
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
		<ClerkProvider>
			<html lang="en">
				<body className="font-sans antialiased min-h-screen flex flex-col">
					<Header />
					<main className="flex-1">
						{children}
					</main>
					<Toaster
						position="top-right"
						richColors
						closeButton
					/>
					<Analytics />
				</body>
			</html>
		</ClerkProvider>
	);
}
