import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { profileChanged } from '../../realtime/notify.js';
import { confirmPin } from '../auth/auth.service.js';
import { asyncHandler, unauthorized } from '../../utils/errors.js';
import { updatePrefsSchema } from '../auth/auth.validators.js';
import { avatarDataUrl } from './avatar.js';
import { clearData, entriesCsv, exportData, todayIst } from './userData.js';
import { User, publicUser } from './user.model.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw unauthorized();
  res.json({ user: publicUser(user) });
}));

usersRouter.patch('/me/prefs', validateBody(updatePrefsSchema), asyncHandler(async (req, res) => {
  const set = Object.fromEntries(Object.entries(req.body).map(([k, v]) => [`prefs.${k}`, v]));
  const user = await User.findByIdAndUpdate(req.userId, { $set: set }, { returnDocument: 'after' });
  if (!user) throw unauthorized();
  res.json({ user: publicUser(user) });
}));

const avatarSchema = z.object({ image: avatarDataUrl });

usersRouter.put('/me/avatar', validateBody(avatarSchema), asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, { avatarUrl: req.body.image }, { returnDocument: 'after' });
  if (!user) throw unauthorized();
  profileChanged(String(user._id));
  res.json({ user: publicUser(user) });
}));

usersRouter.delete('/me/avatar', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, { $unset: { avatarUrl: 1 } }, { returnDocument: 'after' });
  if (!user) throw unauthorized();
  profileChanged(String(user._id));
  res.json({ user: publicUser(user) });
}));

// ---- Your data: download a copy, or clear it ----

// A copy of everything that is yours, as a spreadsheet (just the entries) or a full copy.
usersRouter.get('/me/export', asyncHandler(async (req, res) => {
  const format = z.enum(['json', 'csv']).default('json').parse(req.query.format);
  const data = await exportData(req.userId!);
  const filename = `spendmate-${format === 'csv' ? 'entries' : 'data'}-${todayIst()}.${format}`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  if (format === 'csv') res.type('text/csv; charset=utf-8').send(entriesCsv(data));
  else res.type('application/json; charset=utf-8').send(JSON.stringify(data, null, 2));
}));

// Permanently clears entries, budgets and custom categories. The Secret Pin must be typed again.
usersRouter.post('/me/clear-data', validateBody(z.object({ pin: z.string().regex(/^\d{4}$/, 'Secret Pin must be exactly 4 digits') })), asyncHandler(async (req, res) => {
  await confirmPin(req.userId!, req.body.pin);
  res.json({ cleared: await clearData(req.userId!) });
}));
