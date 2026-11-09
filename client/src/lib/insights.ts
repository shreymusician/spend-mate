import { findCategory } from '@/lib/categories';
import { currentMonth } from '@/lib/dates';
import { formatPaise } from '@/lib/utils';
import type { Category, Summary } from '@/types';

/** Plain, factual sentences. Never claims more than the numbers support. */
export function monthInsights(s: Summary, cats: Category[]): string[] {
  const out: string[] = [];
  const inProgress = s.month === currentMonth();
  const top = s.byCategory[0];

  if (top && s.expensePaise > 0) {
    const share = Math.round((top.totalPaise * 100) / s.expensePaise);
    out.push(`Most spent on ${findCategory(cats, top.category).name}${inProgress ? ' so far' : ''}: ${formatPaise(top.totalPaise)} (${share}% of spending).`);
  }

  const prev = s.previousMonth.expensePaise;
  if (prev > 0 && s.expensePaise > 0) {
    const pct = Math.round((Math.abs(s.expensePaise - prev) * 100) / prev);
    const dir = s.expensePaise > prev ? 'more' : 'less';
    out.push(pct === 0 ? `About the same as last month${inProgress ? ' so far' : ''}.` : `${pct}% ${dir} than last month${inProgress ? ' so far (the month isn’t over yet)' : ''}.`);
  }
  return out;
}

export const budgetLine = (spent: number, limit: number): string =>
  spent > limit ? `Over budget by ${formatPaise(spent - limit)}.` : `${formatPaise(limit - spent)} left this month.`;
