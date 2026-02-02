import { Schema } from 'mongoose';
import { getModel, type YMD } from './_shared';

export interface PurchaseItem {
  productId: string;
  cases: number;
  singles: number;
  units: number;
  unitCostCents?: number;
}

export interface PurchaseDoc {
  orgId: string;
  supplierId?: string;
  invoiceNo?: string;
  purchaseDate: YMD;
  items: PurchaseItem[];
  attachmentIds: string[];
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseSchema = new Schema<PurchaseDoc>(
  {
    orgId: { type: String, required: true, index: true },
    supplierId: { type: String },
    invoiceNo: { type: String },
    purchaseDate: { type: String, required: true, index: true },
    items: [
      {
        productId: { type: String, required: true },
        cases: { type: Number, required: true, default: 0 },
        singles: { type: Number, required: true, default: 0 },
        units: { type: Number, required: true },
        unitCostCents: { type: Number },
      },
    ],
    attachmentIds: [{ type: String }],
    createdByUserId: { type: String, required: true },
  },
  { timestamps: true }
);

PurchaseSchema.index({ orgId: 1, purchaseDate: 1 });

export const Purchase = getModel<PurchaseDoc>('Purchase', PurchaseSchema);
