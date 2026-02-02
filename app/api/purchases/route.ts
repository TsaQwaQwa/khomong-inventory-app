export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { purchaseCreateSchema } from '@/lib/schemas';
import { todayYMD } from '@/lib/dates';
import { Purchase } from '@/models/Purchase';

export async function GET(req: Request) {
  const a = await requireOrgAuth().catch(() => null);
  if (!a?.orgId) return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });

  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? todayYMD();

  await connectDB();
  const docs = await Purchase.find({ orgId: a.orgId, purchaseDate: date }).sort({ createdAt: -1 }).lean();
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
    const input = await parseJson(req, purchaseCreateSchema);
    const purchaseDate = input.purchaseDate ?? todayYMD();
    const created = await Purchase.create({
      orgId: a.orgId,
      supplierId: input.supplierId,
      invoiceNo: input.invoiceNo,
      purchaseDate,
      items: input.items,
      attachmentIds: input.attachmentIds ?? [],
      createdByUserId: a.userId!,
    });
    return ok(created.toObject(), { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    return fail('Failed to create purchase', { status: 500, code: 'SERVER_ERROR' });
  }
}
