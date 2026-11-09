import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler, badRequest, unauthorized } from '../../utils/errors.js';
import { updatePrefsSchema } from '../auth/auth.validators.js';
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

// Profile photo: the app shrinks it to a small square first; here it is checked again so nothing
// but a real, small JPEG / PNG / WebP gets stored (no SVG, which can carry scripts).
const MAX_AVATAR_CHARS = 90_000;
const avatarSchema = z.object({
  image: z.string().max(MAX_AVATAR_CHARS, 'That photo is too large').regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Please choose a JPEG, PNG or WebP photo'),
});

export function looksLikeImage(dataUrl: string): boolean {
  const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const webp = b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || webp;
}

usersRouter.put('/me/avatar', validateBody(avatarSchema), asyncHandler(async (req, res) => {
  if (!looksLikeImage(req.body.image)) throw badRequest('Please choose a JPEG, PNG or WebP photo');
  const user = await User.findByIdAndUpdate(req.userId, { avatarUrl: req.body.image }, { returnDocument: 'after' });
  if (!user) throw unauthorized();
  res.json({ user: publicUser(user) });
}));

usersRouter.delete('/me/avatar', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, { $unset: { avatarUrl: 1 } }, { returnDocument: 'after' });
  if (!user) throw unauthorized();
  res.json({ user: publicUser(user) });
}));
