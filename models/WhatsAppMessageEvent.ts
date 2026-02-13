import { Schema } from "mongoose";
import { getModel } from "./_shared";

export interface WhatsAppMessageEventDoc {
	messageId: string;
	status: string;
	recipientId?: string;
	conversationId?: string;
	pricingCategory?: string;
	errorMessage?: string;
	errorCode?: number;
	raw: Record<string, unknown>;
	dedupeKey: string;
	createdAt: Date;
	updatedAt: Date;
}

const WhatsAppMessageEventSchema =
	new Schema<WhatsAppMessageEventDoc>(
		{
			messageId: {
				type: String,
				required: true,
				index: true,
			},
			status: { type: String, required: true },
			recipientId: { type: String },
			conversationId: { type: String },
			pricingCategory: { type: String },
			errorMessage: { type: String },
			errorCode: { type: Number },
			raw: { type: Object, required: true },
			dedupeKey: {
				type: String,
				required: true,
				unique: true,
			},
		},
		{ timestamps: true },
	);

WhatsAppMessageEventSchema.index({
	createdAt: -1,
});

export const WhatsAppMessageEvent = getModel<WhatsAppMessageEventDoc>(
	"WhatsAppMessageEvent",
	WhatsAppMessageEventSchema,
);

