export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireAdminEmail } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { resendFailedAlertRecipients } from "@/lib/alerts";

export async function POST(req: Request) {
	let a;
	try {
		a = await requireAdminEmail();
	} catch {
		return fail("Forbidden", {
			status: 403,
			code: "FORBIDDEN",
		});
	}

	await connectDB();
	const scopeId = a.orgId ?? a.userId!;

	try {
		const body = (await req.json()) as {
			alertId?: string;
		};
		if (!body.alertId) {
			return fail("alertId is required", {
				status: 400,
				code: "BAD_REQUEST",
			});
		}

		const result =
			await resendFailedAlertRecipients({
				scopeId,
				alertId: body.alertId,
			});
		return ok(result);
	} catch (error) {
		return fail(
			error instanceof Error
				? error.message
				: "Failed to resend failed recipients",
			{
				status: 500,
				code: "SERVER_ERROR",
			},
		);
	}
}
