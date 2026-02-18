import { Schema } from "mongoose";
import { getModel } from "./_shared";

export type PaymentMethod = "CASH" | "CARD" | "EFT";

export interface SaleTxnItem {
	productId: string;
	units: number;
	unitPriceCents: number;
	subtotalCents: number;
	discountCents?: number;
	lineTotalCents: number;
}

export interface SaleTransactionDoc {
	businessDayId: string;
	paymentMethod: PaymentMethod;
	subtotalCents?: number;
	discountCents?: number;
	amountCents: number;
	cashReceivedCents?: number;
	changeCents?: number;
	items: SaleTxnItem[];
	note?: string;
	reversalOfId?: string;
	reversalReason?: string;
	createdByUserId: string;
	createdAt: Date;
	updatedAt: Date;
}

const SaleTransactionSchema =
	new Schema<SaleTransactionDoc>(
		{
			businessDayId: {
				type: String,
				required: true,
			},
			paymentMethod: {
				type: String,
				required: true,
			},
			amountCents: {
				type: Number,
				required: true,
			},
			cashReceivedCents: { type: Number },
			changeCents: { type: Number },
			subtotalCents: { type: Number },
			discountCents: { type: Number },
			items: [
				{
					productId: {
						type: String,
						required: true,
					},
					units: {
						type: Number,
						required: true,
					},
					unitPriceCents: {
						type: Number,
						required: true,
					},
					subtotalCents: {
						type: Number,
						required: true,
					},
					discountCents: {
						type: Number,
					},
					lineTotalCents: {
						type: Number,
						required: true,
					},
				},
			],
			note: { type: String },
			reversalOfId: { type: String },
			reversalReason: { type: String },
			createdByUserId: {
				type: String,
				required: true,
			},
		},
		{ timestamps: true },
	);

SaleTransactionSchema.index({
	businessDayId: 1,
	createdAt: -1,
});
SaleTransactionSchema.index(
	{ reversalOfId: 1 },
	{ sparse: true },
);
SaleTransactionSchema.index(
	{ note: 1 },
	{ sparse: true },
);

export const SaleTransaction =
	getModel<SaleTransactionDoc>(
		"SaleTransaction",
		SaleTransactionSchema,
	);
