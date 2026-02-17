"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const ENABLED_PATHS = [
	"/dashboard",
	"/reports",
	"/products",
	"/purchases",
	"/suppliers",
	"/purchase-assistant",
	"/adjustments",
	"/tabs",
	"/transactions",
];

const LazyGlobalQuickActions = dynamic(
	() =>
		import("@/components/global-quick-actions").then(
			(module) => module.GlobalQuickActions,
		),
	{ ssr: false },
);

export function DeferredGlobalQuickActions() {
	const pathname = usePathname();
	const [ready, setReady] = React.useState(false);
	const shouldMount = ENABLED_PATHS.some((path) =>
		pathname.startsWith(path),
	);

	React.useEffect(() => {
		if (!shouldMount) {
			setReady(false);
			return;
		}
		let cancelled = false;
		let timeoutId: ReturnType<typeof setTimeout> | null =
			null;
		const onIdle = () => {
			if (!cancelled) {
				setReady(true);
			}
		};

		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			const idleId = window.requestIdleCallback(onIdle, {
				timeout: 1200,
			});
			return () => {
				cancelled = true;
				window.cancelIdleCallback(idleId);
			};
		}

		timeoutId = setTimeout(onIdle, 600);
		return () => {
			cancelled = true;
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
		};
	}, [shouldMount, pathname]);

	if (!shouldMount || !ready) return null;
	return <LazyGlobalQuickActions />;
}
