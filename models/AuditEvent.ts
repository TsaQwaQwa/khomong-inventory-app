import { Schema } from 'mongoose';
import { getModel } from './_shared';

export interface AuditEventDoc {
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: Date;
}

const AuditEventSchema = new Schema<AuditEventDoc>(
  {
    actorUserId: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditEventSchema.index({  createdAt: -1 });

export const AuditEvent = getModel<AuditEventDoc>('AuditEvent', AuditEventSchema);
