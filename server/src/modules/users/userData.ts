import { Types } from 'mongoose';
import { sharingChanged } from '../../realtime/notify.js';
import { istOffsetMs } from '../../utils/dates.js';
import { audit, AuditLog } from '../audit/audit.model.js';
import { Budget } from '../budgets/budgets.js';
import { Category, DEFAULT_CATEGORIES } from '../categories/categories.js';
import { Comment } from '../family/family.models.js';
import { listLinks } from '../family/family.service.js';
import { Transaction } from '../transactions/transaction.model.js';
import { User } from './user.model.js';

const SOURCE_LABEL: Record<string, string> = {
  pocket_money: 'Pocket money', parents: 'From family', salary: 'Salary', scholarship: 'Scholarship',
  freelance: 'Freelance', refund: 'Refund', other: 'Other',
};
const METHOD_LABEL: Record<string, string> = { upi: 'UPI', cash: 'Cash', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', other: 'Other' };

const rupees = (paise: number) => Math.round(paise) / 100;
/** "2026-11-10 14:05" in India time, the way people read it. */
const ist = (d: Date) => new Date(d.getTime() + istOffsetMs).toISOString().slice(0, 16).replace('T', ' ');
export const todayIst = () => new Date(Date.now() + istOffsetMs).toISOString().slice(0, 10);

/**
 * Everything that belongs to one person, ready to download. It holds only their own information: their entries,
 * budgets, categories and settings, who they are connected to (names only), and what family wrote on their entries.
 * It never holds the Secret Pin or anyone else's entries.
 */
export async function exportData(userId: string) {
  const [user, entries, custom, budgets, links] = await Promise.all([
    User.findById(userId),
    Transaction.find({ user: userId, deletedAt: null }).sort({ occurredAt: 1 }),
    Category.find({ user: userId }).sort({ name: 1 }),
    Budget.find({ user: userId }).sort({ month: 1 }),
    listLinks(userId),
  ]);
  if (!user) throw new Error('User not found');

  const nameOf = new Map<string, string>([...DEFAULT_CATEGORIES.map((c) => [c.id, c.name] as [string, string]), ...custom.map((c) => [String(c._id), c.name] as [string, string])]);
  const categoryName = (id: string) => nameOf.get(id) ?? 'Other';

  const comments = await Comment.find({ transaction: { $in: entries.map((e) => e._id) } }).sort({ createdAt: 1 });
  const authors = await User.find({ _id: { $in: comments.map((c) => c.author) } });
  const titleOf = new Map(entries.map((e) => [String(e._id), e.title]));

  return {
    app: 'SpendMate',
    exportedAt: new Date().toISOString(),
    profile: {
      name: user.name,
      mobile: user.mobile,
      gender: user.gender,
      dateOfBirth: user.dob.toISOString().slice(0, 10),
      memberSince: (user as unknown as { createdAt: Date }).createdAt.toISOString(),
      preferences: user.prefs,
    },
    entries: entries.map((e) => ({
      id: String(e._id),
      dateIst: ist(e.occurredAt),
      occurredAt: e.occurredAt.toISOString(),
      type: e.type === 'income' ? 'received' : 'spent',
      title: e.title,
      amountRupees: rupees(e.amountPaise),
      amountPaise: e.amountPaise,
      category: e.type === 'expense' ? categoryName(e.category) : null,
      source: e.type === 'income' ? SOURCE_LABEL[e.source ?? 'other'] ?? 'Other' : null,
      paidBy: METHOD_LABEL[e.paymentMethod] ?? e.paymentMethod,
      shopOrPerson: e.merchant ?? null,
      reason: e.reason ?? '',
      tags: e.tags,
      sharedWithFamily: e.visibility === 'shared',
    })),
    customCategories: custom.map((c) => ({ name: c.name, icon: c.icon, color: c.color })),
    budgets: budgets.map((b) => ({ month: b.month, category: b.category ? categoryName(b.category) : 'Whole month', limitRupees: rupees(b.limitPaise), limitPaise: b.limitPaise })),
    family: {
      canSeeMyEntries: links.sharingWith.map((l) => ({ name: l.user.name, relation: l.relation })),
      iFollow: links.following.map((l) => ({ name: l.user.name, relation: l.relation })),
    },
    commentsFromFamily: comments.map((c) => ({
      from: authors.find((a) => String(a._id) === String(c.author))?.name ?? 'Unknown',
      onEntry: titleOf.get(String(c.transaction)) ?? '',
      comment: c.body,
      at: c.createdAt.toISOString(),
    })),
  };
}

export type ExportData = Awaited<ReturnType<typeof exportData>>;

/**
 * One CSV cell. A cell that starts with = + - or @ would be run as a formula by Excel or Sheets, so it gets a quote
 * in front: a typed-in title like "=HYPERLINK(...)" is then shown as text and never executed.
 */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The entries as a spreadsheet file. Starts with a byte-order mark so Excel reads the ₹ and other letters correctly. */
export function entriesCsv(data: ExportData): string {
  const head = ['Date (IST)', 'Type', 'Title', 'Category or source', 'Amount (₹)', 'Paid by', 'Shop or person', 'Reason', 'Tags', 'Shared with family'];
  const rows = data.entries.map((e) => [
    e.dateIst, e.type === 'received' ? 'Received' : 'Spent', e.title, e.category ?? e.source ?? '', e.amountRupees.toFixed(2),
    e.paidBy, e.shopOrPerson ?? '', e.reason, e.tags.join('; '), e.sharedWithFamily ? 'Yes' : 'No',
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * Permanently deletes a person's money data: entries (including ones they deleted earlier), budgets, custom categories,
 * the comments written on their entries, and the history of changes to them. Their account, photo, settings, Secret Pin
 * and family connections stay. Nothing here can be undone.
 */
export async function clearData(userId: string) {
  const mine = await Transaction.find({ user: userId }).select('_id');
  const ids = mine.map((t) => t._id);
  const [entries, budgets, categories, comments] = await Promise.all([
    Transaction.deleteMany({ user: userId }),
    Budget.deleteMany({ user: userId }),
    Category.deleteMany({ user: userId }),
    Comment.deleteMany({ transaction: { $in: ids } }),
    AuditLog.deleteMany({ actor: userId, entity: { $in: ['transaction', 'sharing'] } }),
  ]).then(([e, b, c, m]) => [e.deletedCount, b.deletedCount, c.deletedCount, m.deletedCount] as const);

  // Only a note that it happened, never what was in it.
  await audit(userId, 'user', new Types.ObjectId(userId), 'update', undefined, { dataCleared: true, entries, budgets, categories });
  sharingChanged(userId); // people who follow this person should see their screen empty too
  return { entries, budgets, categories, comments };
}
