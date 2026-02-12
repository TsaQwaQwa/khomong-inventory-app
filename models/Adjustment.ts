import { Schema } from "mongoose";
import { getModel } from "./_shared";

export type AdjustmentReason =
	| "SPILLAGE"
	| "BREAKAGE"
	| "FREEBIES"
	| "THEFT_SUSPECTED"
	| "COUNT_CORRECTION";

export interface AdjustmentItem {
	productId: string;
	unitsDelta: number; // negative for loss, positive for correction
	reason: AdjustmentReason;
	note?: string;
	attachmentId?: string;
}

export interface AdjustmentDoc {
	businessDayId: string;
	items: AdjustmentItem[];
	createdByUserId: string;
	createdAt: Date;
	updatedAt: Date;
}

const AdjustmentSchema =
	new Schema<AdjustmentDoc>(
		{
			businessDayId: {
				type: String,
				required: true,
				index: true,
			},
			items: [
				{
					productId: {
						type: String,
						required: true,
					},
					unitsDelta: {
						type: Number,
						required: true,
					},
					reason: {
						type: String,
						required: true,
					},
					note: { type: String },
					attachmentId: { type: String },
				},
			],
			createdByUserId: {
				type: String,
				required: true,
			},
		},
		{ timestamps: true },
	);

export const Adjustment = getModel<AdjustmentDoc>(
	"Adjustment",
	AdjustmentSchema,
);
