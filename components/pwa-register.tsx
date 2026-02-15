"use client";

import * as React from "react";

export function PwaRegister() {
	React.useEffect(() => {
		if (typeof window === "undefined") return;
		if (!("serviceWorker" in navigator)) return;

		const register = async () => {
			try {
				await navigator.serviceWorker.register("/sw.js");
			} catch {
				// best effort registration
			}
		};

		void register();
	}, []);

	return null;
}
