import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** A random id. crypto.randomUUID only exists on https or localhost, so phones opening the app over a plain http network address need the fallback. */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Integer paise → "₹1,250" / "₹1,250.50" (Indian digit grouping). */
export function formatPaise(paise: number, opts: { signed?: boolean } = {}): string {
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const body = rupees.toLocaleString('en-IN') + (rem ? `.${String(rem).padStart(2, '0')}` : '');
  const sign = paise < 0 ? '−' : opts.signed && paise > 0 ? '+' : '';
  return `${sign}₹${body}`;
}
