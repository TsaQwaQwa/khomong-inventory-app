import { Schema } from 'mongoose';
import { getModel } from './_shared';

export type ProductCategory = 'Beer' | 'Cider' | 'SoftDrink' | 'Other';

export interface ProductDoc {
  orgId: string;
  name: string;
  category: ProductCategory;
  barcode?: string;
  packSize: number; // e.g. 24
  reorderLevelUnits: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<ProductDoc>(
  {
    orgId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    barcode: { type: String },
    packSize: { type: Number, required: true, default: 1 },
    reorderLevelUnits: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ orgId: 1, name: 1 }, { unique: true });

export const Product = getModel<ProductDoc>('Product', ProductSchema);
