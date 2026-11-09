import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { SummaryView } from '@/components/finance/SummaryView';
import { TransactionList } from '@/components/finance/TransactionList';
import { Amount } from '@/components/ui/Amount';
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

/** A parent's read-only view of one child's *shared* entries. Refreshes itself every 15 seconds. */
export function ChildPage() {
  const { childId = '' } = useParams();
  const { family, familyLoaded } = useData();
  const nav = useNavigate();
  const [view, setView] = useState<View>('list');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && setTick((t) => t + 1), POLL_MS);
    return () => clearInterval(id);
  }, []);

  const link = family.children.find((c) => c.user.id === childId);
  const summary = useFetch<Summary>(link ? `/family/children/${childId}/summary?month=${currentMonth()}` : null, [tick]);

  if (familyLoaded && !link) return <Navigate to="/family" replace />;
  if (!link) return <Skeleton className="h-40 w-full" />;
  const s = summary.data;
  const first = link.user.name.split(' ')[0];

  return (
    <div className="space-y-3">
      <Button variant="link" onClick={() => nav('/family')} className="-ml-1"><ArrowLeft size={20} aria-hidden />Back</Button>
      <header>
        <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.03em]">{link.user.name}</h1>
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
        ? <TransactionList basePath={`/family/children/${childId}/transactions`} readOnly pollMs={POLL_MS} />
        : <SummaryView summaryPath={`/family/children/${childId}/summary`} trendPath={`/family/children/${childId}/trend`} readOnly pollMs={POLL_MS} />}
    </div>
  );
}
