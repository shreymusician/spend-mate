import { Schema, model, Types } from 'mongoose';

const relationshipSchema = new Schema(
  {
    parent: { type: Types.ObjectId, ref: 'User', required: true },
    child: { type: Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    createdBy: { type: String, enum: ['parent', 'child'], required: true },
    revokedAt: { type: Date },
    revokedBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
relationshipSchema.index({ parent: 1, child: 1 }, { unique: true });
relationshipSchema.index({ child: 1, status: 1 });
export const Relationship = model('Relationship', relationshipSchema);

const invitationSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    inviter: { type: Types.ObjectId, ref: 'User', required: true },
    // Which side the inviter is on: a child inviting a parent, or a parent inviting a child.
    inviterRole: { type: String, enum: ['parent', 'child'], required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    usedBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 86_400 });
export const Invitation = model('Invitation', invitationSchema);

const commentSchema = new Schema(
  {
    transaction: { type: Types.ObjectId, ref: 'Transaction', required: true, index: true },
    author: { type: Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);
export const Comment = model('Comment', commentSchema);
