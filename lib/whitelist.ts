export function normalizeEmail(
	email: string | null | undefined,
) {
	return (email ?? "").trim().toLowerCase();
}

function splitEnvList(value: string) {
	return value
		.split(",")
		.map((item) => normalizeEmail(item))
		.filter(Boolean);
}

export function getAllowedEmails() {
	const raw =
		process.env.ALLOWED_USER_EMAILS ??
		process.env.WHITELISTED_EMAILS ??
		"";

	return splitEnvList(raw);
}

export function isEmailWhitelisted(
	email: string | null | undefined,
) {
	const allowList = getAllowedEmails();
	if (allowList.length === 0) return true;

	const normalized = normalizeEmail(email);
	if (!normalized) return false;

	return allowList.includes(normalized);
}
