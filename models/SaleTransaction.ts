import { Schema } from "mongoose";
import { getModel } from "./_shared";

export type PaymentMethod = "CASH" | "CARD" | "EFT";

export interface SaleTxnItem {
	productId: string;
	units: number;
	unitPriceCents: number;
	lineTotalCents: number;
}

export interface SaleTransactionDoc {
	businessDayId: string;
	paymentMethod: PaymentMethod;
	amountCents: number;
	items: SaleTxnItem[];
	note?: string;
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
				index: true,
			},
			paymentMethod: {
				type: String,
				required: true,
			},
			amountCents: {
				type: Number,
				required: true,
			},
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
					lineTotalCents: {
						type: Number,
						required: true,
					},
				},
			],
			note: { type: String },
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

export const SaleTransaction =
	getModel<SaleTransactionDoc>(
		"SaleTransaction",
		SaleTransactionSchema,
	);
