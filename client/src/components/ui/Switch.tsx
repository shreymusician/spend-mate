import { useId, type ReactNode } from 'react';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: ReactNode;
}

/** iOS toggle (51×31) inside a grouped row: a real checkbox with role="switch" and a text label. */
export function Switch({ checked, onChange, label, hint }: Props) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-[16px] bg-surface p-4 shadow-[var(--sm-shadow)] dark:bg-surface-2">
      <span>
        <span className="block text-[17px] font-medium">{label}</span>
        {hint && <span className="block text-[14px] text-muted">{hint}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-[31px] w-[51px] shrink-0 rounded-full bg-[#78788033] transition-colors duration-300 peer-checked:bg-[#34c759] peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent after:absolute after:left-[2px] after:top-[2px] after:h-[27px] after:w-[27px] after:rounded-full after:bg-white after:shadow-[0_3px_8px_rgba(0,0,0,0.25)] after:transition-transform after:duration-300 after:ease-[var(--ease-ios)] peer-checked:after:translate-x-5"
      />
    </label>
  );
}
