import { Schema } from 'mongoose';
import { getModel } from './_shared';

export interface SupplierDoc {
  orgId: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<SupplierDoc>(
  {
    orgId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

SupplierSchema.index({ orgId: 1, name: 1 }, { unique: true });

export const Supplier = getModel<SupplierDoc>('Supplier', SupplierSchema);
