import { Schema, model, Types } from 'mongoose';

const relationshipSchema = new Schema(
  {
    // Despite the names, these mean: `parent` = the person who can VIEW, `child` = the person whose shared entries are
    // viewed. (Kept as they are so existing data needs no migration.) A mutual link between peers is two documents.
    parent: { type: Types.ObjectId, ref: 'User', required: true },
    child: { type: Types.ObjectId, ref: 'User', required: true },
    // What the viewer is to the owner (parent, grandparent, uncle_aunt, sibling, spouse, cousin, other). Older documents have none and mean 'parent'.
    rel: { type: String, enum: ['parent', 'grandparent', 'uncle_aunt', 'sibling', 'spouse', 'cousin', 'other'], default: 'parent' },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    // The owner can switch a person's view off and on again without ending the connection. While paused the viewer sees nothing.
    paused: { type: Boolean, default: false },
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
    // Only on old invitations. New ones carry no role: the person who enters the code says how they are related.
    inviterRole: { type: String, enum: ['parent', 'child'] },
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
