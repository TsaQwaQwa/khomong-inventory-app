import * as React from "react";

export default function AlertsLayout({
	children,
	modal,
}: {
	children: React.ReactNode;
	modal: React.ReactNode;
}) {
	return (
		<>
			{children}
			{modal}
		</>
	);
}
