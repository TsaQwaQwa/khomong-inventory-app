"use client";

import * as React from "react";

interface OfflineAuthModeValue {
	clerkEnabled: boolean;
	offlineTrusted: boolean;
}

const OfflineAuthModeContext =
	React.createContext<OfflineAuthModeValue>({
		clerkEnabled: true,
		offlineTrusted: false,
	});

export function OfflineAuthModeProvider({
	value,
	children,
}: {
	value: OfflineAuthModeValue;
	children: React.ReactNode;
}) {
	return (
		<OfflineAuthModeContext.Provider value={value}>
			{children}
		</OfflineAuthModeContext.Provider>
	);
}

export function useOfflineAuthMode() {
	return React.useContext(OfflineAuthModeContext);
}
