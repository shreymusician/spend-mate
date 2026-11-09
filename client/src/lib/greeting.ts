/**
 * The welcome greeting should feel like "opening the app after a while", not like every page refresh.
 * Phones reload pages a lot (switching apps, waking from sleep, memory clean-up, the dev server refreshing),
 * so on reopening a remembered device we only greet when the person has been away for a while.
 * Signing in always greets.
 */
const KEY = 'spendmate-last-seen';
export const AWAY_MS = 30 * 60_000;

export function shouldGreetOnOpen(userId: string, now = Date.now()): boolean {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { user: string; at: number } | null;
    return !v || v.user !== userId || now - v.at > AWAY_MS;
  } catch { return true; }
}

export function markSeen(userId: string, now = Date.now()) {
  try { localStorage.setItem(KEY, JSON.stringify({ user: userId, at: now })); } catch { /* private mode: greet next time */ }
}

export function forgetSeen() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
