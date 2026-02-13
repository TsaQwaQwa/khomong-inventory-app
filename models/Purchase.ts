import { Schema } from 'mongoose';
import { getModel, type YMD } from './_shared';

export interface PurchaseItem {
  productId: string;
  cases: number;
  singles: number;
  units: number;
  unitCostCents?: number;
  discountCents?: number;
  lineTotalCostCents?: number;
}

export interface PurchaseDoc {
  supplierId?: string;
  invoiceNo?: string;
  purchaseDate: YMD;
  items: PurchaseItem[];
  subtotalCents?: number;
  discountCents?: number;
  totalCostCents?: number;
  attachmentIds: string[];
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseSchema = new Schema<PurchaseDoc>(
  {
    supplierId: { type: String },
    invoiceNo: { type: String },
    purchaseDate: { type: String, required: true },
    items: [
      {
        productId: { type: String, required: true },
        cases: { type: Number, required: true, default: 0 },
        singles: { type: Number, required: true, default: 0 },
        units: { type: Number, required: true },
        unitCostCents: { type: Number },
        discountCents: { type: Number },
        lineTotalCostCents: { type: Number },
      },
    ],
    subtotalCents: { type: Number },
    discountCents: { type: Number },
    totalCostCents: { type: Number },
    attachmentIds: [{ type: String }],
    createdByUserId: { type: String, required: true },
  },
  { timestamps: true }
);

PurchaseSchema.index({  purchaseDate: 1 });

export const Purchase = getModel<PurchaseDoc>('Purchase', PurchaseSchema);
