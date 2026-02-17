import { requireOrgAuth } from "@/lib/authz";
import { ProductsClient } from "../../../products/products-client";
import { ProductsRouteModal } from "./products-route-modal";

export const dynamic = "force-dynamic";

export default async function InterceptedProductsPage() {
	try {
		await requireOrgAuth();
	} catch {
		return null;
	}

	return (
		<ProductsRouteModal>
			<ProductsClient showFilters={false} />
		</ProductsRouteModal>
	);
}
