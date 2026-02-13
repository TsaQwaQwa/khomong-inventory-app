import { requireOrgAuth } from "@/lib/authz";
import { AlertsClient } from "./alerts-client";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
	try {
		await requireOrgAuth();
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "";
		const isBlocked =
			message === "FORBIDDEN_USER";
		return (
			<div className="container px-4 py-12 text-center">
				<h1 className="text-2xl font-bold mb-2">
					{isBlocked
						? "Access blocked"
						: "Please sign in"}
				</h1>
				<p className="text-muted-foreground">
					{isBlocked
						? "Your account is not approved for this site."
						: "You need to be signed in to access alerts."}
				</p>
			</div>
		);
	}

	return <AlertsClient />;
}

