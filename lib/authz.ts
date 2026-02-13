import {
	auth,
	currentUser,
} from "@clerk/nextjs/server";
import {
	isEmailWhitelisted,
	isAdminEmail,
	normalizeEmail,
} from "@/lib/whitelist";

/**
 * Require a signed-in user and an active org (multi-tenant).
 */
export type AuthWithOrg = Awaited<
	ReturnType<typeof auth>
>;

async function ensureAllowedUser() {
	const email = await getCurrentUserEmail();
	if (!isEmailWhitelisted(email)) {
		throw new Error("FORBIDDEN_USER");
	}
}

export async function getCurrentUserEmail() {
	const user = await currentUser();
	const primaryEmailId =
		user?.primaryEmailAddressId ?? null;
	const primaryEmail = user?.emailAddresses.find(
		(emailAddress) =>
			emailAddress.id === primaryEmailId,
	);

	const fallbackEmail =
		user?.emailAddresses[0]?.emailAddress ?? null;
	const email = normalizeEmail(
		primaryEmail?.emailAddress ?? fallbackEmail,
	);
	return email;
}

export async function isCurrentUserAdminEmail(): Promise<boolean> {
	const email = await getCurrentUserEmail();
	return isAdminEmail(email);
}

export async function requireAdminEmail(): Promise<AuthWithOrg> {
	const a = await requireOrgAuth();
	const isAdmin = await isCurrentUserAdminEmail();
	if (!isAdmin) {
		throw new Error("FORBIDDEN_ADMIN");
	}
	return a;
}

export async function requireOrgAuth(): Promise<AuthWithOrg> {
	const a = await auth();
	if (!a.userId)
		throw new Error("UNAUTHENTICATED");
	await ensureAllowedUser();
	return { ...a };
}

export async function isOrgAdmin(): Promise<boolean> {
	const a = await auth();
	if (!a.userId) return false;
	return a.has?.({ role: "org:admin" }) ?? false;
}
