import { auth } from "@clerk/nextjs/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
	const { userId, orgId } = await auth();

	if (!userId) {
		return (
			<div className="container px-4 py-12 text-center">
				<h1 className="text-2xl font-bold mb-2">
					Please sign in
				</h1>
				<p className="text-muted-foreground">
					You need to be signed in to access the
					dashboard.
				</p>
			</div>
		);
	}

	if (!orgId) {
		return (
			<div className="container px-4 py-12 text-center">
				<h1 className="text-2xl font-bold mb-2">
					No active organization
				</h1>
				<p className="text-muted-foreground">
					Please select or create an organization
					to continue.
				</p>
			</div>
		);
	}

	return <DashboardClient />;
}
