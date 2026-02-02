export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { stockCountSchema } from '@/lib/schemas';
import { getOrCreateDay } from '@/lib/businessDay';
import { StockCount } from '@/models/StockCount';

export async function POST(req: Request) {
  let a;
  try {
    a = await requireOrgAuth();
  } catch {
    return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
  }

  await connectDB();
  try {
    const input = await parseJson(req, stockCountSchema);
    const day = await getOrCreateDay(a.orgId!, input.date, a.userId!);

    if (day.status === 'LOCKED') return fail('Day is locked', { status: 403, code: 'LOCKED' });

    const upserted = await StockCount.findOneAndUpdate(
      { orgId: a.orgId, businessDayId: String(day._id), type: input.type },
      { $set: { counts: input.counts, createdByUserId: a.userId } },
      { upsert: true, new: true }
    ).lean();

    return ok(upserted);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    return fail('Failed to save stock count', { status: 500, code: 'SERVER_ERROR' });
  }
}
