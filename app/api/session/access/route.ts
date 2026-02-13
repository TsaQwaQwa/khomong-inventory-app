export const runtime = "nodejs";

import { requireOrgAuth, isCurrentUserAdminEmail } from "@/lib/authz";
import { ok, fail } from "@/lib/http";

export async function GET() {
	try {
		await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	try {
		const isAdmin = await isCurrentUserAdminEmail();
		return ok({ isAdmin });
	} catch {
		return fail("Failed to resolve access", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}

