/** App-wide calendar is India Standard Time (UTC+5:30, no DST). */
const IST_OFFSET_MS = 330 * 60_000;

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** [start, end) of an IST calendar month, as UTC instants. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS),
  };
}

export function currentMonth(now = new Date()): string {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Last `n` months ending at `month`, oldest first. */
export function lastMonths(month: string, n: number): string[] {
  const out = [month];
  while (out.length < n) out.unshift(previousMonth(out[0]!));
  return out;
}

export const istOffsetMs = IST_OFFSET_MS;
