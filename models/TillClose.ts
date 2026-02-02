import { Schema } from 'mongoose';
import { getModel } from './_shared';

export interface CashExpense {
  amountCents: number;
  reason: string;
  attachmentId?: string;
}

export interface Deposit {
  amountCents: number;
  reference?: string;
  attachmentId?: string;
}

export interface TillCloseDoc {
  orgId: string;
  businessDayId: string;

  cashSalesCents: number;
  cardSalesCents: number;
  eftSalesCents: number;

  cashExpenses: CashExpense[];
  deposits: Deposit[];

  cashCountedCents: number;

  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const TillCloseSchema = new Schema<TillCloseDoc>(
  {
    orgId: { type: String, required: true, index: true },
    businessDayId: { type: String, required: true, index: true },

    cashSalesCents: { type: Number, required: true, default: 0 },
    cardSalesCents: { type: Number, required: true, default: 0 },
    eftSalesCents: { type: Number, required: true, default: 0 },

    cashExpenses: [
      {
        amountCents: { type: Number, required: true },
        reason: { type: String, required: true },
        attachmentId: { type: String },
      },
    ],
    deposits: [
      {
        amountCents: { type: Number, required: true },
        reference: { type: String },
        attachmentId: { type: String },
      },
    ],

    cashCountedCents: { type: Number, required: true, default: 0 },

    createdByUserId: { type: String, required: true },
  },
  { timestamps: true }
);

TillCloseSchema.index({ orgId: 1, businessDayId: 1 }, { unique: true });

export const TillClose = getModel<TillCloseDoc>('TillClose', TillCloseSchema);
