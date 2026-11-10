import { ChevronLeft, ChevronRight, PieChart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BudgetSheet } from '@/components/finance/BudgetSheet';
import { CategoryBars, TrendChart } from '@/components/finance/charts';
import { Amount } from '@/components/ui/Amount';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/contexts/DataContext';
import { useFetch } from '@/hooks';
import { findCategory } from '@/lib/categories';
import { currentMonth, monthLabel, shiftMonth } from '@/lib/dates';
import { budgetLine, monthInsights } from '@/lib/insights';
import type { Summary, TrendPoint } from '@/types';

interface Props {
  /** e.g. '/analytics/summary' or `/family/people/<id>/summary` */
  summaryPath: string;
  trendPath: string;
  /** People you follow show no budgets and can't edit anything. */
  readOnly?: boolean;
  pollMs?: number;
}

export function SummaryView({ summaryPath, trendPath, readOnly, pollMs }: Props) {
  const { categories, version } = useData();
  const [month, setMonth] = useState(currentMonth());
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(() => document.visibilityState === 'visible' && setTick((t) => t + 1), pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  const summary = useFetch<Summary>(`${summaryPath}?month=${month}`, [version, tick]);
  const trend = useFetch<{ trend: TrendPoint[] }>(`${trendPath}${trendPath.includes('?') ? '&' : '?'}months=6`, [version, tick]);
  const s = summary.data;
  const empty = s && s.incomePaise === 0 && s.expensePaise === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="secondary" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} className="w-12 px-0"><ChevronLeft size={24} /></Button>
        <p className="text-lg font-bold">{monthLabel(month)}</p>
        <Button variant="secondary" aria-label="Next month" disabled={month >= currentMonth()} onClick={() => setMonth(shiftMonth(month, 1))} className="w-12 px-0"><ChevronRight size={24} /></Button>
      </div>

      {summary.error && <p role="alert" className="font-medium text-neg">{summary.error}</p>}
      {!s && !summary.error && <Skeleton className="h-40 w-full" />}
      {s && (
        <>
          <Card className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-sm text-muted">Received</p><Amount paise={s.incomePaise} kind="income" className="font-semibold" /></div>
            <div><p className="text-sm text-muted">Spent</p><Amount paise={s.expensePaise} kind="expense" className="font-semibold" /></div>
            <div><p className="text-sm text-muted">Difference</p><Amount paise={s.incomePaise - s.expensePaise} className="font-semibold" /></div>
          </Card>

          {empty ? <EmptyState icon={PieChart} title="Nothing in this month" /> : (
            <>
              {monthInsights(s, categories).length > 0 && (
                <Card className="space-y-1">{monthInsights(s, categories).map((l) => <p key={l}>{l}</p>)}</Card>
              )}
              {s.byCategory.length > 0 && <Card><CardTitle>Where the money went</CardTitle><CategoryBars rows={s.byCategory} /></Card>}
            </>
          )}

          {!readOnly && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <CardTitle>Budgets</CardTitle>
                <Button variant="link" onClick={() => setBudgetOpen(true)}>{s.budgets.length ? 'Change' : 'Set a budget'}</Button>
              </div>
              {s.budgets.length === 0 && <p className="text-muted">No budget for {monthLabel(month)}.</p>}
              <div className="space-y-4">
                {s.budgets.map((b) => (
                  <div key={b.id}>
                    <div className="mb-1 flex justify-between">
                      <span className="font-medium">{b.category ? findCategory(categories, b.category).name : 'Whole month'}</span>
                      <span className="tabular-nums"><Amount paise={b.spentPaise} /> of <Amount paise={b.limitPaise} /></span>
                    </div>
                    <ProgressBar ratio={b.spentPaise / b.limitPaise} label={`${b.category ?? 'Whole month'} budget used`} />
                    <p className="mt-1 text-sm text-muted">{budgetLine(b.spentPaise, b.limitPaise)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {trend.data && <Card><CardTitle>Last 6 months</CardTitle><TrendChart points={trend.data.trend} /></Card>}
      {!readOnly && <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} month={month} budgets={s?.budgets ?? []} />}
    </div>
  );
}
