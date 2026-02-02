import { Schema } from 'mongoose';
import { getModel, type YMD } from './_shared';

export interface PriceDoc {
  orgId: string;
  productId: string;
  priceCents: number;
  effectiveFrom: YMD;
  effectiveTo?: YMD;
  changedByUserId: string;
  reason?: string;
  createdAt: Date;
}

const PriceSchema = new Schema<PriceDoc>(
  {
    orgId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    priceCents: { type: Number, required: true },
    effectiveFrom: { type: String, required: true, index: true },
    effectiveTo: { type: String },
    changedByUserId: { type: String, required: true },
    reason: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PriceSchema.index({ orgId: 1, productId: 1, effectiveFrom: 1 });

export const Price = getModel<PriceDoc>('Price', PriceSchema);
