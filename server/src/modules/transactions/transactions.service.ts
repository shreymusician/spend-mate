import { Types, type QueryFilter } from 'mongoose';
import { badRequest, notFound } from '../../utils/errors.js';
import { audit, AuditLog } from '../audit/audit.model.js';
import { assertCategory } from '../categories/categories.js';
import { transactionChanged } from '../../realtime/notify.js';
import { Transaction, publicTransaction, type TransactionDoc } from './transaction.model.js';
import type { z } from 'zod';
import type { createTransactionSchema, listQuerySchema, updateTransactionSchema } from './transactions.validators.js';

type CreateInput = z.infer<typeof createTransactionSchema>;
type UpdateInput = z.infer<typeof updateTransactionSchema>;
type ListQuery = z.infer<typeof listQuerySchema>;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const snapshot = (t: TransactionDoc) => publicTransaction(t);

export async function createTransaction(userId: string, input: CreateInput) {
  if (input.type === 'expense') await assertCategory(userId, input.category);

  // Double-tap / retry safety: same clientId returns the original row.
  if (input.clientId) {
    const existing = await Transaction.findOne({ user: userId, clientId: input.clientId });
    if (existing) return { transaction: publicTransaction(existing as TransactionDoc), duplicate: true };
  }
  try {
    const doc = (await Transaction.create({ ...input, user: userId })) as unknown as TransactionDoc;
    await audit(userId, 'transaction', doc._id, 'create', undefined, snapshot(doc));
    transactionChanged(userId, { shared: doc.visibility === 'shared', txId: String(doc._id) });
    return { transaction: publicTransaction(doc), duplicate: false };
  } catch (e) {
    // Lost a race against the unique clientId index.
    if ((e as { code?: number }).code === 11000 && input.clientId) {
      const existing = await Transaction.findOne({ user: userId, clientId: input.clientId });
      if (existing) return { transaction: publicTransaction(existing as TransactionDoc), duplicate: true };
    }
    throw e;
  }
}

async function findOwned(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound('Transaction not found');
  // Not found (rather than forbidden) for other people's rows, so ids can't be probed.
  const doc = await Transaction.findOne({ _id: id, user: userId, deletedAt: null });
  if (!doc) throw notFound('Transaction not found');
  return doc as unknown as TransactionDoc & { set: (o: object) => void; save: () => Promise<unknown> };
}

export async function getTransaction(userId: string, id: string) {
  return publicTransaction(await findOwned(userId, id));
}

export async function updateTransaction(userId: string, id: string, patch: UpdateInput) {
  const doc = await findOwned(userId, id);
  if (doc.type === 'income' && patch.category) throw badRequest('Income has a source, not a category');
  if (doc.type === 'expense' && patch.source) throw badRequest('Expenses have a category, not a source');
  if (patch.category) await assertCategory(userId, patch.category);

  const before = snapshot(doc);
  doc.set(patch);
  await doc.save();
  await audit(userId, 'transaction', doc._id, 'update', before, snapshot(doc));
  // A parent must hear about it if the entry was shared before or is shared now (including being hidden again).
  transactionChanged(userId, { shared: before.visibility === 'shared' || doc.visibility === 'shared', txId: String(doc._id) });
  return publicTransaction(doc);
}

export async function deleteTransaction(userId: string, id: string) {
  const doc = await findOwned(userId, id);
  const before = snapshot(doc);
  doc.set({ deletedAt: new Date() });
  await doc.save();
  await audit(userId, 'transaction', doc._id, 'delete', before);
  transactionChanged(userId, { shared: before.visibility === 'shared', txId: String(doc._id) });
}

export async function transactionHistory(userId: string, id: string) {
  // Ownership check covers deleted rows too: history stays viewable by the owner.
  if (!Types.ObjectId.isValid(id) || !(await Transaction.exists({ _id: id, user: userId }))) throw notFound();
  const rows = await AuditLog.find({ entity: 'transaction', entityId: id }).sort({ at: -1 }).limit(50);
  return rows.map((r) => ({ action: r.action, at: r.at, before: r.before ?? null, after: r.after ?? null }));
}

/** `sharedOnly` is for a linked parent: only entries the owner marked as shared. */
export async function listTransactions(userId: string, q: ListQuery, opts: { sharedOnly?: boolean } = {}) {
  const filter: QueryFilter<TransactionDoc> = { user: userId, deletedAt: null };
  if (opts.sharedOnly) filter.visibility = 'shared';
  if (q.type) filter.type = q.type;
  if (q.category) filter.category = q.category;
  if (q.paymentMethod) filter.paymentMethod = q.paymentMethod;
  if (q.from || q.to) filter.occurredAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lt: q.to }) };
  if (q.minPaise !== undefined || q.maxPaise !== undefined) {
    filter.amountPaise = { ...(q.minPaise !== undefined && { $gte: q.minPaise }), ...(q.maxPaise !== undefined && { $lte: q.maxPaise }) };
  }
  const and: QueryFilter<TransactionDoc>[] = [];
  if (q.q) {
    const re = new RegExp(escapeRe(q.q), 'i');
    and.push({ $or: [{ title: re }, { reason: re }, { merchant: re }, { tags: re }] });
  }
  if (q.before) {
    const [iso, cid] = q.before.split('_');
    const at = new Date(iso ?? '');
    if (Number.isNaN(at.getTime()) || !cid || !Types.ObjectId.isValid(cid)) throw badRequest('Bad cursor');
    and.push({ $or: [{ occurredAt: { $lt: at } }, { occurredAt: at, _id: { $lt: new Types.ObjectId(cid) } }] });
  }
  if (and.length) filter.$and = and;

  const rows = (await Transaction.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(q.limit + 1)) as unknown as TransactionDoc[];
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    transactions: page.map(publicTransaction),
    next: rows.length > q.limit && last ? `${last.occurredAt.toISOString()}_${last._id}` : null,
  };
}
