import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { SummaryView } from '@/components/finance/SummaryView';
import { TransactionList } from '@/components/finance/TransactionList';
import { Amount } from '@/components/ui/Amount';
import { BrandLoader } from '@/components/ui/BrandLoader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/contexts/DataContext';
import { useFetch } from '@/hooks';
import { currentMonth } from '@/lib/dates';
import type { Summary } from '@/types';

type View = 'list' | 'summary';
const POLL_MS = 15_000;
const SLOW_POLL_MS = 90_000; // a safety net only; live updates do the real work

/** A read-only view of one person's *shared* entries, for someone you follow. Refreshes itself while you look. */
export function PersonPage() {
  const { personId = '' } = useParams();
  const { family, familyLoaded, version, live } = useData();
  const pollMs = live ? SLOW_POLL_MS : POLL_MS;
  const nav = useNavigate();
  const [view, setView] = useState<View>('list');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && setTick((t) => t + 1), pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  const link = family.following.find((c) => c.user.id === personId);
  const summary = useFetch<Summary>(link ? `/family/people/${personId}/summary?month=${currentMonth()}` : null, [tick, version]);

  if (familyLoaded && !link) return <Navigate to="/family" replace />;
  if (!link) return <BrandLoader size="inline" className="pt-24" />;
  const s = summary.data;
  const first = link.user.name.split(' ')[0];

  return (
    <div className="space-y-3">
      <Button variant="link" onClick={() => nav('/family')} className="-ml-1"><ArrowLeft size={20} aria-hidden />Back</Button>
      <header>
        <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.03em]">{link.user.name}</h1>
        <p className="mt-0.5 text-[16px] font-semibold text-accent">{link.relation}</p>
        <p className="text-muted">View only. You can see the entries {first} chose to share.</p>
      </header>

      <Card className="space-y-3">
        <div>
          <p className="text-[15px] font-semibold text-muted">Money {first} has (shared entries)</p>
          {s ? <Amount paise={s.balancePaise} className="text-[36px] font-bold leading-tight" /> : <Skeleton className="mt-1 h-10 w-40" />}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div><p className="text-sm text-muted">Received this month</p>{s ? <Amount paise={s.incomePaise} kind="income" className="text-lg font-semibold" /> : <Skeleton className="h-6 w-20" />}</div>
          <div><p className="text-sm text-muted">Spent this month</p>{s ? <Amount paise={s.expensePaise} kind="expense" className="text-lg font-semibold" /> : <Skeleton className="h-6 w-20" />}</div>
        </div>
      </Card>

      <Segmented<View> label="View" value={view} onChange={setView} options={[{ value: 'list', label: 'All entries' }, { value: 'summary', label: 'Summary' }]} />
      {view === 'list'
        ? <TransactionList basePath={`/family/people/${personId}/transactions`} readOnly pollMs={pollMs} />
        : <SummaryView summaryPath={`/family/people/${personId}/summary`} trendPath={`/family/people/${personId}/trend`} readOnly pollMs={pollMs} />}
    </div>
  );
}
