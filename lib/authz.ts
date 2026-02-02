import { auth } from '@clerk/nextjs/server';

/**
 * Require a signed-in user and an active org (multi-tenant).
 */
export async function requireOrgAuth() {
  const a = await auth();
  if (!a.userId) throw new Error('UNAUTHENTICATED');
  if (!a.orgId) throw new Error('NO_ORG');
  return a;
}

export async function isOrgAdmin(): Promise<boolean> {
  const a = await auth();
  if (!a.userId) return false;
  // Clerk auth() returns `has()` which can check roles/permissions.
  return a.has?.({ role: 'org:admin' }) ?? false;
}
