export const runtime = "nodejs";

import { connectDB } from "@/lib/db";
import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { Alert } from "@/models/Alert";
import { todayYMD } from "@/lib/dates";

export async function GET() {
	let a;
	try {
		a = await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	await connectDB();
	const scopeId = a.orgId ?? a.userId!;
	const today = todayYMD();

	try {
		const [unreadCount, todayOutAlert] =
			await Promise.all([
				Alert.countDocuments({
					scopeId,
					status: "UNREAD",
				}),
				Alert.findOne({
					scopeId,
					date: today,
					type: "OUT_OF_STOCK",
				})
					.select({
						affectedCount: 1,
						detail: 1,
					})
					.lean(),
			]);

		let todayOutOfStockCount = 0;
		if (todayOutAlert) {
			if (
				typeof todayOutAlert.affectedCount ===
				"number"
			) {
				todayOutOfStockCount = Math.max(
					0,
					todayOutAlert.affectedCount,
				);
			} else {
				const parsed = Number(
					(todayOutAlert.detail ?? "")
						.trim()
						.match(/^(\d+)/)?.[1] ?? "0",
				);
				todayOutOfStockCount =
					Number.isFinite(parsed) &&
					parsed > 0
						? parsed
						: 0;
			}
		}

		return ok(
			{
				unreadCount,
				todayOutOfStockCount,
			},
			{
				headers: {
					"Cache-Control":
						"private, max-age=5, stale-while-revalidate=30",
				},
			},
		);
	} catch {
		return fail("Failed to load alerts summary", {
			status: 500,
			code: "SERVER_ERROR",
		});
	}
}
