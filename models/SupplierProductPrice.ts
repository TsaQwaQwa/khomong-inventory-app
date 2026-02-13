import { Schema } from "mongoose";
import { getModel, type YMD } from "./_shared";

export interface SupplierProductPriceDoc {
	supplierId: string;
	productId: string;
	unitCostCents: number;
	effectiveFrom: YMD;
	effectiveTo?: YMD;
	moqUnits?: number;
	leadTimeDays?: number;
	note?: string;
	changedByUserId: string;
	createdAt: Date;
}

const SupplierProductPriceSchema =
	new Schema<SupplierProductPriceDoc>(
		{
			supplierId: {
				type: String,
				required: true,
				index: true,
			},
			productId: {
				type: String,
				required: true,
				index: true,
			},
			unitCostCents: { type: Number, required: true },
			effectiveFrom: {
				type: String,
				required: true,
				index: true,
			},
			effectiveTo: { type: String },
			moqUnits: { type: Number },
			leadTimeDays: { type: Number },
			note: { type: String },
			changedByUserId: {
				type: String,
				required: true,
			},
		},
		{
			timestamps: {
				createdAt: true,
				updatedAt: false,
			},
		},
	);

SupplierProductPriceSchema.index({
	supplierId: 1,
	productId: 1,
	effectiveFrom: -1,
});

export const SupplierProductPrice =
	getModel<SupplierProductPriceDoc>(
		"SupplierProductPrice",
		SupplierProductPriceSchema,
	);
