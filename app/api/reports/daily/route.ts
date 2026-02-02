export const runtime = 'nodejs';

import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { todayYMD } from '@/lib/dates';
import { computeDailySummary } from '@/lib/reporting';

export async function GET(req: Request) {
  let a;
  try {
    a = await requireOrgAuth();
  } catch {
    return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? todayYMD();

  try {
    const summary = await computeDailySummary(a.orgId!, date, a.userId!);
    return ok(summary);
  } catch (e: any) {
    return fail('Failed to compute daily summary', { status: 500, code: 'SERVER_ERROR' });
  }
}
