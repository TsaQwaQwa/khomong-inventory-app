import { Suspense } from "react";
import { StockCountsClient } from "./stock-counts-client";

export default function StockCountsPage() {
	return (
		<Suspense
			fallback={
				<div className="p-6 text-sm text-muted-foreground">
					Loading stock count...
				</div>
			}
		>
			<StockCountsClient />
		</Suspense>
	);
}
