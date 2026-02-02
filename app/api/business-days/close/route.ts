export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { businessDaySchema } from '@/lib/schemas';
import { todayYMD } from '@/lib/dates';
import { BusinessDay } from '@/models/BusinessDay';

export async function POST(req: Request) {
  let a;
  try {
    a = await requireOrgAuth();
  } catch {
    return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
  }

  await connectDB();
  try {
    const input = await parseJson(req, businessDaySchema);
    const date = input.date ?? todayYMD();

    const day = await BusinessDay.findOne({ orgId: a.orgId, date });
    if (!day) return fail('Business day not found. Call /business-days/open first.', { status: 404, code: 'NOT_FOUND' });

    if (day.status === 'LOCKED') return fail('Day is locked', { status: 403, code: 'LOCKED' });

    day.status = 'CLOSED';
    day.closedByUserId = a.userId!;
    day.closedAt = new Date();
    await day.save();

    return ok(day.toObject());
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    return fail('Failed to close day', { status: 500, code: 'SERVER_ERROR' });
  }
}
