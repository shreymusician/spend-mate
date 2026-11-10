import { z } from 'zod';

// Profile photo: the app shrinks it to a small square first; here it is checked again so nothing
// but a real, small JPEG / PNG / WebP gets stored (no SVG, which can carry scripts).
export const MAX_AVATAR_CHARS = 90_000;
const NOT_AN_IMAGE = 'Please choose a JPEG, PNG or WebP photo';

/** Does the data inside a data-URL start like a real JPEG, PNG or WebP file? */
export function looksLikeImage(dataUrl: string): boolean {
  const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const webp = b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || webp;
}

/** A photo sent as a data-URL: right label, small enough, and genuinely an image. */
export const avatarDataUrl = z
  .string()
  .max(MAX_AVATAR_CHARS, 'That photo is too large')
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, NOT_AN_IMAGE)
  .refine(looksLikeImage, NOT_AN_IMAGE);
