export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Alert } from "@/models/Alert";
import { WhatsAppMessageEvent } from "@/models/WhatsAppMessageEvent";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const mode = url.searchParams.get("hub.mode");
	const token = url.searchParams.get(
		"hub.verify_token",
	);
	const challenge = url.searchParams.get(
		"hub.challenge",
	);
	const expected =
		process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

		console.log(
			"WhatsApp webhook verification attempt",
			{ mode, token, challenge, expected },
		);
	if (
		mode === "subscribe" &&
		token &&
		expected &&
		token === expected &&
		challenge
	) {
		return new NextResponse(challenge, {
			status: 200,
		});
	}
	return new NextResponse("Forbidden", {
		status: 403,
	});
}

export async function POST(req: Request) {
	try {
		await connectDB();
		const payload = (await req.json()) as {
			entry?: Array<{
				changes?: Array<{
					value?: {
						statuses?: Array<{
							id?: string;
							status?: string;
							timestamp?: string;
							recipient_id?: string;
							conversation?: { id?: string };
							pricing?: {
								category?: string;
							};
							errors?: Array<{
								code?: number;
								title?: string;
							}>;
						}>;
					};
				}>;
			}>;
		};

		const statuses =
			payload.entry?.flatMap((entry) =>
				(entry.changes ?? []).flatMap((change) =>
					change.value?.statuses ?? [],
				),
			) ?? [];

		for (const status of statuses) {
			const messageId = status.id;
			const state = status.status;
			if (!messageId || !state) continue;

			const statusAt = status.timestamp
				? new Date(
						Number(status.timestamp) * 1000,
				  )
				: new Date();
			const err = status.errors?.[0];
			const dedupeKey = `${messageId}:${state}:${status.timestamp ?? statusAt.toISOString()}`;

			await WhatsAppMessageEvent.findOneAndUpdate(
				{ dedupeKey },
				{
					$setOnInsert: {
						dedupeKey,
						messageId,
						status: state,
						recipientId: status.recipient_id,
						conversationId:
							status.conversation?.id,
						pricingCategory:
							status.pricing?.category,
						errorMessage: err?.title,
						errorCode: err?.code,
						raw: status as unknown as Record<
							string,
							unknown
						>,
					},
				},
				{ upsert: true, new: true },
			);

			await Alert.updateMany(
				{
					$or: [
						{
							whatsappMessageId:
								messageId,
						},
						{
							whatsappMessageIds:
								messageId,
						},
					],
				},
				{
					$set: {
						whatsappDeliveryStatus: state.toUpperCase(),
						whatsappStatusAt: statusAt,
						whatsappError: err?.title,
						"whatsappRecipients.$[recipient].deliveryStatus":
							state.toUpperCase(),
						"whatsappRecipients.$[recipient].deliveryError":
							err?.title,
						"whatsappRecipients.$[recipient].lastStatusAt":
							statusAt,
					},
				},
				{
					arrayFilters: [
						{
							"recipient.messageId": messageId,
						},
					],
				},
			);
			const updatedAlerts = await Alert.find({
				$or: [
					{ whatsappMessageId: messageId },
					{ whatsappMessageIds: messageId },
				],
			}).lean();
			void updatedAlerts;
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error(
			"WhatsApp webhook processing failed",
			error,
		);
		return NextResponse.json(
			{ ok: false },
			{ status: 200 },
		);
	}
}
