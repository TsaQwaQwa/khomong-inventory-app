const SHELL_CACHE = "kgomong-shell-v1";
const API_CACHE = "kgomong-api-v1";
const STATIC_CACHE = "kgomong-static-v1";
const SHELL_URLS = ["/", "/dashboard", "/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg"];

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
							![SHELL_CACHE, API_CACHE, STATIC_CACHE].includes(key),
					)
					.map((key) => caches.delete(key)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(
			(async () => {
				try {
					const network = await fetch(request);
					const cache = await caches.open(SHELL_CACHE);
					cache.put(request, network.clone());
					return network;
				} catch {
					const cache = await caches.open(SHELL_CACHE);
					return (
						(await cache.match(request)) ||
						(await cache.match("/dashboard")) ||
						(await cache.match("/"))
					);
				}
			})(),
		);
		return;
	}

	if (url.pathname.startsWith("/api/")) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(API_CACHE);
				try {
					const network = await fetch(request);
					if (network.ok) {
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
			const cached = await cache.match(request);
			if (cached) return cached;
			try {
				const network = await fetch(request);
				if (network.ok) {
					cache.put(request, network.clone());
				}
				return network;
			} catch {
				return cached || Response.error();
			}
		})(),
	);
});
