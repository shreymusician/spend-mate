import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/errors.js';
import * as svc from './transactions.service.js';
import { createTransactionSchema, listQuerySchema, updateTransactionSchema } from './transactions.validators.js';

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

transactionsRouter.get('/', asyncHandler(async (req, res) => {
  res.json(await svc.listTransactions(req.userId!, listQuerySchema.parse(req.query)));
}));

transactionsRouter.post('/', validateBody(createTransactionSchema), asyncHandler(async (req, res) => {
  const { transaction, duplicate } = await svc.createTransaction(req.userId!, req.body);
  res.status(duplicate ? 200 : 201).json({ transaction, duplicate });
}));

transactionsRouter.get('/:id', asyncHandler(async (req, res) => {
  res.json({ transaction: await svc.getTransaction(req.userId!, String(req.params.id)) });
}));

transactionsRouter.get('/:id/history', asyncHandler(async (req, res) => {
  res.json({ history: await svc.transactionHistory(req.userId!, String(req.params.id)) });
}));

transactionsRouter.patch('/:id', validateBody(updateTransactionSchema), asyncHandler(async (req, res) => {
  res.json({ transaction: await svc.updateTransaction(req.userId!, String(req.params.id), req.body) });
}));

transactionsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await svc.deleteTransaction(req.userId!, String(req.params.id));
  res.status(204).end();
}));
