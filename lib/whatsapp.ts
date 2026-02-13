interface WhatsAppResult {
	ok: boolean;
	messageId?: string;
	messageIds?: string[];
	error?: string;
}

function parseRecipients() {
	const many = (
		process.env.WHATSAPP_TO_PHONES ?? ""
	)
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	const one = process.env.WHATSAPP_TO_PHONE;
	const recipients = new Set<string>();
	for (const recipient of many) recipients.add(recipient);
	if (one && one.trim()) recipients.add(one.trim());
	return Array.from(recipients);
}

function isEnabled() {
	return Boolean(
		process.env.WHATSAPP_ACCESS_TOKEN &&
			process.env.WHATSAPP_PHONE_NUMBER_ID &&
			parseRecipients().length > 0,
	);
}

export async function sendWhatsAppText(
	message: string,
): Promise<WhatsAppResult> {
	if (!isEnabled()) {
		return {
			ok: false,
			error:
				"WhatsApp env missing: set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TO_PHONE",
		};
	}

	const token = process.env.WHATSAPP_ACCESS_TOKEN!;
	const phoneNumberId =
		process.env.WHATSAPP_PHONE_NUMBER_ID!;
	const recipients = parseRecipients();
	const version =
		process.env.WHATSAPP_API_VERSION ?? "v20.0";
	const endpoint = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

	try {
		const messageIds: string[] = [];
		const failures: string[] = [];
		for (const to of recipients) {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messaging_product: "whatsapp",
					to,
					type: "text",
					text: { body: message },
				}),
			});
			if (!res.ok) {
				const body = await res
					.json()
					.catch(() => ({}));
				failures.push(
					`${to}: ${body?.error?.message ?? "WhatsApp API error"}`,
				);
				continue;
			}
			const body = await res
				.json()
				.catch(() => ({}));
			const messageId =
				body?.messages?.[0]?.id;
			if (messageId) messageIds.push(messageId);
		}

		if (messageIds.length === 0) {
			return {
				ok: false,
				error:
					failures.join(" | ") ||
					"No WhatsApp messages were sent",
			};
		}
		return {
			ok: failures.length === 0,
			messageId: messageIds[0],
			messageIds,
			error:
				failures.length > 0
					? failures.join(" | ")
					: undefined,
		};
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown WhatsApp error",
		};
	}
}
