import { Schema } from 'mongoose';
import { getModel, type YMD } from './_shared';

export type DailyStockCountStatus = 'DRAFT' | 'COMPLETED';

export interface DailyStockCountItem {
  productId: string;
  countedUnits: number;
  note?: string;
}

export interface DailyStockCountDoc {
  date: YMD;
  sessionId: string;
  status: DailyStockCountStatus;
  items: DailyStockCountItem[];
  countedByUserId: string;
  countedAt: Date;
  finalizedByUserId?: string;
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailyStockCountItemSchema = new Schema<DailyStockCountItem>(
  {
    productId: { type: String, required: true },
    countedUnits: { type: Number, required: true, min: 0 },
    note: { type: String },
  },
  { _id: false },
);

const DailyStockCountSchema = new Schema<DailyStockCountDoc>(
  {
    date: { type: String, required: true },
    sessionId: { type: String, required: true },
    status: { type: String, required: true, default: 'DRAFT' },
    items: { type: [DailyStockCountItemSchema], default: [] },
    countedByUserId: { type: String, required: true },
    countedAt: { type: Date, required: true },
    finalizedByUserId: { type: String },
    finalizedAt: { type: Date },
  },
  { timestamps: true },
);

DailyStockCountSchema.index({ date: 1, sessionId: 1 }, { unique: true });
DailyStockCountSchema.index({ date: 1, status: 1 });

export const DailyStockCount = getModel<DailyStockCountDoc>(
  'DailyStockCount',
  DailyStockCountSchema,
);
