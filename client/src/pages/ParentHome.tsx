import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransactionDetail } from '@/components/finance/TransactionDetail';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { TransactionSheet } from '@/components/finance/TransactionSheet';
import { Amount } from '@/components/ui/Amount';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { HomeHeader } from '@/components/ui/HomeHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { CountUp } from '@/components/ui/CountUp';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/contexts/DataContext';
import { useFetch, usePoll } from '@/hooks';
import { currentMonth } from '@/lib/dates';
import { formatPaise } from '@/lib/utils';
import type { FamilyOverview, Summary, Transaction } from '@/types';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26 };
const POLL_MS = 15_000;
const SLOW_POLL_MS = 90_000; // a safety net only; live updates do the real work

/** Home for someone who follows children: the family at a glance first, their own money second. */
export function ParentHome() {
  const { version, live } = useData();
  const nav = useNavigate();
  const tick = usePoll(live ? SLOW_POLL_MS : POLL_MS);
  const ov = useFetch<FamilyOverview>(`/family/overview?month=${currentMonth()}`, [tick, version]);
  const own = useFetch<Summary>(`/analytics/summary?month=${currentMonth()}`, [version]);
  const [add, setAdd] = useState<'expense' | 'income' | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const o = ov.data;
  const n = o?.children.length ?? 0;

  return (
    <div className="space-y-5">
      <HomeHeader />

      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring}
        aria-label="Family this month"
        className="brand-gradient grain sheen relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_26px_44px_-22px_rgba(10,150,120,0.85)]"
      >
        <span aria-hidden className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/20 blur-2xl" />
        <div className="relative">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-white/85"><Users size={16} aria-hidden />Your family spent this month</p>
          {o ? <CountUp paise={o.totals.expensePaise} className="block text-[46px] font-bold leading-[1.1] tracking-[-0.035em] tabular-nums" /> : <Skeleton className="mt-2 h-11 w-44 bg-white/25" />}
          <p className="mt-2 text-[15px] text-white/85">
            {o ? `Across ${n} ${n === 1 ? 'child' : 'children'} · received ${formatPaise(o.totals.incomePaise)}` : '…'}
          </p>
          <p className="mt-1 text-[13px] text-white/70">Only entries they chose to share.</p>
        </div>
      </motion.section>

      {ov.error && <p role="alert" className="font-medium text-neg">{ov.error}</p>}

      <div>
        <CardTitle>Your children</CardTitle>
        <Card className="divide-y divide-line p-0">
          {!o && <div className="space-y-3 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
          {o?.children.map((c) => (
            <button key={c.linkId} type="button" onClick={() => nav(`/family/${c.user.id}`)} className="flex min-h-[72px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2">
              <Avatar name={c.user.name} src={c.user.avatarUrl} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold">{c.user.name}</span>
                <span className="block text-[14px] text-muted">Spent <span className="font-semibold text-fg">{formatPaise(c.expensePaise)}</span> this month</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
            </button>
          ))}
        </Card>
      </div>

      <div>
        <div className="flex items-end justify-between">
          <CardTitle>Latest from your children</CardTitle>
          <Button variant="link" onClick={() => nav('/family')} className="-mt-1 mb-1 min-h-0">See all</Button>
        </div>
        <Card className="overflow-hidden p-0">
          {o && o.feed.length === 0 && <p className="px-4 py-8 text-center text-muted">Nothing shared yet. Your children choose which entries to show you.</p>}
          {!o && <div className="space-y-3 p-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>}
          {o?.feed.map((t, i) => <TransactionRow key={t.id} t={t} by={t.child.name.split(' ')[0]} index={i} onClick={() => setSelected(t)} />)}
        </Card>
      </div>

      <div>
        <CardTitle>My own money</CardTitle>
        <Card className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[14px] text-muted">Money I have</p>
              {own.data ? <Amount paise={own.data.balancePaise} className="text-[28px] font-bold leading-tight" /> : <Skeleton className="h-8 w-28" />}
            </div>
            <div className="text-right text-[14px] text-muted">
              Spent this month
              <p className="text-[17px] font-semibold text-fg">{own.data ? formatPaise(own.data.expensePaise) : '…'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setAdd('expense')}><ArrowUpRight size={18} aria-hidden />Add spending</Button>
            <Button variant="secondary" onClick={() => setAdd('income')}><ArrowDownLeft size={18} aria-hidden />Add money</Button>
          </div>
          <Button variant="link" block onClick={() => nav('/history')}>See my entries</Button>
        </Card>
      </div>

      <TransactionSheet open={add !== null} kind={add ?? 'expense'} onClose={() => setAdd(null)} />
      <TransactionDetail t={selected} onClose={() => setSelected(null)} readOnly />
    </div>
  );
}
