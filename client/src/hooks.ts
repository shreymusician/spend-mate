import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** GET `path`, refetching when `path` or `deps` change. `error` is user-facing text. */
export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!path);

  const load = useCallback(async () => {
    if (!path) return;
    setError('');
    try { setData(await api<T>(path)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => { setLoading(true); load(); }, [load]);
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
