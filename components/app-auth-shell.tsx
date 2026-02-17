"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import {
	OfflineAuthModeProvider,
} from "@/lib/offline-auth-mode";

const OFFLINE_TRUST_KEY = "kgomong_offline_trust_v1";
const OFFLINE_TRUST_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function readOfflineTrust(): boolean {
	try {
		const raw = localStorage.getItem(OFFLINE_TRUST_KEY);
		if (!raw) return false;
		const parsed = JSON.parse(raw) as {
			trustedAt?: number;
		};
		if (
			typeof parsed?.trustedAt !== "number" ||
			!Number.isFinite(parsed.trustedAt)
		) {
			return false;
		}
		return (
			Date.now() - parsed.trustedAt <= OFFLINE_TRUST_MAX_AGE_MS
		);
	} catch {
		return false;
	}
}

function writeOfflineTrust() {
	try {
		localStorage.setItem(
			OFFLINE_TRUST_KEY,
			JSON.stringify({
				trustedAt: Date.now(),
			}),
		);
	} catch {
		// best effort persistence
	}
}

export function AppAuthShell({
	children,
}: {
	children: React.ReactNode;
}) {
	const [hydrated, setHydrated] = React.useState(false);
	const [isOnline, setIsOnline] = React.useState(true);
	const [offlineTrusted, setOfflineTrusted] =
		React.useState(false);

	React.useEffect(() => {
		setHydrated(true);
		setIsOnline(navigator.onLine);
		setOfflineTrusted(readOfflineTrust());

		const onOnline = () => setIsOnline(true);
		const onOffline = () => setIsOnline(false);
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
		};
	}, []);

	React.useEffect(() => {
		if (!hydrated || !isOnline) return;
		let cancelled = false;
		const verifySession = async () => {
			try {
				const res = await fetch("/api/session/access", {
					method: "GET",
					cache: "no-store",
				});
				if (!res.ok || cancelled) return;
				writeOfflineTrust();
				setOfflineTrusted(true);
			} catch {
				// best effort verification
			}
		};
		void verifySession();
		return () => {
			cancelled = true;
		};
	}, [hydrated, isOnline]);

	if (!hydrated) return null;

	const clerkEnabled = isOnline;
	const canUseOfflineShell = !isOnline && offlineTrusted;

	if (!clerkEnabled && !canUseOfflineShell) {
		return (
			<OfflineAuthModeProvider
				value={{
					clerkEnabled: false,
					offlineTrusted: false,
				}}
			>
				<section className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">
						Offline sign-in required
					</h1>
					<p className="text-sm text-muted-foreground">
						Reconnect once to verify a session, then offline mode
						will load cached pages on this device.
					</p>
				</section>
			</OfflineAuthModeProvider>
		);
	}

	const content = (
		<OfflineAuthModeProvider
			value={{
				clerkEnabled,
				offlineTrusted: canUseOfflineShell,
			}}
		>
			{children}
		</OfflineAuthModeProvider>
	);

	if (!clerkEnabled) return content;

	return <ClerkProvider>{content}</ClerkProvider>;
}
