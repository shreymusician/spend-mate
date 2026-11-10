import { useId } from 'react';

export type PersonKind = 'dad' | 'mom' | 'son' | 'daughter';

const LOOK: Record<PersonKind, { bg: string; shirt: string; skin: string; hair: string }> = {
  dad: { bg: '#a7ecd6', shirt: '#0a7a8d', skin: '#e0a47a', hair: '#2b2118' },
  mom: { bg: '#ffdca6', shirt: '#e0707a', skin: '#d79c75', hair: '#3a2519' },
  son: { bg: '#bcd9ff', shirt: '#0fa37f', skin: '#efc09a', hair: '#3b2a1c' },
  daughter: { bg: '#ffc9da', shirt: '#8b5cf6', skin: '#e6b08a', hair: '#2b1d14' },
};

/** A friendly flat-illustration face in a circle. Purely decorative. */
export function Person({ kind, size = 64 }: { kind: PersonKind; size?: number }) {
  const id = useId();
  const c = LOOK[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs><clipPath id={`${id}-c`}><circle cx="32" cy="32" r="32" /></clipPath></defs>
      <g clipPath={`url(#${id}-c)`}>
        <rect width="64" height="64" fill={c.bg} />
        {/* long hair sits behind the head */}
        {kind === 'mom' && <path d="M19 31 C17 12 47 12 45 31 L47 49 C40 52 24 52 17 49Z" fill={c.hair} />}
        {kind === 'daughter' && (<><circle cx="18" cy="35" r="6" fill={c.hair} /><circle cx="46" cy="35" r="6" fill={c.hair} /></>)}
        {/* shoulders */}
        <path d="M8 66 C8 49 21 44 32 44 C43 44 56 49 56 66Z" fill={c.shirt} />
        <rect x="28" y="38" width="8" height="9" rx="3" fill={c.skin} />
        {/* head */}
        <circle cx="32" cy="31" r="12" fill={c.skin} />
        {/* hair on top */}
        {kind === 'dad' && <path d="M20 29 C19 17 45 17 44 29 C40 23 24 23 20 29Z" fill={c.hair} />}
        {kind === 'mom' && <path d="M20 30 C20 18 44 18 44 30 C38 24 26 24 20 30Z" fill={c.hair} />}
        {kind === 'son' && <path d="M20 29 C18 15 46 15 44 29 C39 22 31 25 27 21 C25 25 22 26 20 29Z" fill={c.hair} />}
        {kind === 'daughter' && <path d="M20 30 C19 16 45 16 44 30 C38 22 28 23 20 30Z" fill={c.hair} />}
        {/* face */}
        <circle cx="27.8" cy="32" r="1.4" fill="#2b2118" />
        <circle cx="36.2" cy="32" r="1.4" fill="#2b2118" />
        <path d="M28 36.2 Q32 39.6 36 36.2" stroke="#2b2118" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {kind === 'dad' && (<g stroke="#2b2118" strokeWidth="1.2" fill="none"><circle cx="27.8" cy="32" r="3.6" /><circle cx="36.2" cy="32" r="3.6" /><path d="M31.4 32 H32.6" /></g>)}
      </g>
    </svg>
  );
}
