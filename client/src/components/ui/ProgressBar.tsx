import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ProgressBar({ ratio, label }: { ratio: number; label: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
      <motion.div
        className={cn('h-full rounded-full', ratio >= 1 ? 'bg-neg' : ratio >= 0.8 ? 'bg-warn' : 'brand-gradient')}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
    </div>
  );
}
