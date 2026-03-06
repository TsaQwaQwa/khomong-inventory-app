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
    phone: {
      type: String,
      set: (value: unknown) => {
        if (typeof value !== "string") return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      },
    },
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

CustomerSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $type: "string", $ne: "" },
    },
  },
);
CustomerSchema.index({ name: 1 });

export const Customer = getModel<CustomerDoc>('Customer', CustomerSchema);
