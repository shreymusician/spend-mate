const IST = 330 * 60_000;

export const currentMonth = () => new Date(Date.now() + IST).toISOString().slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export const monthLabel = (month: string, style: 'long' | 'short' = 'long') =>
  new Date(`${month}-15T00:00:00Z`).toLocaleDateString('en-IN', { month: style, year: style === 'long' ? 'numeric' : undefined, timeZone: 'UTC' });

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export const shortWeekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });

/** <input type="datetime-local"> value for an instant, in the device's local time. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
