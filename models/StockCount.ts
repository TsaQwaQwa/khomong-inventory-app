import { Schema } from 'mongoose';
import { getModel } from './_shared';

export type StockCountType = 'OPEN' | 'CLOSE';

export interface StockCountLine {
  productId: string;
  units: number;
}

export interface StockCountDoc {
  orgId: string;
  businessDayId: string;
  type: StockCountType;
  counts: StockCountLine[];
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockCountSchema = new Schema<StockCountDoc>(
  {
    orgId: { type: String, required: true, index: true },
    businessDayId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    counts: [
      {
        productId: { type: String, required: true },
        units: { type: Number, required: true },
      },
    ],
    createdByUserId: { type: String, required: true },
  },
  { timestamps: true }
);

StockCountSchema.index({ orgId: 1, businessDayId: 1, type: 1 }, { unique: true });

export const StockCount = getModel<StockCountDoc>('StockCount', StockCountSchema);
