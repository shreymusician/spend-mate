import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/errors.js';
import { createCategory, deleteCategory, listCategories } from './categories.js';

const createSchema = z.object({
  name: z.string().trim().min(1).max(30),
  icon: z.string().max(30).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ categories: await listCategories(req.userId!) });
}));
categoriesRouter.post('/', validateBody(createSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ category: await createCategory(req.userId!, req.body) });
}));
categoriesRouter.delete('/:id', asyncHandler(async (req, res) => {
  await deleteCategory(req.userId!, String(req.params.id));
  res.status(204).end();
}));
