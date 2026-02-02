export const runtime = 'nodejs';

import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { businessDaySchema } from '@/lib/schemas';
import { getOrCreateDay } from '@/lib/businessDay';

export async function POST(req: Request) {
  let a;
  try {
    a = await requireOrgAuth();
  } catch {
    return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
  }

  try {
    const input = await parseJson(req, businessDaySchema);
    const day = await getOrCreateDay(a.orgId!, input.date, a.userId!);
    return ok(day);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    return fail('Failed to open day', { status: 500, code: 'SERVER_ERROR' });
  }
}
