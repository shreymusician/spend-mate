import { Plus, Receipt, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { TransactionDetail } from '@/components/finance/TransactionDetail';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { TransactionSheet } from '@/components/finance/TransactionSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/contexts/DataContext';
import { api } from '@/lib/api';
import { METHOD_LABEL } from '@/lib/categories';
import { rupeesToPaise } from '@/lib/money';
import { PAYMENT_METHODS, type Transaction } from '@/types';

type TypeFilter = '' | 'expense' | 'income';
interface Filters { q: string; type: TypeFilter; category: string; method: string; from: string; to: string; min: string; max: string }
const NO_FILTERS: Filters = { q: '', type: '', category: '', method: '', from: '', to: '', min: '', max: '' };

function queryOf(f: Filters, before?: string) {
  const p = new URLSearchParams({ limit: '25' });
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.type) p.set('type', f.type);
  if (f.category) p.set('category', f.category);
  if (f.method) p.set('paymentMethod', f.method);
  // Date inputs are calendar days; "to" is inclusive, so send the start of the next day.
  if (f.from) p.set('from', new Date(`${f.from}T00:00:00`).toISOString());
  if (f.to) p.set('to', new Date(new Date(`${f.to}T00:00:00`).getTime() + 86_400_000).toISOString());
  const min = f.min ? rupeesToPaise(f.min) : null, max = f.max ? rupeesToPaise(f.max) : null;
  if (min !== null) p.set('minPaise', String(min));
  if (max !== null) p.set('maxPaise', String(max));
  if (before) p.set('before', before);
  return p.toString();
}

interface Props {
  /** '/transactions' for your own entries, or `/family/people/<id>/transactions` for someone you follow (read-only). */
  basePath: string;
  readOnly?: boolean;
  /** Re-fetch every N ms (a parent's screen stays current without a manual refresh). */
  pollMs?: number;
}

export function TransactionList({ basePath, readOnly, pollMs }: Props) {
  const { categories, version } = useData();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Transaction[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [add, setAdd] = useState<'expense' | 'income' | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => (f.q === q ? f : { ...f, q })), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!pollMs) return;
    const refresh = () => document.visibilityState === 'visible' && setTick((t) => t + 1);
    const id = setInterval(refresh, pollMs);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh); };
  }, [pollMs]);

  const load = useCallback(async (before?: string) => {
    setError('');
    try {
      const r = await api<{ transactions: Transaction[]; next: string | null }>(`${basePath}?${queryOf(filters, before)}`);
      setRows((prev) => (before ? [...prev, ...r.transactions] : r.transactions));
      setNext(r.next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setLoading(false); }
  }, [basePath, filters]);

  // Show the skeleton only on filter changes, not on silent refreshes.
  useEffect(() => { setLoading(true); }, [basePath, filters]);
  useEffect(() => { load(); }, [load, version, tick]);

  const active = [filters.category, filters.method, filters.from, filters.to, filters.min, filters.max].filter(Boolean).length;
  const filtered = !!(active || filters.q || filters.type);

  return (
    <div className="space-y-3 pb-20">
      <div className="flex items-end gap-2">
        <div className="flex-1"><Field label="Search" placeholder="Name, reason or shop" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button variant="secondary" onClick={() => setFilterOpen(true)} aria-label={`More filters${active ? `, ${active} on` : ''}`} className="relative w-14 px-0">
          <SlidersHorizontal size={22} aria-hidden />
          {active > 0 && <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-accent text-sm text-accent-fg">{active}</span>}
        </Button>
      </div>
      <div className="flex gap-2">
        {([['', 'All'], ['expense', 'Spent'], ['income', 'Received']] as const).map(([v, l]) => (
          <Chip key={v} active={filters.type === v} onClick={() => setFilters((f) => ({ ...f, type: v }))}>{l}</Chip>
        ))}
      </div>

      {error && <p role="alert" className="font-medium text-neg">{error}</p>}
      {loading && rows.length === 0 && <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
      {!loading && rows.length === 0 && !error && (
        <EmptyState icon={Receipt} title={filtered ? 'Nothing matches' : readOnly ? 'Nothing shared yet' : 'No entries yet'}
          hint={filtered ? 'Try removing a filter.' : readOnly ? 'Entries will appear here when they are shared with you.' : 'Tap “Add spending” to write your first one.'} />
      )}
      {rows.length > 0 && <Card className="overflow-hidden p-0">{rows.map((t, i) => <TransactionRow key={t.id} t={t} index={i} onClick={() => setSelected(t)} />)}</Card>}
      {next && <Button variant="secondary" block onClick={() => load(next)}>Show more</Button>}

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-[96px] z-30 mx-auto flex max-w-[430px] justify-end px-4 pb-safe">
          <Button onClick={() => setAdd('expense')} className="h-14 rounded-full px-6 shadow-[0_14px_30px_-10px_rgba(10,150,120,0.8)]"><Plus size={22} aria-hidden />Add spending</Button>
        </div>
      )}

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} categories={categories}
        onApply={(f) => { setFilters({ ...f, q: filters.q, type: filters.type }); setFilterOpen(false); }} />
      {!readOnly && <TransactionSheet open={add !== null} kind={add ?? 'expense'} onClose={() => setAdd(null)} />}
      <TransactionDetail t={selected} onClose={() => setSelected(null)} readOnly={readOnly} />
    </div>
  );
}

function FilterSheet({ open, onClose, value, onApply, categories }: {
  open: boolean; onClose: () => void; value: Filters; onApply: (f: Filters) => void; categories: { id: string; name: string }[];
}) {
  const [f, setF] = useState(value);
  useEffect(() => { if (open) setF(value); }, [open, value]);
  const set = (k: keyof Filters) => (e: { target: { value: string } } | string) => setF((s) => ({ ...s, [k]: typeof e === 'string' ? e : e.target.value }));
  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <div className="space-y-4">
        <Select label="Category" value={f.category} onChange={set('category')} options={[{ value: '', label: 'Any' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select label="Paid by" value={f.method} onChange={set('method')} options={[{ value: '', label: 'Any' }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m]! }))]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="From date" type="date" value={f.from} onChange={set('from')} />
          <Field label="To date" type="date" value={f.to} onChange={set('to')} />
          <Field label="Least ₹" inputMode="decimal" value={f.min} onChange={set('min')} />
          <Field label="Most ₹" inputMode="decimal" value={f.max} onChange={set('max')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => onApply({ ...NO_FILTERS })}>Clear all</Button>
          <Button onClick={() => onApply(f)}>Show results</Button>
        </div>
      </div>
    </Sheet>
  );
}
