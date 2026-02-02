export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { parseJson } from '@/lib/validate';
import { productCreateSchema } from '@/lib/schemas';
import { Product } from '@/models/Product';

export async function GET() {
  const a = await requireOrgAuth().catch(() => null);
  if (!a?.orgId) return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });

  await connectDB();
  const products = await Product.find({ orgId: a.orgId, isActive: true }).sort({ name: 1 }).lean();
  return ok(products);
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
    const input = await parseJson(req, productCreateSchema);
    const created = await Product.create({ orgId: a.orgId, ...input });
    return ok(created.toObject(), { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.startsWith('VALIDATION_ERROR:')) return fail(msg.replace('VALIDATION_ERROR:', ''), { status: 400, code: 'VALIDATION_ERROR' });
    if (msg.includes('E11000')) return fail('Product already exists', { status: 409, code: 'DUPLICATE' });
    return fail('Failed to create product', { status: 500, code: 'SERVER_ERROR' });
  }
}
