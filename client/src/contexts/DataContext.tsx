import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { Category, FamilyLinks } from '@/types';

interface DataState {
  categories: Category[];
  /** People linked to me as parents / as children. */
  family: FamilyLinks;
  familyLoaded: boolean;
  /** Bumps whenever transactions/budgets change so screens refetch. */
  version: number;
  bump: () => void;
  reloadFamily: () => Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [family, setFamily] = useState<FamilyLinks>({ parents: [], children: [] });
  const [familyLoaded, setFamilyLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const reloadFamily = useCallback(async () => {
    try { setFamily(await api<FamilyLinks>('/family')); } finally { setFamilyLoaded(true); }
  }, []);

  useEffect(() => {
    api<{ categories: Category[] }>('/categories').then((r) => setCategories(r.categories)).catch(() => {});
    reloadFamily().catch(() => {});
  }, [reloadFamily]);

  // Someone may link to you from their own phone. Pick that up without a reload, so a new parent shows up
  // (and new entries default to "shared") as soon as the app is looked at again.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') reloadFamily().catch(() => {}); };
    const id = setInterval(refresh, 20_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [reloadFamily]);

  const value = useMemo(() => ({ categories, family, familyLoaded, version, bump, reloadFamily }), [categories, family, familyLoaded, version, bump, reloadFamily]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
