import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label: string;
  error?: string;
  hint?: string;
  /** Fixed text shown inside the field before the value, like a country code. */
  prefix?: ReactNode;
}

export function Field({ label, error, hint, prefix, className, ...p }: Props) {
  const id = useId();
  // Re-trigger the shake every time a new error message appears.
  const [shakeKey, setShakeKey] = useState(0);
  useEffect(() => { if (error) setShakeKey((k) => k + 1); }, [error]);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{label}</label>
      <div
        key={shakeKey}
        className={cn(
          'flex h-[54px] items-center gap-2 rounded-[16px] bg-surface px-4 shadow-[var(--sm-shadow)] ring-2 ring-transparent transition-shadow focus-within:ring-accent/60 dark:bg-surface-2',
          error && 'shake ring-neg/70',
        )}
      >
        {prefix && <span className="text-[17px] font-medium text-muted">{prefix}</span>}
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          {...p}
          className={cn('h-full min-w-0 flex-1 bg-transparent text-[17px] text-fg outline-none placeholder:text-muted/60', className)}
        />
      </div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 px-1 text-[13px] text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1.5 px-1 text-[14px] font-medium text-neg">{error}</p>}
    </div>
  );
}
