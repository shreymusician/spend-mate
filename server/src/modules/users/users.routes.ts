import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { profileChanged } from '../../realtime/notify.js';
import { asyncHandler, unauthorized } from '../../utils/errors.js';
import { updatePrefsSchema } from '../auth/auth.validators.js';
import { avatarDataUrl } from './avatar.js';
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
