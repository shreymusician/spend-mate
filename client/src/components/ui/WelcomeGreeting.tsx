import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import type { Greeting } from '@/contexts/AuthContext';
import type { User } from '@/types';

const SHOW_MS = 3400;
const SHOW_MS_REDUCED = 1600;

const LINES = [
  'Let’s see where your money went.',
  'Every rupee, with a reason.',
  'A little tracking goes a long way.',
  'Small notes today, clear answers later.',
  'Your money, made clear.',
];

const COLORS = ['#34e3b0', '#ffffff', '#ffc46b', '#7df0d0', '#b8fff0'];

function timeGreeting(now = new Date()) {
  const h = now.getHours();
  return h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Hello';
}

/** Confetti-like pieces that burst from behind the photo. Fixed numbers, so it looks the same each time. */
const PIECES = Array.from({ length: 26 }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180;
  const dist = 120 + ((i * 53) % 150);
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist * 0.9,
    size: 6 + ((i * 5) % 9),
    color: COLORS[i % COLORS.length]!,
    shape: i % 3, // 0 dot, 1 pill, 2 star
    spin: ((i * 97) % 360) - 180,
    delay: 0.28 + (i % 6) * 0.03,
  };
});

function Piece({ p }: { p: (typeof PIECES)[number] }) {
  const base = { width: p.size, height: p.shape === 1 ? p.size * 2.4 : p.size, background: p.color };
  return (
    <motion.span
      aria-hidden
      className="absolute left-1/2 top-1/2"
      style={{ ...base, marginLeft: -p.size / 2, marginTop: -p.size / 2, borderRadius: p.shape === 2 ? 2 : 9999, clipPath: p.shape === 2 ? 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)' : undefined }}
      initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
      animate={{ x: p.x, y: p.y + 40, scale: [0, 1.2, 1, 0.8], opacity: [0, 1, 1, 0], rotate: p.spin }}
      transition={{ duration: 2.3, delay: p.delay, ease: [0.16, 0.84, 0.3, 1] }}
    />
  );
}

/**
 * Full-screen hello that plays each time someone signs in or reopens the app on a remembered device.
 * Tap anywhere to skip. With "reduce motion" turned on it is a quiet fade instead.
 */
export function WelcomeGreeting({ user, kind, onDone }: { user: User; kind: Exclude<Greeting, null>; onDone: () => void }) {
  const reduced = useReducedMotion();
  const first = user.name.trim().split(/\s+/)[0] ?? user.name;
  const hello = kind === 'welcome' ? 'Welcome to SpendMate' : timeGreeting();
  const line = useMemo(() => (kind === 'welcome' ? 'Your account is ready. Let’s begin.' : LINES[Math.floor(Date.now() / 86_400_000) % LINES.length]!), [kind]);

  useEffect(() => {
    const t = window.setTimeout(onDone, reduced ? SHOW_MS_REDUCED : SHOW_MS);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onDone(); };
    window.addEventListener('keydown', key);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', key); };
  }, [onDone, reduced]);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${hello}, ${first}. Tap to continue.`}
      onClick={onDone}
      className="greet-bg fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden px-6 text-center text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.08 }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
    >
      {!reduced && (
        <>
          <motion.div aria-hidden className="absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full bg-[#34e3b0] opacity-40 blur-[80px]" animate={{ x: [0, 50, 0], y: [0, 40, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div aria-hidden className="absolute -bottom-28 -right-20 h-[380px] w-[380px] rounded-full bg-[#0a7a8d] opacity-60 blur-[90px]" animate={{ x: [0, -40, 0], y: [0, -50, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div aria-hidden className="absolute right-[-60px] top-[22%] h-[220px] w-[220px] rounded-full bg-[#ffc46b] opacity-30 blur-[70px]" animate={{ x: [0, -30, 0], y: [0, 30, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
        </>
      )}
      <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative grid h-[200px] w-[200px] place-items-center">
        {!reduced && [0, 1, 2].map((i) => (
          <motion.span key={i} aria-hidden className="absolute rounded-full border-2 border-white/60"
            style={{ width: 132, height: 132 }}
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [0.8, 2.2], opacity: [0.7, 0] }}
            transition={{ duration: 1.8, delay: 0.35 + i * 0.35, repeat: 1, ease: 'easeOut' }} />
        ))}
        {!reduced && PIECES.map((p, i) => <Piece key={i} p={p} />)}
        <motion.div
          className="relative rounded-full p-1.5 shadow-[0_18px_50px_-10px_rgba(0,0,0,0.45)]"
          style={{ background: 'linear-gradient(140deg,#ffffff,#b8fff0 60%,#ffc46b)' }}
          initial={reduced ? { opacity: 0 } : { scale: 0.3, rotate: -14, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 15, delay: 0.1 }}
        >
          <div className="rounded-full border-4 border-white/80 bg-white/20">
            <Avatar name={user.name} src={user.avatarUrl} size={128} />
          </div>
        </motion.div>
      </div>

      <motion.p className="mt-6 text-[19px] font-semibold tracking-[0.01em] text-white/85"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : 0.45, duration: 0.5 }}>
        {hello}
      </motion.p>

      <h1 aria-hidden className="mt-1 flex max-w-full flex-wrap justify-center overflow-hidden text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em]">
        {[...first].map((ch, i) => (
          <motion.span key={i} className="inline-block"
            initial={reduced ? { opacity: 0 } : { y: 46, opacity: 0, rotate: 6 }} animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: reduced ? 0 : 0.6 + i * 0.05 }}>
            {ch}
          </motion.span>
        ))}
      </h1>

      <motion.p className="mt-3 max-w-[300px] text-[18px] leading-snug text-white/80"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : 1.2, duration: 0.6 }}>
        {line}
      </motion.p>

      <div className="absolute inset-x-0 bottom-[max(28px,env(safe-area-inset-bottom))] flex flex-col items-center gap-3">
        <span className="text-[14px] font-medium text-white/65">Tap to continue</span>
        <span className="h-[3px] w-28 overflow-hidden rounded-full bg-white/25">
          <motion.span className="block h-full origin-left rounded-full bg-white" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: (reduced ? SHOW_MS_REDUCED : SHOW_MS) / 1000, ease: 'linear' }} />
        </span>
      </div>
    </motion.div>
  );
}
