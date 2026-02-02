export const runtime = 'nodejs';

import { connectDB } from '@/lib/db';
import { requireOrgAuth, isOrgAdmin } from '@/lib/authz';
import { ok, fail } from '@/lib/http';
import { Product } from '@/models/Product';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireOrgAuth().catch(() => null);
  if (!a?.orgId) return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });

  const { id } = await ctx.params;

  await connectDB();
  const doc = await Product.findOne({ orgId: a.orgId, _id: id }).lean();
  if (!doc) return fail('Not found', { status: 404, code: 'NOT_FOUND' });
  return ok(doc);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireOrgAuth().catch(() => null);
  if (!a?.orgId) return fail('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });

  const admin = await isOrgAdmin();
  if (!admin) return fail('Admin only', { status: 403, code: 'FORBIDDEN' });

  const { id } = await ctx.params;
  const patch = await req.json().catch(() => null);
  if (!patch) return fail('Invalid JSON', { status: 400, code: 'INVALID_JSON' });

  await connectDB();
  const updated = await Product.findOneAndUpdate({ orgId: a.orgId, _id: id }, { $set: patch }, { new: true }).lean();
  if (!updated) return fail('Not found', { status: 404, code: 'NOT_FOUND' });
  return ok(updated);
}
