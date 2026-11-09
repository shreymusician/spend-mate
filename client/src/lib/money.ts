/** "250", "250.5", "1,250.75" → integer paise, or null if invalid. No floating-point maths. */
export function rupeesToPaise(input: string): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.replace(/[,\s₹]/g, ''));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
}

export const paiseToInput = (paise: number) => {
  const r = Math.floor(paise / 100), p = paise % 100;
  return p ? `${r}.${String(p).padStart(2, '0')}` : String(r);
};
