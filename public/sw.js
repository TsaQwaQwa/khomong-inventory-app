const SHELL_CACHE = "kgomong-shell-v5";
const API_CACHE = "kgomong-api-v5";
const STATIC_CACHE = "kgomong-static-v5";
const SHELL_URLS = [
	"/",
	"/dashboard",
	"/offline",
	"/manifest.webmanifest",
	"/icon.svg",
	"/icon-maskable.svg",
];
const AUTH_PATH_PREFIXES = [
	"/sign-in",
	"/sign-up",
	"/sso-callback",
];
const CLERK_QUERY_PREFIX = "__clerk_";
const BASE_NAVIGATION_ROUTES = [];
const ADMIN_NAVIGATION_ROUTES = [];

const hasClerkQueryParams = (url) => {
	for (const key of url.searchParams.keys()) {
		if (key.startsWith(CLERK_QUERY_PREFIX)) {
			return true;
		}
	}
	return false;
};

const shouldCacheNavigationResponse = (response) => {
	const responseUrl = new URL(response.url);
	return (
		response.ok &&
		!response.redirected &&
		!response.url.includes("/sign-in") &&
		!hasClerkQueryParams(responseUrl)
	);
};

const warmNavigationRoute = async (route) => {
	const cache = await caches.open(SHELL_CACHE);
	const cached = await cache.match(route);
	if (cached) return;
	try {
		const network = await fetch(route, {
			credentials: "include",
		});
		if (!shouldCacheNavigationResponse(network)) return;
		await cache.put(route, network.clone());
	} catch {
		// best effort cache warming
	}
};

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			await cache.addAll(SHELL_URLS);
		})(),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter(
						(key) =>
							![
								SHELL_CACHE,
								API_CACHE,
								STATIC_CACHE,
							].includes(key),
					)
					.map((key) => caches.delete(key)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("message", (event) => {
	const data = event.data;
	if (!data || data.type !== "WARM_NAV_ROUTES") return;
	const routes = Array.isArray(data.routes)
		? data.routes
		: [...BASE_NAVIGATION_ROUTES, ...ADMIN_NAVIGATION_ROUTES];
	event.waitUntil(
		Promise.allSettled(
			routes.map((route) => warmNavigationRoute(route)),
		),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	const isAuthRoute = AUTH_PATH_PREFIXES.some((prefix) =>
		url.pathname.startsWith(prefix),
	);
	const hasClerkParams = hasClerkQueryParams(url);

	if (request.mode === "navigate") {
		if (isAuthRoute || hasClerkParams) {
			event.respondWith(fetch(request));
			return;
		}
		event.respondWith(
			(async () => {
				try {
					const network = await fetch(request);
					if (shouldCacheNavigationResponse(network)) {
						const cache = await caches.open(SHELL_CACHE);
						cache.put(request, network.clone());
						cache.put(url.pathname, network.clone());
					}
					return network;
				} catch {
					const cache = await caches.open(SHELL_CACHE);
					return (
						(await cache.match(request)) ||
						(await cache.match(url.pathname)) ||
						(await cache.match("/offline")) ||
						new Response("Offline and no cached page available.", {
							status: 503,
							headers: { "Content-Type": "text/plain" },
						})
					);
				}
			})(),
		);
		return;
	}

	if (url.pathname.startsWith("/api/")) {
		if (url.pathname === "/api/health") {
			event.respondWith(
				(async () => {
					try {
						return await fetch(request);
					} catch {
						return new Response(
							JSON.stringify({
								ok: false,
								error: {
									message: "Offline health probe failed.",
								},
							}),
							{
								status: 503,
								headers: {
									"Content-Type": "application/json",
								},
							},
						);
					}
				})(),
			);
			return;
		}

		event.respondWith(
			(async () => {
				const cache = await caches.open(API_CACHE);
				try {
					const network = await fetch(request);
					const isAuthError =
						network.status === 401 ||
						network.status === 403;
					if (network.ok && !isAuthError) {
						cache.put(request, network.clone());
					}
					return network;
				} catch {
					const cached = await cache.match(request);
					if (cached) return cached;
					return new Response(
						JSON.stringify({
							error: {
								message: "Offline and no cached response found.",
							},
						}),
						{
							status: 503,
							headers: {
								"Content-Type": "application/json",
							},
						},
					);
				}
			})(),
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(STATIC_CACHE);
			try {
				const network = await fetch(request);
				if (network.ok) {
					cache.put(request, network.clone());
				}
				return network;
			} catch {
				const cached = await cache.match(request);
				return cached || Response.error();
			}
		})(),
	);
});
