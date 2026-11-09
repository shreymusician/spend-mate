import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  /** Shown under the dots; the dots shake when it appears. */
  error?: string;
  disabled?: boolean;
  /** Describes what is being entered, for screen readers. */
  label: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** iOS passcode-style entry: dots fill as you type; works with taps or a hardware keyboard. */
export function PinPad({ value, onChange, length = 4, error, disabled, label }: Props) {
  const press = (d: string) => { if (!disabled && value.length < length) onChange(value + d); };
  const back = () => { if (!disabled) onChange(value.slice(0, -1)); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const keyClass =
    'grid h-[74px] w-[74px] place-items-center rounded-full bg-surface text-[30px] font-light shadow-[var(--sm-shadow)] select-none dark:bg-surface-2 [@media(max-height:720px)]:h-[62px] [@media(max-height:720px)]:w-[62px] [@media(max-height:720px)]:text-[26px]';

  return (
    <div className="flex flex-col items-center">
      <div role="group" aria-label={label} className={cn('mb-3 flex h-6 items-center gap-5', error && 'shake')} key={error ?? 'ok'}>
        {Array.from({ length }, (_, i) => {
          const filled = i < value.length;
          return (
            <motion.span
              key={i}
              aria-hidden
              animate={{ scale: filled ? 1 : 0.85 }}
              transition={{ type: 'spring', stiffness: 600, damping: 18 }}
              className={cn('h-4 w-4 rounded-full border-2', filled ? (error ? 'border-neg bg-neg' : 'brand-gradient border-transparent') : 'border-muted/60')}
            />
          );
        })}
      </div>
      <p role="status" className="mb-4 min-h-[22px] px-4 text-center text-[15px] font-medium text-neg">{error}</p>
      <span className="sr-only">{value.length} of {length} digits entered</span>

      <div className="grid grid-cols-3 gap-x-6 gap-y-4 [@media(max-height:720px)]:gap-y-3">
        {KEYS.map((k) => (
          <motion.button key={k} type="button" className={keyClass} whileTap={{ scale: 0.88 }} transition={{ type: 'spring', stiffness: 600, damping: 26 }} onClick={() => press(k)} disabled={disabled} aria-label={k}>
            {k}
          </motion.button>
        ))}
        <span aria-hidden />
        <motion.button type="button" className={keyClass} whileTap={{ scale: 0.88 }} transition={{ type: 'spring', stiffness: 600, damping: 26 }} onClick={() => press('0')} disabled={disabled} aria-label="0">
          0
        </motion.button>
        <motion.button type="button" className="grid h-[74px] w-[74px] place-items-center rounded-full text-muted [@media(max-height:720px)]:h-[62px] [@media(max-height:720px)]:w-[62px]" whileTap={{ scale: 0.88 }} onClick={back} disabled={disabled || value.length === 0} aria-label="Delete last digit">
          <Delete size={28} aria-hidden />
        </motion.button>
      </div>
    </div>
  );
}
