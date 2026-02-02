import { Schema } from 'mongoose';
import { getModel } from './_shared';

export type TabStatus = 'ACTIVE' | 'BLOCKED';

export interface TabAccountDoc {
  orgId: string;
  customerId: string;
  creditLimitCents: number;
  status: TabStatus;
  dueDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TabAccountSchema = new Schema<TabAccountDoc>(
  {
    orgId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    creditLimitCents: { type: Number, required: true, default: 0 },
    status: { type: String, required: true, default: 'ACTIVE' },
    dueDays: { type: Number },
  },
  { timestamps: true }
);

TabAccountSchema.index({ orgId: 1, customerId: 1 }, { unique: true });

export const TabAccount = getModel<TabAccountDoc>('TabAccount', TabAccountSchema);
