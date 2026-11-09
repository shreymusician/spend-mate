import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/utils';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}

/** iOS segmented control: the white thumb glides between options. */
export function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[12px] bg-surface-2 p-[3px] dark:bg-[#2c2c2e]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn('relative h-10 flex-1 rounded-[10px] text-[15px] font-semibold transition-colors', active ? 'text-fg' : 'text-muted')}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[10px] bg-surface shadow-[0_2px_6px_rgba(0,0,0,0.12)] dark:bg-[#636366]"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
