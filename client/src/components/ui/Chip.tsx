import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export const Chip = ({ active, className, ...p }: HTMLMotionProps<'button'> & { active?: boolean }) => (
  <motion.button
    type="button"
    aria-pressed={active}
    whileTap={{ scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 520, damping: 30 }}
    {...p}
    className={cn(
      'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition-colors',
      active ? 'brand-gradient text-white shadow-[0_4px_12px_-4px_rgba(10,150,120,0.6)]' : 'bg-surface text-fg shadow-[var(--sm-shadow)] dark:bg-surface-2',
      className,
    )}
  />
);
