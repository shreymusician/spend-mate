import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransactionDetail } from '@/components/finance/TransactionDetail';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { TransactionSheet } from '@/components/finance/TransactionSheet';
import { Amount } from '@/components/ui/Amount';
import { Button } from '@/components/ui/Button';
import { HomeHeader } from '@/components/ui/HomeHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { CountUp } from '@/components/ui/CountUp';
import { Ring } from '@/components/ui/Ring';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/contexts/DataContext';
import { useFetch } from '@/hooks';
import { currentMonth } from '@/lib/dates';
import { budgetLine } from '@/lib/insights';
import { formatPaise } from '@/lib/utils';
import type { Summary, Transaction } from '@/types';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26 };

/** Home is the same for everyone: your own money. Anything to do with family lives in the Family tab. */
export function HomePage() {
  const { version } = useData();
  const nav = useNavigate();
  const summary = useFetch<Summary>(`/analytics/summary?month=${currentMonth()}`, [version]);
  const recent = useFetch<{ transactions: Transaction[] }>('/transactions?limit=5', [version]);
  const [add, setAdd] = useState<'expense' | 'income' | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const s = summary.data;
  const overall = s?.budgets.find((b) => b.category === null);

  return (
    <div className="space-y-5">
      <HomeHeader />

      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring}
        aria-label="Balance"
        className="brand-gradient grain sheen relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_26px_44px_-22px_rgba(10,150,120,0.85)]"
      >
        <span aria-hidden className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/20 blur-2xl" />
        <span aria-hidden className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-[#0a5f7a]/40 blur-2xl" />
        <div className="relative">
          <p className="text-[15px] font-semibold text-white/85">Money you have</p>
          {s ? <CountUp paise={s.balancePaise} className="block text-[46px] font-bold leading-[1.1] tracking-[-0.035em] tabular-nums" /> : <Skeleton className="mt-2 h-11 w-44 bg-white/25" />}
          <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-white/75">This month</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-[16px] bg-white/18 p-3 backdrop-blur-md">
              <p className="flex items-center gap-1 text-[13px] font-medium text-white/85"><ArrowDownLeft size={15} aria-hidden />Received</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums">{s ? formatPaise(s.incomePaise) : '…'}</p>
            </div>
            <div className="rounded-[16px] bg-white/18 p-3 backdrop-blur-md">
              <p className="flex items-center gap-1 text-[13px] font-medium text-white/85"><ArrowUpRight size={15} aria-hidden />Spent</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums">{s ? formatPaise(s.expensePaise) : '…'}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3">
        {([['expense', 'Add spending', ArrowUpRight, '#ff6259'], ['income', 'Add money', ArrowDownLeft, '#30b05a']] as const).map(([kind, label, Icon, c], i) => (
          <motion.button
            key={kind}
            type="button"
            onClick={() => setAdd(kind)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 + i * 0.06 }}
            whileTap={{ scale: 0.96 }}
            className="flex flex-col items-start gap-3 rounded-[22px] bg-surface p-4 text-left shadow-[var(--sm-shadow)]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[13px] text-white" style={{ background: `linear-gradient(145deg, ${c}, color-mix(in srgb, ${c} 70%, black))` }}><Icon size={22} aria-hidden /></span>
            <span className="text-[17px] font-semibold tracking-[-0.015em]">{label}</span>
          </motion.button>
        ))}
      </div>

      {summary.error && <p role="alert" className="font-medium text-neg">{summary.error}</p>}

      {overall && (
        <Card className="flex items-center gap-4">
          <Ring ratio={overall.spentPaise / overall.limitPaise} label="Budget used" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">This month’s budget</p>
            <p className="text-[17px] font-semibold"><Amount paise={overall.spentPaise} /> <span className="font-normal text-muted">of</span> <Amount paise={overall.limitPaise} /></p>
            <p className="text-[14px] text-muted">{budgetLine(overall.spentPaise, overall.limitPaise)}</p>
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-end justify-between">
          <CardTitle>Recent</CardTitle>
          <Button variant="link" onClick={() => nav('/history')} className="-mt-1 mb-1 min-h-0">See all</Button>
        </div>
        <Card className="overflow-hidden p-0">
          {recent.data && recent.data.transactions.length === 0 && <p className="px-4 py-8 text-center text-muted">Nothing yet. Tap “Add spending” to start.</p>}
          {!recent.data && <div className="space-y-3 p-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>}
          {recent.data?.transactions.map((t, i) => <TransactionRow key={t.id} t={t} index={i} onClick={() => setSelected(t)} />)}
        </Card>
      </div>

      <TransactionSheet open={add !== null} kind={add ?? 'expense'} onClose={() => setAdd(null)} />
      <TransactionDetail t={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
