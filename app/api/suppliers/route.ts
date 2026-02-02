export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { supplierCreateSchema } from '@/lib/schemas';
import { Supplier } from '@/models/Supplier';

export async function GET() {
  const a = await requireOrgAuth().catch(() => null);
  if (!a?.orgId) return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });

  await connectDB();
  const docs = await Supplier.find({ orgId: a.orgId }).sort({ name: 1 }).lean();
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
    const input = await parseJson(req, supplierCreateSchema);
    const created = await Supplier.create({ orgId: a.orgId, ...input });
    return ok(created.toObject(), { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    if (msg.includes('E11000')) return fail('Supplier already exists', { status: 409, code: 'DUPLICATE' });
    return fail('Failed to create supplier', { status: 500, code: 'SERVER_ERROR' });
  }
}
