import { Schema } from 'mongoose';
import { getModel } from './_shared';

export interface CustomerDoc {
  name: string;
  phone: string;
  note?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<CustomerDoc>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    note: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ phone: 1 }, { unique: true });

export const Customer = getModel<CustomerDoc>('Customer', CustomerSchema);
