import { Router } from 'express';
import { Schema, model, Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { MONTH_RE, currentMonth } from '../../utils/dates.js';
import { asyncHandler, notFound } from '../../utils/errors.js';
import { assertCategory } from '../categories/categories.js';

const budgetSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true, match: MONTH_RE },
    category: { type: String, default: null }, // null = overall monthly budget
    limitPaise: { type: Number, required: true, validate: Number.isSafeInteger },
  },
  { timestamps: true },
);
budgetSchema.index({ user: 1, month: 1, category: 1 }, { unique: true });
export const Budget = model('Budget', budgetSchema);

const putSchema = z.object({
  month: z.string().regex(MONTH_RE),
  category: z.string().nullable().default(null),
  limitPaise: z.number().int().positive().max(100_000_000_00),
});

export const budgetsRouter = Router();
budgetsRouter.use(requireAuth);

budgetsRouter.get('/', asyncHandler(async (req, res) => {
  const month = z.string().regex(MONTH_RE).default(currentMonth()).parse(req.query.month);
  const rows = await Budget.find({ user: req.userId, month });
  res.json({ budgets: rows.map((b) => ({ id: String(b._id), month: b.month, category: b.category, limitPaise: b.limitPaise })) });
}));

// Upsert: one budget per (month, category).
budgetsRouter.put('/', validateBody(putSchema), asyncHandler(async (req, res) => {
  const { month, category, limitPaise } = req.body as z.infer<typeof putSchema>;
  if (category) await assertCategory(req.userId!, category);
  const b = await Budget.findOneAndUpdate(
    { user: req.userId, month, category },
    { $set: { limitPaise } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  res.json({ budget: { id: String(b._id), month, category, limitPaise } });
}));

budgetsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const r = Types.ObjectId.isValid(id) ? await Budget.deleteOne({ _id: id, user: req.userId }) : { deletedCount: 0 };
  if (!r.deletedCount) throw notFound('Budget not found');
  res.status(204).end();
}));
