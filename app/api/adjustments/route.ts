export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { adjustmentSchema } from '@/lib/schemas';
import { getOrCreateDay } from '@/lib/businessDay';
import { Adjustment } from '@/models/Adjustment';

export async function POST(req: Request) {
  let a;
  try {
    a = await requireOrgAuth();
  } catch {
    return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
  }

  await connectDB();
  try {
    const input = await parseJson(req, adjustmentSchema);
    const day = await getOrCreateDay(a.orgId!, input.date, a.userId!);
    if (day.status === 'LOCKED') return fail('Day is locked', { status: 403, code: 'LOCKED' });

    const created = await Adjustment.create({
      orgId: a.orgId,
      businessDayId: String(day._id),
      items: input.items,
      createdByUserId: a.userId!,
    });

    return ok(created.toObject(), { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    return fail('Failed to create adjustment', { status: 500, code: 'SERVER_ERROR' });
  }
}
