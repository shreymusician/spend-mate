import { Schema, model, Types } from 'mongoose';

const auditSchema = new Schema({
  actor: { type: Types.ObjectId, ref: 'User', required: true },
  entity: { type: String, required: true },
  entityId: { type: Types.ObjectId, required: true },
  action: { type: String, enum: ['create', 'update', 'delete'], required: true },
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  at: { type: Date, default: Date.now },
});
auditSchema.index({ entity: 1, entityId: 1, at: -1 });

export const AuditLog = model('AuditLog', auditSchema);

export const audit = (
  actor: string,
  entity: string,
  entityId: Types.ObjectId,
  action: 'create' | 'update' | 'delete',
  before?: unknown,
  after?: unknown,
) => AuditLog.create({ actor, entity, entityId, action, before, after });
