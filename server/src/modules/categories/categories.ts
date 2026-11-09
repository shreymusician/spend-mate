import { Schema, model, Types } from 'mongoose';
import { badRequest, notFound } from '../../utils/errors.js';

/** Built-in categories. Transactions reference these by slug, custom ones by ObjectId string. */
export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food', icon: 'utensils', color: '#f2b84b' },
  { id: 'transport', name: 'Transport', icon: 'bus', color: '#5aa9ff' },
  { id: 'education', name: 'Education', icon: 'graduation-cap', color: '#a78bfa' },
  { id: 'shopping', name: 'Shopping', icon: 'shopping-bag', color: '#f472b6' },
  { id: 'entertainment', name: 'Entertainment', icon: 'clapperboard', color: '#fb7185' },
  { id: 'healthcare', name: 'Healthcare', icon: 'heart-pulse', color: '#34d399' },
  { id: 'travel', name: 'Travel', icon: 'plane', color: '#22d3ee' },
  { id: 'accommodation', name: 'Accommodation', icon: 'bed', color: '#fb923c' },
  { id: 'electronics', name: 'Electronics', icon: 'smartphone', color: '#94a3b8' },
  { id: 'personal', name: 'Personal', icon: 'user', color: '#c4b5fd' },
  { id: 'other', name: 'Other', icon: 'circle-ellipsis', color: '#9ca3af' },
] as const;

const DEFAULT_IDS = new Set<string>(DEFAULT_CATEGORIES.map((c) => c.id));

const categorySchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    icon: { type: String, default: 'tag', maxlength: 30 },
    color: { type: String, default: '#9ca3af', match: /^#[0-9a-fA-F]{6}$/ },
  },
  { timestamps: true },
);
categorySchema.index({ user: 1, name: 1 }, { unique: true });
export const Category = model('Category', categorySchema);

const shape = (c: { _id: unknown; name: string; icon: string; color: string }) => ({
  id: String(c._id), name: c.name, icon: c.icon, color: c.color, custom: true,
});

export async function listCategories(userId: string) {
  const custom = await Category.find({ user: userId }).sort({ name: 1 });
  return [...DEFAULT_CATEGORIES.map((c) => ({ ...c, custom: false })), ...custom.map(shape)];
}

export async function createCategory(userId: string, input: { name: string; icon?: string; color?: string }) {
  if (DEFAULT_CATEGORIES.some((c) => c.name.toLowerCase() === input.name.toLowerCase())) {
    throw badRequest('That category already exists');
  }
  return shape(await Category.create({ user: userId, ...input }));
}

/** Throws unless `id` is a built-in slug or a custom category owned by the user. */
export async function assertCategory(userId: string, id: string) {
  if (DEFAULT_IDS.has(id)) return;
  if (!Types.ObjectId.isValid(id) || !(await Category.exists({ _id: id, user: userId }))) {
    throw badRequest('Unknown category');
  }
}

export async function deleteCategory(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound();
  const res = await Category.deleteOne({ _id: id, user: userId });
  if (!res.deletedCount) throw notFound('Category not found');
  // Dynamic import avoids a circular dependency with the transactions model.
  const { Transaction } = await import('../transactions/transaction.model.js');
  await Transaction.updateMany({ user: userId, category: id }, { category: 'other' });
}
