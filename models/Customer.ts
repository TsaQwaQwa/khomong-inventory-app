import { Schema } from 'mongoose';
import { getModel } from './_shared';

export interface CustomerDoc {
  name: string;
  phone?: string;
  note?: string;
  customerMode: "ACCOUNT" | "DEBT_ONLY";
  isTemporaryTab?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<CustomerDoc>(
  {
    name: { type: String, required: true },
    phone: { type: String },
    note: { type: String },
    customerMode: {
      type: String,
      enum: ["ACCOUNT", "DEBT_ONLY"],
      default: "ACCOUNT",
      required: true,
    },
    isTemporaryTab: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ phone: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ name: 1 });

export const Customer = getModel<CustomerDoc>('Customer', CustomerSchema);
