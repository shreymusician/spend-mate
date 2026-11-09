import { z } from 'zod';
import { GENDERS } from '../users/user.model.js';

/** Accepts "98765 43210", "+91 98765 43210", "09876543210"; returns the plain 10 digits. */
export function normalizeMobile(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

const mobile = z
  .string()
  .transform(normalizeMobile)
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));

const pin = z.string().regex(/^\d{4}$/, 'Secret Pin must be exactly 4 digits');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(60),
  gender: z.enum(GENDERS, { error: 'Please choose an option' }),
  dob: z.coerce.date({ error: 'Please enter your date of birth' }).max(new Date(), 'Date of birth cannot be in the future'),
  mobile,
  pin,
  // Optional: the light/dark choice made on the landing page.
  theme: z.enum(['light', 'dark']).optional(),
  remember: z.boolean().default(true),
});

export const loginSchema = z.object({ mobile, pin, remember: z.boolean().default(true) });

// dob stays a plain YYYY-MM-DD string so the comparison is exact (no time-zone shifts).
export const resetPinSchema = z.object({
  mobile,
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter your date of birth'),
  pin,
});

export const updatePrefsSchema = z
  .object({
    theme: z.enum(['dark', 'light', 'system']),
    tone: z.enum(['playful', 'neutral']),
    pushEnabled: z.boolean(),
  })
  .partial()
  .strict();
