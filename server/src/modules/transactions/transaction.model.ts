import { Schema, model, Types, type InferSchemaType } from 'mongoose';

export const PAYMENT_METHODS = ['upi', 'cash', 'card', 'netbanking', 'wallet', 'other'] as const;
export const INCOME_SOURCES = ['pocket_money', 'parents', 'salary', 'scholarship', 'freelance', 'refund', 'other'] as const;

const transactionSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amountPaise: {
      type: Number,
      required: true,
      validate: { validator: (n: number) => Number.isSafeInteger(n) && n > 0, message: 'amountPaise must be a positive integer' },
    },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    category: { type: String, default: 'other' }, // expense: default slug or custom id
    source: { type: String, enum: INCOME_SOURCES }, // income only
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'upi' },
    merchant: { type: String, trim: true, maxlength: 60 },
    tags: { type: [String], default: [] },
    occurredAt: { type: Date, required: true },
    // `shared` lets a linked parent see it (Phase 3). Private by default.
    visibility: { type: String, enum: ['private', 'shared'], default: 'private' },
    // Client-generated id so retried/double-tapped submissions don't create duplicates.
    clientId: { type: String, maxlength: 64 },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);
transactionSchema.index({ user: 1, deletedAt: 1, occurredAt: -1 });
transactionSchema.index({ user: 1, category: 1, occurredAt: -1 });
transactionSchema.index({ user: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

export type TransactionDoc = InferSchemaType<typeof transactionSchema> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export const Transaction = model('Transaction', transactionSchema);

export const publicTransaction = (t: TransactionDoc) => ({
  id: String(t._id),
  type: t.type,
  amountPaise: t.amountPaise,
  title: t.title,
  reason: t.reason ?? '',
  category: t.category,
  source: t.source ?? null,
  paymentMethod: t.paymentMethod,
  merchant: t.merchant ?? null,
  tags: t.tags,
  occurredAt: t.occurredAt,
  visibility: t.visibility,
  createdAt: t.createdAt,
});
