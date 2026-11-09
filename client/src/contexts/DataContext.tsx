import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { startRealtime } from '@/lib/realtime';
import type { Category, FamilyLinks } from '@/types';

interface DataState {
  categories: Category[];
  /** People linked to me as parents / as children. */
  family: FamilyLinks;
  familyLoaded: boolean;
  /** Bumps whenever transactions/budgets change so screens refetch. */
  version: number;
  bump: () => void;
  /** True while the live connection is up (updates arrive by themselves). */
  live: boolean;
  reloadFamily: () => Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [family, setFamily] = useState<FamilyLinks>({ parents: [], children: [] });
  const [familyLoaded, setFamilyLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const [live, setLive] = useState(false);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const reloadFamily = useCallback(async () => {
    try { setFamily(await api<FamilyLinks>('/family')); } finally { setFamilyLoaded(true); }
  }, []);

  useEffect(() => {
    api<{ categories: Category[] }>('/categories').then((r) => setCategories(r.categories)).catch(() => {});
    reloadFamily().catch(() => {});
  }, [reloadFamily]);

  // Live updates: the server says "something changed" and every screen refetches through the normal API.
  useEffect(() => startRealtime({
    onStatus: setLive,
    onUpdate: (u) => { if (u.topics.includes('family')) reloadFamily().catch(() => {}); bump(); },
    onCatchUp: () => { reloadFamily().catch(() => {}); bump(); },
  }), [reloadFamily, bump]);

  // Someone may link to you from their own phone. Pick that up without a reload, so a new parent shows up
  // (and new entries default to "shared") as soon as the app is looked at again.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') reloadFamily().catch(() => {}); };
    const id = setInterval(refresh, live ? 120_000 : 20_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [reloadFamily, live]);

  const value = useMemo(() => ({ categories, family, familyLoaded, version, bump, live, reloadFamily }), [categories, family, familyLoaded, version, bump, live, reloadFamily]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
