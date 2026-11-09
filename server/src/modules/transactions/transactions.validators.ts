import { z } from 'zod';
import { INCOME_SOURCES, PAYMENT_METHODS } from './transaction.model.js';

const base = {
  amountPaise: z.number().int('Amount must be in whole paise').positive('Amount must be more than zero').max(100_000_000_00),
  title: z.string().trim().min(1, 'Give it a title').max(80),
  reason: z.string().trim().max(500).default(''),
  paymentMethod: z.enum(PAYMENT_METHODS).default('upi'),
  merchant: z.string().trim().max(60).optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(20)).max(8).default([]),
  occurredAt: z.coerce.date().default(() => new Date()),
  visibility: z.enum(['private', 'shared']).default('private'),
  clientId: z.string().max(64).optional(),
};

export const createTransactionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('expense'), category: z.string().min(1).default('other'), ...base }),
  z.object({ type: z.literal('income'), source: z.enum(INCOME_SOURCES).default('other'), ...base }),
]);

export const updateTransactionSchema = z
  .object({
    amountPaise: base.amountPaise,
    title: base.title,
    reason: z.string().trim().max(500),
    category: z.string().min(1),
    source: z.enum(INCOME_SOURCES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    merchant: z.string().trim().max(60),
    tags: base.tags,
    occurredAt: z.coerce.date(),
    visibility: z.enum(['private', 'shared']),
  })
  .partial()
  .strict();

export const listQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minPaise: z.coerce.number().int().nonnegative().optional(),
  maxPaise: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().optional(), // cursor: "<occurredAtISO>_<id>"
});
