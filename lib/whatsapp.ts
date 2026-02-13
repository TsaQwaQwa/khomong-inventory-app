interface WhatsAppResult {
	ok: boolean;
	messageId?: string;
	messageIds?: string[];
	recipientResults?: Array<{
		to: string;
		ok: boolean;
		messageId?: string;
		error?: string;
	}>;
	error?: string;
}

export function getConfiguredWhatsAppRecipients() {
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

function isEnabled(recipientsCount: number) {
	return Boolean(
		process.env.WHATSAPP_ACCESS_TOKEN &&
			process.env.WHATSAPP_PHONE_NUMBER_ID &&
			recipientsCount > 0,
	);
}

export async function sendWhatsAppText(
	message: string,
	recipientsOverride?: string[],
): Promise<WhatsAppResult> {
	const recipients =
		recipientsOverride && recipientsOverride.length > 0
			? Array.from(
					new Set(
						recipientsOverride
							.map((value) => value.trim())
							.filter(Boolean),
					),
			  )
			: getConfiguredWhatsAppRecipients();
	if (!isEnabled(recipients.length)) {
		return {
			ok: false,
			error:
				"WhatsApp env missing: set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and recipient(s) in WHATSAPP_TO_PHONE or WHATSAPP_TO_PHONES",
			recipientResults: recipients.map((to) => ({
				to,
				ok: false,
				error:
					"WhatsApp env missing: set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID",
			})),
		};
	}

	const token = process.env.WHATSAPP_ACCESS_TOKEN!;
	const phoneNumberId =
		process.env.WHATSAPP_PHONE_NUMBER_ID!;
	const version =
		process.env.WHATSAPP_API_VERSION ?? "v20.0";
	const endpoint = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

	try {
		const messageIds: string[] = [];
		const failures: string[] = [];
		const recipientResults: Array<{
			to: string;
			ok: boolean;
			messageId?: string;
			error?: string;
		}> = [];
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
				const error =
					body?.error?.message ??
					"WhatsApp API error";
				failures.push(
					`${to}: ${error}`,
				);
				recipientResults.push({
					to,
					ok: false,
					error,
				});
				continue;
			}
			const body = await res
				.json()
				.catch(() => ({}));
			const messageId =
				body?.messages?.[0]?.id;
			if (messageId) messageIds.push(messageId);
			recipientResults.push({
				to,
				ok: true,
				messageId,
			});
		}

		if (messageIds.length === 0) {
			return {
				ok: false,
				error:
					failures.join(" | ") ||
					"No WhatsApp messages were sent",
				recipientResults,
			};
		}
		return {
			ok: failures.length === 0,
			messageId: messageIds[0],
			messageIds,
			recipientResults,
			error:
				failures.length > 0
					? failures.join(" | ")
					: undefined,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: "Unknown WhatsApp error";
		return {
			ok: false,
			error: errorMessage,
			recipientResults: recipients.map((to) => ({
				to,
				ok: false,
				error: errorMessage,
			})),
		};
	}
}
