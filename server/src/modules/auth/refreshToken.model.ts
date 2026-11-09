import { Schema, model, Types } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    userAgent: { type: String, maxlength: 300 },
    // "Remember me": a remembered device keeps the person signed in for weeks; otherwise only until the browser closes.
    remember: { type: Boolean, default: true },
    deviceLabel: { type: String, maxlength: 60 },
  },
  { timestamps: true },
);
// Mongo removes expired tokens automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model('RefreshToken', refreshTokenSchema);
