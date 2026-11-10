import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// The last answer for each address. Coming back to a screen shows it at once while fresh data loads behind it,
// so tabs feel instant. Emptied on sign-in and sign-out so one person's data is never shown to another.
const cache = new Map<string, unknown>();
export const clearFetchCache = () => cache.clear();

/** GET `path`, refetching when `path` or `deps` change. `error` is user-facing text. */
export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(() => (path && cache.has(path) ? (cache.get(path) as T) : null));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => !!path && !cache.has(path));

  const load = useCallback(async () => {
    if (!path) return;
    setError('');
    try { const r = await api<T>(path); cache.set(path, r); setData(r); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    if (path && cache.has(path)) setData(cache.get(path) as T); // show the last answer right away
    else setLoading(true);
    load();
  }, [load, path]);
  return { data, error, loading, reload: load };
}

/** A number that goes up every `ms` while the page is visible. Add it to a fetch's deps to refresh on a timer. */
export function usePoll(ms: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}
