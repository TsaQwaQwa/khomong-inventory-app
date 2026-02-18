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
const AUTH_PATH_PREFIXES = [
	"/sign-in",
	"/sign-up",
	"/sso-callback",
];
const CLERK_QUERY_PREFIX = "__clerk_";
const SW_RELOAD_GUARD_KEY =
	"kgomong.sw_controller_reload_at";
const SW_RELOAD_GUARD_MS = 30_000;

const hasClerkQueryParams = (url: URL) => {
	for (const key of url.searchParams.keys()) {
		if (key.startsWith(CLERK_QUERY_PREFIX)) {
			return true;
		}
	}
	return false;
};

const shouldSkipForcedReload = () => {
	const url = new URL(window.location.href);
	const isAuthRoute = AUTH_PATH_PREFIXES.some((prefix) =>
		url.pathname.startsWith(prefix),
	);
	return isAuthRoute || hasClerkQueryParams(url);
};

const canForceReloadNow = () => {
	try {
		const lastRaw = window.sessionStorage.getItem(
			SW_RELOAD_GUARD_KEY,
		);
		const last = lastRaw ? Number(lastRaw) : 0;
		const now = Date.now();
		if (
			Number.isFinite(last) &&
			last > 0 &&
			now - last < SW_RELOAD_GUARD_MS
		) {
			return false;
		}
		window.sessionStorage.setItem(
			SW_RELOAD_GUARD_KEY,
			String(now),
		);
		return true;
	} catch {
		return true;
	}
};

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
		let reloadedForNewWorker = false;

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
				const registration =
					await navigator.serviceWorker.register(
						"/sw.js",
					);
				void registration.update();
				await warmRoutes();
			} catch {
				// best effort registration
			}
		};

		void register();
		const onControllerChange = () => {
			if (reloadedForNewWorker) return;
			if (shouldSkipForcedReload()) return;
			if (!canForceReloadNow()) return;
			reloadedForNewWorker = true;
			window.location.reload();
		};
		const onOnline = () => {
			void warmRoutes();
		};
		navigator.serviceWorker.addEventListener(
			"controllerchange",
			onControllerChange,
		);
		window.addEventListener("online", onOnline);
		return () => {
			navigator.serviceWorker.removeEventListener(
				"controllerchange",
				onControllerChange,
			);
			window.removeEventListener("online", onOnline);
		};
	}, []);

	return null;
}
