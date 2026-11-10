import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const MESSAGES = [
  'Counting your rupees…',
  'Adding it all up…',
  'Sorting the receipts…',
  'Tidying your totals…',
  'Almost there…',
];

// Heights the five bars swing between, a little out of step so it feels like a live chart.
const BARS = [
  [0.35, 0.9, 0.5],
  [0.6, 0.35, 1],
  [0.45, 1, 0.4],
  [0.8, 0.45, 0.9],
  [0.4, 0.75, 0.55],
];

interface Props {
  /** "page" fills the area it is in; "inline" is a compact version for a card or a screen. */
  size?: 'page' | 'inline';
  /** Shown if loading drags on, such as a sleeping server on the first visit. */
  slowHint?: string;
  slowAfterMs?: number;
  className?: string;
}

/** A bar chart that keeps building itself in the brand colours, with a friendly line that changes as you wait. */
export function BrandLoader({ size = 'page', slowHint, slowAfterMs = 6000, className }: Props) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [slow, setSlow] = useState(false);
  const big = size === 'page';

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 1800);
    const s = slowHint ? setTimeout(() => setSlow(true), slowAfterMs) : undefined;
    return () => { clearInterval(t); if (s) clearTimeout(s); };
  }, [slowHint, slowAfterMs]);

  const barW = big ? 14 : 9;
  const maxH = big ? 64 : 38;

  return (
    <div role="status" aria-live="polite" aria-label="Loading" className={cn('flex flex-col items-center justify-center text-center', big ? 'min-h-[60dvh] gap-6' : 'gap-4 py-10', className)}>
      <div aria-hidden className="relative flex items-end" style={{ gap: big ? 8 : 6, height: maxH }}>
        {BARS.map((heights, n) => (
          <motion.span
            key={n}
            className="brand-gradient block origin-bottom rounded-full shadow-[0_6px_14px_-6px_rgba(10,150,120,0.8)]"
            style={{ width: barW, height: maxH }}
            initial={{ scaleY: 0.3 }}
            animate={reduced ? { opacity: [0.5, 1, 0.5], scaleY: 0.7 } : { scaleY: heights }}
            transition={{ duration: 1.4 + n * 0.12, delay: n * 0.1, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
        ))}
        {/* An amber dot rides along the top like the chart's "today" marker. */}
        {!reduced && (
          <motion.span className="absolute -top-2 left-0 block rounded-full bg-[#ffc46b]" style={{ width: big ? 9 : 6, height: big ? 9 : 6 }}
            animate={{ x: [0, (barW + (big ? 8 : 6)) * 4, 0], y: [0, -4, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }} />
        )}
      </div>

      <div className="relative h-6 w-64">
        <AnimatePresence mode="wait">
          <motion.p key={i} className={cn('absolute inset-x-0 font-medium text-muted', big ? 'text-[17px]' : 'text-[15px]')}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {MESSAGES[i]}
          </motion.p>
        </AnimatePresence>
      </div>

      {slow && slowHint && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[280px] rounded-2xl bg-surface-2 px-4 py-3 text-[14px] leading-snug text-muted">
          {slowHint}
        </motion.p>
      )}
    </div>
  );
}
