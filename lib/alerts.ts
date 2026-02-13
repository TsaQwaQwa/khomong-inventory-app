import type { DailyReport } from "@/lib/types";
import { Alert } from "@/models/Alert";
import {
	sendWhatsAppText,
} from "@/lib/whatsapp";

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

		if (
			alert.whatsappSentAt ||
			(alert.whatsappMessageIds ?? []).length > 0
		) {
			continue;
		}
		const lockCutoff = new Date(
			Date.now() - 5 * 60 * 1000,
		);
		const lockClaim = await Alert.updateOne(
			{
				_id: alert._id,
				whatsappSentAt: { $exists: false },
				"whatsappMessageIds.0": {
					$exists: false,
				},
				$or: [
					{
						whatsappSendLockedAt: {
							$exists: false,
						},
					},
					{
						whatsappSendLockedAt: {
							$lt: lockCutoff,
						},
					},
				],
			},
			{
				$set: {
					whatsappSendLockedAt:
						new Date(),
				},
			},
		);
		if (lockClaim.modifiedCount === 0) {
			continue;
		}

		const result = await sendWhatsAppText(
			buildMessage(
				date,
				definition.title,
				definition.detail,
				definition.items,
			),
		);

		const hasAnyMessageId =
			(result.messageIds ?? []).length > 0;
		const recipientRows =
			result.recipientResults?.map((entry) => ({
				to: entry.to,
				sendStatus: entry.ok
					? "SENT"
					: "FAILED",
				sendError: entry.ok
					? undefined
					: entry.error,
				messageId: entry.messageId,
				deliveryStatus: entry.ok
					? "PENDING"
					: "FAILED",
				deliveryError: entry.ok
					? undefined
					: entry.error,
				lastStatusAt: new Date(),
			})) ?? [];
		if (result.ok || hasAnyMessageId) {
			await Alert.updateOne(
				{ _id: alert._id },
				{
					$set: {
						whatsappSentAt: new Date(),
						whatsappMessageId:
							result.messageId,
						whatsappMessageIds:
							result.messageIds ?? [],
						whatsappRecipients: recipientRows,
						whatsappDeliveryStatus:
							"PENDING",
						whatsappStatusAt: new Date(),
						whatsappError:
							result.ok
								? undefined
								: result.error,
					},
					$unset: {
						whatsappSendLockedAt: "",
					},
				},
			);
		} else {
			await Alert.updateOne(
				{ _id: alert._id },
				{
					$set: {
						whatsappMessageId:
							result.messageId,
						whatsappMessageIds:
							result.messageIds ?? [],
						whatsappRecipients: recipientRows,
						whatsappError:
							result.error ??
							"Failed to send WhatsApp",
					},
					$unset: {
						whatsappSendLockedAt: "",
					},
				},
			);
		}
	}
}

export async function resendFailedAlertRecipients({
	scopeId,
	alertId,
}: {
	scopeId: string;
	alertId: string;
}) {
	const alert = await Alert.findOne({
		_id: alertId,
		scopeId,
	}).lean();
	if (!alert) {
		throw new Error("Alert not found");
	}
	const recipients = (
		alert.whatsappRecipients ?? []
	)
		.filter(
			(entry) =>
				entry.sendStatus === "FAILED" ||
				entry.deliveryStatus === "FAILED",
		)
		.map((entry) => entry.to);

	if (!recipients.length) {
		return {
			skipped: true,
			message: "No failed recipients",
		};
	}

	const result = await sendWhatsAppText(
		buildMessage(
			alert.date,
			alert.title,
			alert.detail,
			[],
		),
		recipients,
	);

	const priorRows = alert.whatsappRecipients ?? [];
	const mergedRows = priorRows.map((row) => {
		const next = result.recipientResults?.find(
			(item) => item.to === row.to,
		);
		if (!next) return row;
		return {
			...row,
			sendStatus: next.ok ? "SENT" : "FAILED",
			sendError: next.ok ? undefined : next.error,
			messageId: next.messageId ?? row.messageId,
			deliveryStatus: next.ok
				? "PENDING"
				: row.deliveryStatus ?? "FAILED",
			deliveryError: next.ok
				? undefined
				: next.error ?? row.deliveryError,
			lastStatusAt: new Date(),
		};
	});

	const nextIds = Array.from(
		new Set([
			...(alert.whatsappMessageIds ?? []),
			...(result.messageIds ?? []),
		]),
	);

	await Alert.updateOne(
		{ _id: alertId, scopeId },
		{
			$set: {
				whatsappMessageId:
					nextIds[0] ?? alert.whatsappMessageId,
				whatsappMessageIds: nextIds,
				whatsappRecipients: mergedRows,
				whatsappSentAt: nextIds.length
					? new Date()
					: alert.whatsappSentAt,
				whatsappDeliveryStatus:
					result.ok || (result.messageIds ?? []).length
						? "PENDING"
						: alert.whatsappDeliveryStatus,
				whatsappStatusAt: new Date(),
				whatsappError: result.error,
			},
		},
	);

	return {
		skipped: false,
		message:
			result.error ??
			"Resent failed recipients",
	};
}
