import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { MONTH_RE, currentMonth } from '../../utils/dates.js';
import { asyncHandler } from '../../utils/errors.js';
import { monthlySummary, trend } from '../analytics/analytics.js';
import { listTransactions } from '../transactions/transactions.service.js';
import { listQuerySchema } from '../transactions/transactions.validators.js';
import * as fam from './family.service.js';

export const familyRouter = Router();
familyRouter.use(requireAuth);

const acceptLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 15,
  message: { error: { code: 'rate_limited', message: 'Too many tries. Please wait a bit and try again.' } },
});

familyRouter.get('/', asyncHandler(async (req, res) => {
  res.json(await fam.listLinks(req.userId!));
}));

familyRouter.post('/invites', validateBody(z.object({ role: z.enum(['parent', 'child']) })), asyncHandler(async (req, res) => {
  res.status(201).json(await fam.createInvite(req.userId!, req.body.role));
}));

familyRouter.post('/invites/accept', acceptLimiter, validateBody(z.object({ code: z.string().trim().min(4).max(12) })), asyncHandler(async (req, res) => {
  res.status(201).json(await fam.acceptInvite(req.userId!, req.body.code));
}));

familyRouter.delete('/links/:id', asyncHandler(async (req, res) => {
  await fam.removeLink(req.userId!, String(req.params.id));
  res.status(204).end();
}));

familyRouter.post('/sharing', validateBody(z.object({ visibility: z.enum(['shared', 'private']) })), asyncHandler(async (req, res) => {
  res.json(await fam.setAllVisibility(req.userId!, req.body.visibility));
}));

// ---- Parent's read-only view of a linked child (shared entries only) ----

familyRouter.get('/overview', asyncHandler(async (req, res) => {
  const month = z.string().regex(MONTH_RE).default(() => currentMonth()).parse(req.query.month);
  res.json(await fam.familyOverview(req.userId!, month));
}));

familyRouter.get('/children/:childId/summary', asyncHandler(async (req, res) => {
  const childId = String(req.params.childId);
  await fam.assertParentOf(req.userId!, childId);
  const month = z.string().regex(MONTH_RE).default(() => currentMonth()).parse(req.query.month);
  res.json(await monthlySummary(childId, month, new Date(), { sharedOnly: true }));
}));

familyRouter.get('/children/:childId/trend', asyncHandler(async (req, res) => {
  const childId = String(req.params.childId);
  await fam.assertParentOf(req.userId!, childId);
  const months = z.coerce.number().int().min(2).max(24).default(6).parse(req.query.months);
  res.json({ trend: await trend(childId, currentMonth(), months, { sharedOnly: true }) });
}));

familyRouter.get('/children/:childId/transactions', asyncHandler(async (req, res) => {
  const childId = String(req.params.childId);
  await fam.assertParentOf(req.userId!, childId);
  res.json(await listTransactions(childId, listQuerySchema.parse(req.query), { sharedOnly: true }));
}));

// ---- Comments: parent writes, both can read (on shared entries) ----

familyRouter.get('/transactions/:txId/comments', asyncHandler(async (req, res) => {
  res.json({ comments: await fam.listComments(req.userId!, String(req.params.txId)) });
}));

familyRouter.post('/transactions/:txId/comments', validateBody(z.object({ body: z.string().trim().min(1).max(300) })), asyncHandler(async (req, res) => {
  res.status(201).json(await fam.addComment(req.userId!, String(req.params.txId), req.body.body));
}));
