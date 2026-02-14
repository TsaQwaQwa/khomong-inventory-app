"use client"

import * as React from "react";
import { SWRConfig } from "swr";
import { jsonFetcher } from "@/lib/swr";

export function SwrProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<SWRConfig
			value={{
				fetcher: jsonFetcher,
				revalidateOnFocus: false,
				revalidateOnReconnect: false,
				revalidateIfStale: false,
				dedupingInterval: 10000,
				errorRetryInterval: 2000,
				errorRetryCount: 1,
			}}
		>
			{children}
		</SWRConfig>
	);
}
