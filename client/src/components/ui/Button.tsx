import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'link';

const styles: Record<Variant, string> = {
  primary: 'brand-gradient text-white shadow-[0_6px_18px_-6px_rgba(10,150,120,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]',
  secondary: 'bg-surface text-accent shadow-[var(--sm-shadow)] dark:bg-surface-2',
  danger: 'bg-surface text-neg shadow-[var(--sm-shadow)] dark:bg-surface-2',
  link: 'h-auto min-h-11 bg-transparent px-1 text-accent',
};

interface Props extends HTMLMotionProps<'button'> {
  variant?: Variant;
  block?: boolean;
}

/** Tapping squeezes the button slightly, like a native iOS control. */
export const Button = forwardRef<HTMLButtonElement, Props>(({ variant = 'primary', block, className, ...p }, ref) => (
  <motion.button
    ref={ref}
    whileTap={{ scale: variant === 'link' ? 0.97 : 0.96, opacity: 0.88 }}
    transition={{ type: 'spring', stiffness: 520, damping: 30 }}
    {...p}
    className={cn(
      'inline-flex h-[52px] items-center justify-center gap-2 rounded-[16px] px-5 text-[17px] font-semibold tracking-[-0.011em] disabled:pointer-events-none disabled:opacity-45',
      styles[variant],
      block && 'w-full',
      className,
    )}
  />
));
Button.displayName = 'Button';
