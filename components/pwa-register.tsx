"use client";

import * as React from "react";

const BASE_NAVIGATION_ROUTES = [
	"/dashboard",
	"/products",
	"/purchases",
	"/suppliers",
	"/transactions",
	"/tabs",
	"/alerts",
	"/adjustments",
	"/exceptions",
];
const ADMIN_NAVIGATION_ROUTES = ["/reports", "/audit"];

const resolveWarmRoutes = async () => {
	try {
		const accessRes = await fetch("/api/session/access", {
			method: "GET",
			cache: "no-store",
		});
		if (!accessRes.ok) return [];
		const accessJson = await accessRes
			.json()
			.catch(() => ({}));
		const access = accessJson?.data ?? accessJson;
		const isAdmin = Boolean(access?.isAdmin);
		return isAdmin
			? [...BASE_NAVIGATION_ROUTES, ...ADMIN_NAVIGATION_ROUTES]
			: BASE_NAVIGATION_ROUTES;
	} catch {
		return [];
	}
};

export function PwaRegister() {
	React.useEffect(() => {
		if (typeof window === "undefined") return;
		if (!("serviceWorker" in navigator)) return;

		const warmRoutes = async () => {
			if (!navigator.onLine) return;
			try {
				const routes = await resolveWarmRoutes();
				if (routes.length === 0) return;
				const registration =
					await navigator.serviceWorker.ready;
				const worker =
					registration.active ??
					registration.waiting ??
					registration.installing;
				worker?.postMessage({
					type: "WARM_NAV_ROUTES",
					routes,
				});
			} catch {
				// best effort warming
			}
		};

		const register = async () => {
			try {
				await navigator.serviceWorker.register("/sw.js");
				await warmRoutes();
			} catch {
				// best effort registration
			}
		};

		void register();
		const onOnline = () => {
			void warmRoutes();
		};
		window.addEventListener("online", onOnline);
		return () => {
			window.removeEventListener("online", onOnline);
		};
	}, []);

	return null;
}
