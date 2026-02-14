export const runtime = "nodejs";

import { requireOrgAuth } from "@/lib/authz";
import { ok, fail } from "@/lib/http";
import { todayYMD } from "@/lib/dates";
import { computeDailySummary } from "@/lib/reporting";
import { connectDB } from "@/lib/db";
import { syncStockAlertsForDay } from "@/lib/alerts";

type DailySummary = Awaited<
	ReturnType<typeof computeDailySummary>
>;

const dailySummaryCache = new Map<
	string,
	{ summary: DailySummary; expiresAt: number }
>();
const dailySummaryInflight = new Map<
	string,
	Promise<DailySummary>
>();

const getDailySummaryCacheKey = (
	scopeId: string,
	date: string,
) => `${scopeId}:${date}`;

const getDailySummaryTtlMs = (date: string) =>
	date === todayYMD() ? 15_000 : 300_000;

const pruneDailySummaryCache = () => {
	if (dailySummaryCache.size <= 500) return;
	const now = Date.now();
	for (const [key, value] of dailySummaryCache) {
		if (value.expiresAt <= now) {
			dailySummaryCache.delete(key);
		}
	}
	while (dailySummaryCache.size > 500) {
		const oldestKey =
			dailySummaryCache.keys().next().value;
		if (!oldestKey) break;
		dailySummaryCache.delete(oldestKey);
	}
};

async function getDailySummaryCached({
	scopeId,
	date,
	userId,
	forceFresh,
}: {
	scopeId: string;
	date: string;
	userId: string;
	forceFresh: boolean;
}) {
	const key = getDailySummaryCacheKey(scopeId, date);
	if (forceFresh) {
		dailySummaryCache.delete(key);
	}
	const now = Date.now();
	const cached = dailySummaryCache.get(key);
	if (cached && cached.expiresAt > now) {
		return {
			summary: cached.summary,
			cacheHit: true,
		};
	}

	const inflight = dailySummaryInflight.get(key);
	if (inflight) {
		return {
			summary: await inflight,
			cacheHit: true,
		};
	}

	const computePromise = computeDailySummary(
		date,
		userId,
	)
		.then((summary) => {
			dailySummaryCache.set(key, {
				summary,
				expiresAt:
					Date.now() + getDailySummaryTtlMs(date),
			});
			pruneDailySummaryCache();
			return summary;
		})
		.finally(() => {
			dailySummaryInflight.delete(key);
		});

	dailySummaryInflight.set(key, computePromise);
	return {
		summary: await computePromise,
		cacheHit: false,
	};
}

export async function GET(req: Request) {
	let a;
	try {
		a = await requireOrgAuth();
	} catch {
		return fail("Unauthorized", {
			status: 401,
			code: "UNAUTHORIZED",
		});
	}

	const url = new URL(req.url);
	const date =
		url.searchParams.get("date") ?? todayYMD();
	const forceFresh =
		url.searchParams.get("fresh") === "1";

	try {
		await connectDB();
		const scopeId = a.orgId ?? a.userId!;
		const { summary, cacheHit } =
			await getDailySummaryCached({
				scopeId,
				date,
				userId: a.userId!,
				forceFresh,
			});
		if (!cacheHit || forceFresh) {
			await syncStockAlertsForDay({
				scopeId,
				date,
				summary,
			});
		}
		return ok(summary);
	} catch (e: any) {
		console.error(
			"Daily report failure",
			{ date },
			e,
		);
		return fail(
			"Failed to compute daily summary",
			{ status: 500, code: "SERVER_ERROR" },
		);
	}
}
