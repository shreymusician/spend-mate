import { useSyncExternalStore } from 'react';

/** How many data requests are in flight right now. Drives the thin progress bar at the top of the screen. */
let active = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function trackLoad<T>(p: Promise<T>): Promise<T> {
  active++; emit();
  const done = () => { active = Math.max(0, active - 1); emit(); };
  p.then(done, done);
  return p;
}

export const useIsLoading = () =>
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => active > 0, () => false);
