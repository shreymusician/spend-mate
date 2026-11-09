import { cn, formatPaise } from '@/lib/utils';

/** Money is always shown plainly, coloured only to help: green = received, red = spent. */
export function Amount({ paise, kind, className }: { paise: number; kind?: 'income' | 'expense'; className?: string }) {
  const text = kind === 'income' ? `+${formatPaise(paise)}` : kind === 'expense' ? `−${formatPaise(paise)}` : formatPaise(paise);
  return <span className={cn('tabular-nums', kind === 'income' && 'text-pos', kind === 'expense' && 'text-neg', className)}>{text}</span>;
}
