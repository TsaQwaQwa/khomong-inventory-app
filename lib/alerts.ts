import type { DailyReport } from "@/lib/types";
import { Alert } from "@/models/Alert";

export async function syncStockAlertsForDay({
	scopeId,
	date,
	summary,
}: {
	scopeId: string;
	date: string;
	summary: DailyReport;
}) {
	const recs = summary.stockRecommendations ?? [];
	const out = recs.filter((r) => r.priority === "HIGH");
	const low = recs.filter((r) => r.priority === "MEDIUM");

	const definitions: Array<{
		type:
			| "OUT_OF_STOCK"
			| "LOW_STOCK"
			| "DAILY_PURCHASE_PLAN";
		priority: "HIGH" | "MEDIUM";
		title: string;
		detail: string;
		affectedCount: number;
		items: Array<{
			productId: string;
			label: string;
		}>;
	}> = [];

	if (out.length > 0) {
		definitions.push({
			type: "OUT_OF_STOCK",
			priority: "HIGH",
			title: "Out of stock products",
			detail: `${out.length} product(s) are out of stock.`,
			affectedCount: out.length,
			items: out.map((r) => ({
				productId: r.productId,
				label: r.productName,
			})),
		});
	}
	if (low.length > 0) {
		definitions.push({
			type: "LOW_STOCK",
			priority: "MEDIUM",
			title: "Low stock products",
			detail: `${low.length} product(s) are below reorder level.`,
			affectedCount: low.length,
			items: low.map((r) => ({
				productId: r.productId,
				label: r.productName,
			})),
		});
	}
	if (recs.length > 0) {
		definitions.push({
			type: "DAILY_PURCHASE_PLAN",
			priority: "MEDIUM",
			title: "Daily suggested purchase list",
			detail:
				"Suggested quantities based on recent sell-through and reorder levels.",
			affectedCount: recs.length,
			items: recs.map((rec) => ({
				productId: rec.productId,
				label: `${rec.productName} (${rec.recommendedOrderUnits}u)`,
			})),
		});
	}

	for (const definition of definitions) {
		const dedupeKey = `${scopeId}:${date}:${definition.type}`;
		await Alert.findOneAndUpdate(
			{ dedupeKey },
			{
				$set: {
					scopeId,
					date,
					type: definition.type,
					priority: definition.priority,
					title: definition.title,
					detail: definition.detail,
					affectedCount: definition.affectedCount,
					items: definition.items,
				},
				$setOnInsert: {
					status: "UNREAD",
					dedupeKey,
				},
			},
			{
				new: true,
				upsert: true,
			},
		);
	}
}
