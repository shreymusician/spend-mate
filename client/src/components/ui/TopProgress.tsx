import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useIsLoading } from '@/lib/loading';

/**
 * A thin shimmering bar along the top edge while data loads, like on iOS. It waits a moment before appearing,
 * so quick loads don't flicker, and it stays a moment after, so it never feels cut off.
 */
export function TopProgress() {
  const busy = useIsLoading();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (busy) { const t = setTimeout(() => setShow(true), 150); return () => clearTimeout(t); }
    const t = setTimeout(() => setShow(false), 250);
    return () => clearTimeout(t);
  }, [busy]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[3px] overflow-hidden bg-accent/10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div className="h-full w-2/5 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #34e3b0, #0fa37f, #ffc46b, transparent)' }}
            animate={{ x: ['-100%', '260%'] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
