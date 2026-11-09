import type { ReactNode } from 'react';

/** iOS "large title". */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <header className="mb-4 pt-1">
      <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.03em]">{children}</h1>
      {sub && <p className="mt-1 text-[16px] text-muted">{sub}</p>}
    </header>
  );
}
