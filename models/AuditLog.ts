import { Schema } from "mongoose";
import { getModel } from "./_shared";

export interface AuditFieldChange {
	field: string;
	oldValue: unknown;
	newValue: unknown;
}

export interface AuditLogDoc {
	scopeId: string;
	actorUserId?: string;
	action: string;
	entityType: string;
	entityId?: string;
	fieldChanges: AuditFieldChange[];
	oldValues?: Record<string, unknown> | null;
	newValues?: Record<string, unknown> | null;
	meta?: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}

const AuditLogSchema = new Schema<AuditLogDoc>(
	{
		scopeId: {
			type: String,
			required: true,
			index: true,
		},
		actorUserId: { type: String, index: true },
		action: { type: String, required: true },
		entityType: { type: String, required: true },
		entityId: { type: String, index: true },
		fieldChanges: [
			{
				field: { type: String, required: true },
				oldValue: { type: Schema.Types.Mixed },
				newValue: { type: Schema.Types.Mixed },
			},
		],
		oldValues: { type: Schema.Types.Mixed },
		newValues: { type: Schema.Types.Mixed },
		meta: { type: Schema.Types.Mixed },
	},
	{ timestamps: true },
);

AuditLogSchema.index({
	scopeId: 1,
	createdAt: -1,
});

AuditLogSchema.index({
	scopeId: 1,
	entityType: 1,
	entityId: 1,
	createdAt: -1,
});

export const AuditLog = getModel<AuditLogDoc>(
	"AuditLog",
	AuditLogSchema,
);

