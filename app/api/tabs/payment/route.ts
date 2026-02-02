export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { tabPaymentSchema } from '@/lib/schemas';
import { getOrCreateDay } from '@/lib/businessDay';
import { TabTransaction } from '@/models/TabTransaction';
import { todayYMD } from '@/lib/dates';

export async function POST(req: Request) {
  let a;
  try {
    a = await requireOrgAuth();
  } catch {
    return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
  }

  await connectDB();
  try {
    const input = await parseJson(req, tabPaymentSchema);
    const date = input.date ?? todayYMD();
    const day = await getOrCreateDay(a.orgId!, date, a.userId!);
    if (day.status === 'LOCKED') return fail('Day is locked', { status: 403, code: 'LOCKED' });

    const created = await TabTransaction.create({
      orgId: a.orgId,
      customerId: input.customerId,
      businessDayId: String(day._id),
      type: 'PAYMENT',
      amountCents: input.amountCents,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
      note: input.note,
      createdByUserId: a.userId!,
    });

    return ok(created.toObject(), { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    return fail('Failed to create tab payment', { status: 500, code: 'SERVER_ERROR' });
  }
}
