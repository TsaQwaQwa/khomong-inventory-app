import { Schema } from "mongoose";
import { getModel } from "./_shared";

export type AlertType =
	| "OUT_OF_STOCK"
	| "LOW_STOCK"
	| "DAILY_PURCHASE_PLAN";
export type AlertPriority =
	| "HIGH"
	| "MEDIUM"
	| "LOW";
export type AlertStatus = "UNREAD" | "READ";

export interface AlertDoc {
	scopeId: string;
	date: string;
	type: AlertType;
	priority: AlertPriority;
	title: string;
	detail: string;
	dedupeKey: string;
	status: AlertStatus;
	whatsappMessageId?: string;
	whatsappMessageIds?: string[];
	whatsappSendLockedAt?: Date;
	whatsappRecipients?: {
		to: string;
		sendStatus: "SENT" | "FAILED";
		sendError?: string;
		messageId?: string;
		deliveryStatus?: string;
		deliveryError?: string;
		lastStatusAt?: Date;
	}[];
	whatsappDeliveryStatus?: string;
	whatsappStatusAt?: Date;
	whatsappSentAt?: Date;
	whatsappError?: string;
	createdAt: Date;
	updatedAt: Date;
}

const AlertSchema = new Schema<AlertDoc>(
	{
		scopeId: {
			type: String,
			required: true,
			index: true,
		},
		date: { type: String, required: true },
		type: { type: String, required: true },
		priority: { type: String, required: true },
		title: { type: String, required: true },
		detail: { type: String, required: true },
		dedupeKey: {
			type: String,
			required: true,
			unique: true,
		},
		status: {
			type: String,
			required: true,
			default: "UNREAD",
		},
		whatsappMessageId: { type: String },
		whatsappMessageIds: [{ type: String }],
		whatsappSendLockedAt: { type: Date },
		whatsappRecipients: [
			{
				to: { type: String, required: true },
				sendStatus: {
					type: String,
					required: true,
				},
				sendError: { type: String },
				messageId: { type: String },
				deliveryStatus: { type: String },
				deliveryError: { type: String },
				lastStatusAt: { type: Date },
			},
		],
		whatsappDeliveryStatus: { type: String },
		whatsappStatusAt: { type: Date },
		whatsappSentAt: { type: Date },
		whatsappError: { type: String },
	},
	{ timestamps: true },
);

AlertSchema.index({
	scopeId: 1,
	status: 1,
	createdAt: -1,
});

export const Alert = getModel<AlertDoc>(
	"Alert",
	AlertSchema,
);
