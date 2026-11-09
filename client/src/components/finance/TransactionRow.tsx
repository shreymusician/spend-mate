import { motion } from 'framer-motion';
import { Amount } from '@/components/ui/Amount';
import { useData } from '@/contexts/DataContext';
import { findCategory, iconFor, incomeIcon, SOURCE_LABEL } from '@/lib/categories';
import { dayLabel } from '@/lib/dates';
import type { Transaction } from '@/types';

/** iOS list row: icon tile, two lines, amount, and a hairline that starts after the icon. */
export function TransactionRow({ t, onClick, index = 0, by }: { t: Transaction; onClick?: () => void; index?: number; /** Whose entry this is (shown to a parent). */ by?: string }) {
  const { categories } = useData();
  const cat = findCategory(categories, t.category);
  const Icon = t.type === 'income' ? incomeIcon : iconFor(cat.icon);
  const color = t.type === 'income' ? '#30b05a' : cat.color;
  const sub = t.type === 'income' ? SOURCE_LABEL[t.source ?? 'other'] : cat.name;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.035, ease: [0.32, 0.72, 0, 1] }}
      whileTap={{ backgroundColor: 'var(--sm-surface-2)' }}
      className="relative flex min-h-[68px] w-full items-center gap-3 px-4 py-2 text-left after:absolute after:bottom-0 after:left-[68px] after:right-0 after:h-[0.5px] after:bg-line last:after:hidden"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" style={{ background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 70%, black))` }}>
        <Icon size={21} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-semibold tracking-[-0.015em]">{t.title}</span>
        <span className="block truncate text-[14px] text-muted">{by ? `${by} · ` : ''}{sub} · {dayLabel(t.occurredAt)}</span>
      </span>
      <Amount paise={t.amountPaise} kind={t.type} className="shrink-0 text-[17px] font-semibold" />
    </motion.button>
  );
}
