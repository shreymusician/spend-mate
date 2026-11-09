import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { findCategory } from '@/lib/categories';
import { monthLabel } from '@/lib/dates';
import { formatPaise } from '@/lib/utils';
import type { Summary, TrendPoint } from '@/types';

const axis = { fill: 'var(--sm-muted)', fontSize: 13 };
const rupees = (v: unknown) => formatPaise(Number(v));

/** Categories as labelled bars: easier to read than a pie. */
export function CategoryBars({ rows }: { rows: Summary['byCategory'] }) {
  const { categories } = useData();
  const max = Math.max(...rows.map((r) => r.totalPaise), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const c = findCategory(categories, r.category);
        return (
          <li key={r.category}>
            <div className="mb-1 flex justify-between text-[16px]">
              <span>{c.name}</span>
              <span className="font-semibold tabular-nums">{formatPaise(r.totalPaise)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${(r.totalPaise / max) * 100}%`, background: c.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const data = points.map((p) => ({ label: monthLabel(p.month, 'short').slice(0, 3), Received: p.incomePaise, Spent: p.expensePaise }));
  return (
    <div role="img" aria-label="Money received and spent in each of the last months" className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval={0} />
          <Tooltip formatter={rupees} contentStyle={{ background: 'var(--sm-surface)', border: '1px solid var(--sm-line)', borderRadius: 10, fontSize: 14 }} cursor={{ fill: 'var(--sm-surface-2)' }} />
          <Bar dataKey="Received" fill="var(--sm-pos)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="Spent" fill="var(--sm-neg)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
