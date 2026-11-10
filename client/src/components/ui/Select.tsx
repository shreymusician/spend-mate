import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface Option { value: string; label: string }

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  /** Shown (greyed) while nothing is chosen yet. */
  placeholder?: string;
  className?: string;
}

/**
 * Our own drop-down, not the phone's built-in one: a rounded list that slides up from the bottom with a tick
 * on the chosen row. Tap outside, press Esc, or pick a row to close it.
 */
export function Select({ label, value, onChange, options, placeholder, className }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    // Capture phase + stopPropagation so Esc closes only this list, not the sheet behind it.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    // Bring the chosen row into view in long lists.
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <div>
      <span id={`${id}-l`} className="mb-1.5 block px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-l ${id}-v`}
        onClick={() => setOpen(true)}
        className={cn('relative flex h-[54px] w-full items-center rounded-[16px] bg-surface px-4 pr-10 text-left text-[17px] text-fg shadow-[var(--sm-shadow)] outline-none ring-2 ring-transparent transition-[transform,box-shadow] active:scale-[0.99] focus-visible:ring-accent/60 dark:bg-surface-2', className)}
      >
        <span id={`${id}-v`} className={cn('truncate', !current && 'text-muted')}>{current?.label ?? placeholder ?? ''}</span>
        <ChevronsUpDown size={18} aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-[90] flex items-end justify-center">
              <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setOpen(false)} />
              <motion.div
                className="relative w-full max-w-[430px] px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              >
                <div className="overflow-hidden rounded-[22px] bg-surface shadow-[0_10px_40px_rgba(0,0,0,0.3)] dark:bg-surface-2">
                  <p className="border-b border-line px-5 py-3 text-center text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{label}</p>
                  <div ref={listRef} role="listbox" aria-label={label} className="max-h-[52dvh] overflow-y-auto overscroll-contain">
                    {options.map((o) => {
                      const selected = o.value === value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => { onChange(o.value); setOpen(false); }}
                          className={cn('flex min-h-[54px] w-full items-center justify-between gap-3 border-b border-line px-5 text-left text-[18px] last:border-0 active:bg-fg/5', selected && 'font-semibold text-accent')}
                        >
                          <span>{o.label}</span>
                          {selected && <Check size={20} strokeWidth={2.8} aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="mt-2 h-[54px] w-full rounded-[18px] bg-surface text-[18px] font-semibold text-accent shadow-[0_10px_40px_rgba(0,0,0,0.2)] active:opacity-80 dark:bg-surface-2">
                  Cancel
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
