interface WhatsAppResult {
	ok: boolean;
	messageId?: string;
	error?: string;
}

function isEnabled() {
	return Boolean(
		process.env.WHATSAPP_ACCESS_TOKEN &&
			process.env.WHATSAPP_PHONE_NUMBER_ID &&
			process.env.WHATSAPP_TO_PHONE,
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
	const to = process.env.WHATSAPP_TO_PHONE!;
	const version =
		process.env.WHATSAPP_API_VERSION ?? "v20.0";
	const endpoint = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

	try {
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
			return {
				ok: false,
				error:
					body?.error?.message ??
					"WhatsApp API error",
			};
		}
		const body = await res
			.json()
			.catch(() => ({}));
		const messageId =
			body?.messages?.[0]?.id;
		return { ok: true, messageId };
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
