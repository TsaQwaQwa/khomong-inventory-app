import { Schema } from 'mongoose';
import { getModel } from './_shared';

export interface CustomerDoc {
  orgId: string;
  name: string;
  phone: string;
  note?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<CustomerDoc>(
  {
    orgId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    note: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ orgId: 1, phone: 1 }, { unique: true });

export const Customer = getModel<CustomerDoc>('Customer', CustomerSchema);
