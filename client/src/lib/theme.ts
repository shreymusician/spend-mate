export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'spendmate-theme';

/** Theme chosen before signing in (landing page). Light unless the person switched it. */
export function getGuestTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch { return 'light'; }
}

export function setGuestTheme(t: ThemePref) {
  try { localStorage.setItem(KEY, t); } catch { /* private mode: just don't remember */ }
}
