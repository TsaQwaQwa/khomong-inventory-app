import { Schema } from 'mongoose';
import { getModel, type YMD } from './_shared';

export type BusinessDayStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface BusinessDayDoc {
  orgId: string;
  date: YMD;
  status: BusinessDayStatus;
  openedByUserId: string;
  openedAt: Date;
  closedByUserId?: string;
  closedAt?: Date;
  lockReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessDaySchema = new Schema<BusinessDayDoc>(
  {
    orgId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    status: { type: String, required: true, default: 'OPEN' },
    openedByUserId: { type: String, required: true },
    openedAt: { type: Date, required: true },
    closedByUserId: { type: String },
    closedAt: { type: Date },
    lockReason: { type: String },
  },
  { timestamps: true }
);

BusinessDaySchema.index({ orgId: 1, date: 1 }, { unique: true });

export const BusinessDay = getModel<BusinessDayDoc>('BusinessDay', BusinessDaySchema);
