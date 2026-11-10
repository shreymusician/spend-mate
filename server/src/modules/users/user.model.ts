import { Schema, model, type InferSchemaType } from 'mongoose';

export const GENDERS = ['male', 'female'] as const;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // 10-digit Indian mobile number, digits only. This is the login id.
    mobile: { type: String, required: true, unique: true, match: /^[6-9]\d{9}$/ },
    gender: { type: String, enum: GENDERS, required: true },
    // bcrypt of HMAC(pepper, mobile + pin). Never the pin itself.
    pinHash: { type: String, required: true, select: false },
    failedPinAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
    avatarUrl: { type: String },
    dob: { type: Date, required: true },
    prefs: {
      theme: { type: String, enum: ['dark', 'light', 'system'], default: 'light' },
      tone: { type: String, enum: ['playful', 'neutral'], default: 'neutral' },
      pushEnabled: { type: Boolean, default: false },
      // Whether new entries are shown to linked parents by default. Chosen in the Family tab.
      shareNewEntries: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: import('mongoose').Types.ObjectId };
export const User = model('User', userSchema);

export const publicUser = (u: UserDoc) => ({
  id: String(u._id),
  name: u.name,
  mobile: u.mobile,
  gender: u.gender,
  avatarUrl: u.avatarUrl ?? null,
  prefs: u.prefs,
  isMinor: ageInYears(u.dob) < 18,
});

export function ageInYears(dob: Date, now = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}
