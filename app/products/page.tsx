import { requireOrgAuth } from "@/lib/authz";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
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
						: "You need to be signed in to access products."}
				</p>
			</div>
		);
	}

	return <ProductsClient />;
}
