import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div {...p} className={cn('rounded-[22px] bg-surface p-4 shadow-[var(--sm-shadow)]', className)} />
);

/** Small grey caption above a card's content (iOS section header). */
export const CardTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{children}</h2>
);
