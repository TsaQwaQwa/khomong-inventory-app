import { requireAdminEmail } from "@/lib/authz";
import { AuditClient } from "./audit-client";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
	try {
		await requireAdminEmail();
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "";
		const isBlocked =
			message === "FORBIDDEN_USER" ||
			message === "FORBIDDEN_ADMIN";
		return (
			<div className="container px-4 py-12 text-center">
				<h1 className="text-2xl font-bold mb-2">
					{isBlocked
						? "Access blocked"
						: "Please sign in"}
				</h1>
				<p className="text-muted-foreground">
					{isBlocked
						? "You do not have admin access for this page."
						: "You need to be signed in to access audit trail."}
				</p>
			</div>
		);
	}

	return <AuditClient />;
}
