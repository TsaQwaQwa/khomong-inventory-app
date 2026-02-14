import { Schema } from 'mongoose';
import { getModel } from './_shared';

export type TabTxnType = 'CHARGE' | 'PAYMENT' | 'ADJUSTMENT';
export type PaymentMethod = 'CASH' | 'CARD' | 'EFT';

export interface TabTxnItem {
  productId: string;
  units: number;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents?: number;
  lineTotalCents: number;
}

export interface TabTransactionDoc {
  customerId: string;
  businessDayId: string;
  type: TabTxnType;
  subtotalCents?: number;
  discountCents?: number;
  amountCents: number;

  paymentMethod?: PaymentMethod;
  reference?: string;

  items?: TabTxnItem[];
  note?: string;
  attachmentId?: string;
  reversalOfId?: string;
  reversalReason?: string;

  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const TabTransactionSchema = new Schema<TabTransactionDoc>(
  {
    customerId: { type: String, required: true },
    businessDayId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    subtotalCents: { type: Number },
    discountCents: { type: Number },
    amountCents: { type: Number, required: true },

    paymentMethod: { type: String },
    reference: { type: String },

    items: [
      {
        productId: { type: String, required: true },
        units: { type: Number, required: true },
        unitPriceCents: { type: Number, required: true },
        subtotalCents: { type: Number, required: true },
        discountCents: { type: Number },
        lineTotalCents: { type: Number, required: true },
      },
    ],
    note: { type: String },
    attachmentId: { type: String },
    reversalOfId: { type: String },
    reversalReason: { type: String },

    createdByUserId: { type: String, required: true },
  },
  { timestamps: true }
);

TabTransactionSchema.index({ customerId: 1, createdAt: -1 });
TabTransactionSchema.index({
	customerId: 1,
	type: 1,
	createdAt: -1,
});
TabTransactionSchema.index({
	businessDayId: 1,
	type: 1,
	createdAt: -1,
});
TabTransactionSchema.index(
	{ reversalOfId: 1 },
	{ sparse: true },
);
TabTransactionSchema.index(
	{ reference: 1 },
	{ sparse: true },
);

export const TabTransaction = getModel<TabTransactionDoc>('TabTransaction', TabTransactionSchema);
