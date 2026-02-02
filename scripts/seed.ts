import 'dotenv/config';
import { connectDB } from '@/lib/db';
import { Product } from '@/models/Product';

async function main() {
  await connectDB();
  const orgId = process.env.SEED_ORG_ID;
  if (!orgId) throw new Error('Set SEED_ORG_ID in env to seed products.');

  const sample = [
    { name: 'Castle Lite 330ml', category: 'Beer', packSize: 24, reorderLevelUnits: 48 },
    { name: 'Black Label 330ml', category: 'Beer', packSize: 24, reorderLevelUnits: 48 },
    { name: 'Savanna Dry 330ml', category: 'Cider', packSize: 24, reorderLevelUnits: 24 },
  ] as const;

  for (const p of sample) {
    await Product.updateOne({ orgId, name: p.name }, { $setOnInsert: { orgId, ...p, isActive: true } }, { upsert: true });
  }

  console.log('Seeded sample products.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
