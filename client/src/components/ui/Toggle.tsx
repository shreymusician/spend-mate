/** A bare iOS-style switch (no card around it), for use inside list rows. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-[31px] w-[51px] rounded-full bg-[#78788033] transition-colors duration-300 peer-checked:bg-[#34c759] peer-disabled:opacity-50 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent after:absolute after:left-[2px] after:top-[2px] after:h-[27px] after:w-[27px] after:rounded-full after:bg-white after:shadow-[0_3px_8px_rgba(0,0,0,0.25)] after:transition-transform after:duration-300 after:ease-[var(--ease-ios)] peer-checked:after:translate-x-5"
      />
    </label>
  );
}
