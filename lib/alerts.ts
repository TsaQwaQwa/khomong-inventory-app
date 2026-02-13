import type { DailyReport } from "@/lib/types";
import { Alert } from "@/models/Alert";
import { sendWhatsAppText } from "@/lib/whatsapp";

function buildMessage(
	date: string,
	title: string,
	detail: string,
	items: string[],
) {
	const list =
		items.length > 0
			? `\nItems: ${items.join(", ")}`
			: "";
	return `Stock Alert (${date})\n${title}\n${detail}${list}`;
}

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
		items: string[];
	}> = [];

	if (out.length > 0) {
		definitions.push({
			type: "OUT_OF_STOCK",
			priority: "HIGH",
			title: "Out of stock products",
			detail: `${out.length} product(s) are out of stock.`,
			items: out.slice(0, 6).map((r) => r.productName),
		});
	}
	if (low.length > 0) {
		definitions.push({
			type: "LOW_STOCK",
			priority: "MEDIUM",
			title: "Low stock products",
			detail: `${low.length} product(s) are below reorder level.`,
			items: low.slice(0, 6).map((r) => r.productName),
		});
	}
	if (recs.length > 0) {
		definitions.push({
			type: "DAILY_PURCHASE_PLAN",
			priority: "MEDIUM",
			title: "Daily suggested purchase list",
			detail:
				"Suggested quantities based on recent sell-through and reorder levels.",
			items: recs.slice(0, 8).map(
				(rec) =>
					`${rec.productName} (${rec.recommendedOrderUnits}u)`,
			),
		});
	}

	for (const definition of definitions) {
		const dedupeKey = `${scopeId}:${date}:${definition.type}`;
		const alert = await Alert.findOneAndUpdate(
			{ dedupeKey },
			{
				$set: {
					scopeId,
					date,
					type: definition.type,
					priority: definition.priority,
					title: definition.title,
					detail: definition.detail,
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

		if (alert.whatsappSentAt) continue;

		const result = await sendWhatsAppText(
			buildMessage(
				date,
				definition.title,
				definition.detail,
				definition.items,
			),
		);

		if (result.ok) {
			await Alert.updateOne(
				{ _id: alert._id },
				{
					$set: {
						whatsappSentAt: new Date(),
						whatsappMessageId:
							result.messageId,
						whatsappDeliveryStatus: "SENT",
						whatsappStatusAt: new Date(),
						whatsappError: undefined,
					},
				},
			);
		} else {
			await Alert.updateOne(
				{ _id: alert._id },
				{
					$set: {
						whatsappError:
							result.error ??
							"Failed to send WhatsApp",
					},
				},
			);
		}
	}
}
