import { motion } from 'framer-motion';
import { useId } from 'react';

/** Activity-style progress ring. Turns amber then red as the limit approaches. */
export function Ring({ ratio, size = 76, label }: { ratio: number; size?: number; label: string }) {
  const id = useId();
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, ratio));
  const colors = ratio >= 1 ? ['#ff6259', '#d1291f'] : ratio >= 0.8 ? ['#ffb340', '#e08a00'] : ['#34e3b0', '#0a8f86'];

  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={colors[0]} /><stop offset="100%" stopColor={colors[1]} /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sm-surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.15 }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[16px] font-bold tabular-nums">{Math.round(ratio * 100)}%</span>
    </div>
  );
}
