import { useId, type TextareaHTMLAttributes } from 'react';

export function TextArea({ label, hint, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{label}</label>
      <textarea
        id={id}
        rows={2}
        {...p}
        className="w-full resize-none rounded-[16px] bg-surface px-4 py-3.5 text-[17px] text-fg shadow-[var(--sm-shadow)] outline-none ring-2 ring-transparent placeholder:text-muted/60 focus:ring-accent/60 dark:bg-surface-2"
      />
      {hint && <p className="mt-1.5 px-1 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}
