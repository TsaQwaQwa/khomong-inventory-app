import { Schema } from "mongoose";
import { getModel, type YMD } from "./_shared";

export type StockCountStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED";
export type StockCountSource = "MANUAL" | "IMPORT" | "SCAN_ASSISTED";

export interface StockCountDoc {
	date: YMD;
	productId: string;
	countedUnits: number;
	countedByUserId: string;
	countedAt: Date;
	note?: string;
	sessionId?: string;
	status: StockCountStatus;
	finalizedByUserId?: string;
	finalizedAt?: Date;
	source: StockCountSource;
	createdAt: Date;
	updatedAt: Date;
}

const StockCountSchema = new Schema<StockCountDoc>(
	{
		date: { type: String, required: true, index: true },
		productId: { type: String, required: true, index: true },
		countedUnits: { type: Number, required: true, min: 0 },
		countedByUserId: { type: String, required: true },
		countedAt: { type: Date, required: true },
		note: { type: String },
		sessionId: { type: String, index: true },
		status: {
			type: String,
			required: true,
			default: "IN_PROGRESS",
		},
		finalizedByUserId: { type: String },
		finalizedAt: { type: Date },
		source: { type: String, required: true, default: "MANUAL" },
	},
	{ timestamps: true },
);

// One morning count row per product per business date.
// Saving again updates the same row, which makes draft/resume simple.
StockCountSchema.index({ date: 1, productId: 1 }, { unique: true });
StockCountSchema.index({ date: 1, sessionId: 1 });
StockCountSchema.index({ status: 1, date: 1 });

export const StockCount = getModel<StockCountDoc>(
	"StockCount",
	StockCountSchema,
);
