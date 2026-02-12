import { Schema } from 'mongoose';
import { getModel } from './_shared';

export interface SupplierDoc {
  name: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<SupplierDoc>(
  {
    name: { type: String, required: true },
    phone: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

SupplierSchema.index({ name: 1 }, { unique: true });

export const Supplier = getModel<SupplierDoc>('Supplier', SupplierSchema);
