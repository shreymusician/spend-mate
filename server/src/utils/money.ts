/** All money is integer paise. No floating-point arithmetic on amounts. */

export class MoneyError extends Error {}

export function assertPaise(n: number, label = 'amount'): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new MoneyError(`${label} must be a non-negative integer (paise)`);
}

/** Equal split; the remainder paise go one each to the first participants (input order). */
export function splitEqual(totalPaise: number, userIds: string[]): Map<string, number> {
  assertPaise(totalPaise, 'total');
  if (userIds.length === 0) throw new MoneyError('At least one participant is required');
  if (new Set(userIds).size !== userIds.length) throw new MoneyError('Duplicate participants');
  const base = Math.floor(totalPaise / userIds.length);
  const extra = totalPaise - base * userIds.length;
  return new Map(userIds.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
}

/** Exact split; shares must sum to the total. */
export function splitExact(totalPaise: number, shares: { userId: string; paise: number }[]): Map<string, number> {
  assertPaise(totalPaise, 'total');
  if (shares.length === 0) throw new MoneyError('At least one participant is required');
  const out = new Map<string, number>();
  let sum = 0;
  for (const s of shares) {
    assertPaise(s.paise, 'share');
    if (out.has(s.userId)) throw new MoneyError('Duplicate participants');
    out.set(s.userId, s.paise);
    sum += s.paise;
  }
  if (sum !== totalPaise) throw new MoneyError(`Shares add up to ${sum} paise, expected ${totalPaise}`);
  return out;
}

/**
 * Percentage split in basis points (100 bps = 1%). Must total 10000 bps.
 * Uses largest-remainder so shares always sum exactly to the total.
 */
export function splitPercent(totalPaise: number, shares: { userId: string; bps: number }[]): Map<string, number> {
  assertPaise(totalPaise, 'total');
  if (shares.length === 0) throw new MoneyError('At least one participant is required');
  let bpsSum = 0;
  const seen = new Set<string>();
  for (const s of shares) {
    if (!Number.isSafeInteger(s.bps) || s.bps < 0) throw new MoneyError('Percentages must be non-negative');
    if (seen.has(s.userId)) throw new MoneyError('Duplicate participants');
    seen.add(s.userId);
    bpsSum += s.bps;
  }
  if (bpsSum !== 10000) throw new MoneyError('Percentages must add up to 100%');

  const rows = shares.map((s, i) => {
    const product = totalPaise * s.bps; // safe: totalPaise * 10000 stays < 2^53 for realistic amounts
    return { ...s, i, floor: Math.floor(product / 10000), rem: product % 10000 };
  });
  let left = totalPaise - rows.reduce((a, r) => a + r.floor, 0);
  [...rows].sort((a, b) => b.rem - a.rem || a.i - b.i).forEach((r) => {
    if (left > 0) { r.floor += 1; left -= 1; }
  });
  return new Map(rows.map((r) => [r.userId, r.floor]));
}

/** Rupees string ("250", "250.5", "250.50") → paise, or throws. */
export function rupeesToPaise(input: string): number {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) throw new MoneyError('Invalid amount');
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
}
