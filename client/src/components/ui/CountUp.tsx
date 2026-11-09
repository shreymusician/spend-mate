import { animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { formatPaise } from '@/lib/utils';

/** Counts up to an amount. The accessible label is always the exact final figure. */
export function CountUp({ paise, className }: { paise: number; className?: string }) {
  const [shown, setShown] = useState(paise);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(paise); from.current = paise; return; }
    const controls = animate(from.current, paise, {
      duration: 0.9,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => { setShown(paise); from.current = paise; },
    });
    return () => controls.stop();
  }, [paise]);

  return <span className={className} aria-label={formatPaise(paise)}><span aria-hidden>{formatPaise(shown)}</span></span>;
}
