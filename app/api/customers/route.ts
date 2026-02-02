export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { customerCreateSchema } from '@/lib/schemas';
import { Customer } from '@/models/Customer';
import { TabAccount } from '@/models/TabAccount';

export async function GET() {
  const a = await requireOrgAuth().catch(() => null);
  if (!a?.orgId) return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });

  await connectDB();
  const docs = await Customer.find({ orgId: a.orgId, isActive: true }).sort({ name: 1 }).lean();
  return ok(docs);
}

export async function POST(req: Request) {
  let a;
  try {
    a = await requireOrgAuth();
  } catch {
    return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
  }

  await connectDB();
  try {
    const input = await parseJson(req, customerCreateSchema);

    const customer = await Customer.create({
      orgId: a.orgId,
      name: input.name,
      phone: input.phone,
      note: input.note,
      isActive: true,
    });

    await TabAccount.create({
      orgId: a.orgId,
      customerId: String(customer._id),
      creditLimitCents: input.creditLimitCents,
      status: 'ACTIVE',
      dueDays: input.dueDays,
    });

    return ok(customer.toObject(), { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    if (msg.includes('E11000')) return fail('Customer already exists (phone)', { status: 409, code: 'DUPLICATE' });
    return fail('Failed to create customer', { status: 500, code: 'SERVER_ERROR' });
  }
}
