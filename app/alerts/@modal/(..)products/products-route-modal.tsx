"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export function ProductsRouteModal({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) {
					router.back();
				}
			}}
		>
			<DialogContent className="h-[85vh] w-[95vw] max-w-6xl overflow-hidden p-0">
				<div className="h-full overflow-y-auto px-4 pb-4">
					{children}
				</div>
			</DialogContent>
		</Dialog>
	);
}
