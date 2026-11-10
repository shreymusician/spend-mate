import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import { useEffect } from 'react';
import { Person, type PersonKind } from '@/components/landing/People';

// The scene is drawn on a 320 x 320 stage. Centres of the people and the mouth of the pot:
const STAGE = 320;
const POT = { x: 160, y: 120 };
const PEOPLE: { kind: PersonKind; name: string; x: number; y: number; amount: string; delay: number; bob: number }[] = [
  { kind: 'dad', name: 'Dad', x: 52, y: 50, amount: '+₹200', delay: 0, bob: 5.2 },
  { kind: 'mom', name: 'Mom', x: 268, y: 50, amount: '+₹150', delay: 1.2, bob: 6.1 },
  { kind: 'daughter', name: 'Meera', x: 268, y: 266, amount: '+₹60', delay: 2.4, bob: 5.6 },
  { kind: 'son', name: 'Aarav', x: 52, y: 266, amount: '+₹120', delay: 3.6, bob: 6.6 },
];
const LOOP = 14.4; // seconds for the pot to fill, celebrate, and start over
const TOTAL = 12480;

/** One piece of confetti that flies up and out of the pot when it is full. */
function Spark({ burst, dx, color }: { burst: MotionValue<number>; dx: number; color: string }) {
  const x = useTransform(burst, [0, 1], [0, dx * 1.2]);
  const y = useTransform(burst, [0, 1], [0, -30 - Math.abs(dx) * 0.4]);
  return <motion.span className="absolute block h-2.5 w-2.5 rounded-full" style={{ left: POT.x - 5, top: POT.y - 18, opacity: burst, background: color, x, y }} />;
}

/**
 * Four family members tossing savings into one shared pot. The pot fills with a wavy liquid, the total counts up,
 * and when it is full, sparkles burst and it starts again. It is an illustration of the idea, not real data.
 */
export function FamilyHero() {
  const reduced = useReducedMotion();
  const t = useMotionValue(reduced ? 0.7 : 0);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(t, 1, { duration: LOOP, ease: 'linear', repeat: Infinity });
    return () => controls.stop();
  }, [reduced, t]);

  // 0 → 0.85: filling; to 0.93: full and celebrating; then it empties and starts again.
  const level = useTransform(t, [0, 0.85, 0.93, 1], [86, 24, 24, 86]);
  const liquidTop = useMotionTemplate`${level}%`;
  const total = useTransform(t, [0, 0.85, 0.93, 1], [0, TOTAL, TOTAL, 0]);
  const totalText = useTransform(total, (v) => `₹${Math.round(v).toLocaleString('en-IN')}`);
  const burst = useTransform(t, [0.84, 0.88, 0.93], [0, 1, 0]);

  return (
    <div className="relative mx-auto" style={{ width: STAGE, height: STAGE }} aria-hidden>
      {/* slow orbit ring with little planets, to tie the four people together */}
      <div className="orbit absolute inset-[26px] rounded-full border border-dashed border-accent/30">
        {[0, 90, 180, 270].map((a) => (
          <span key={a} className="absolute left-1/2 top-1/2 block h-2 w-2 rounded-full bg-[#ffc46b]" style={{ transform: `rotate(${a}deg) translateY(-${(STAGE - 52) / 2}px) translate(-50%, -50%)` }} />
        ))}
      </div>

      {/* sparkle dust */}
      {[[40, 150, 0], [282, 150, 0.8], [160, 14, 1.4], [92, 306, 0.4], [226, 304, 1.1], [150, 300, 1.9]].map(([x, y, d], i) => (
        <span key={i} className="twinkle absolute block h-2 w-2 rotate-45 rounded-[2px] bg-[#34e3b0]" style={{ left: x, top: y, animationDelay: `${d}s` }} />
      ))}

      {/* the pot */}
      <motion.div
        className="absolute"
        style={{ left: POT.x - 62, top: POT.y - 28, width: 124, height: 168, transformOrigin: 'bottom center' }}
        animate={reduced ? undefined : { scale: [1, 1.05, 0.98, 1] }}
        transition={reduced ? undefined : { duration: 1.2, times: [0, 0.05, 0.15, 0.3], repeat: Infinity, delay: 0.4, repeatDelay: 0 }}
      >
        <div className="absolute inset-x-5 top-0 h-3.5 rounded-full bg-fg/15 ring-1 ring-fg/10" />
        <div className="absolute inset-x-0 top-3 bottom-0 overflow-hidden rounded-b-[46px] rounded-t-[18px] border-2 border-white/70 bg-white/35 shadow-[0_24px_50px_-18px_rgba(10,122,141,0.6)] backdrop-blur-md dark:border-white/20 dark:bg-white/10">
          <motion.div className="absolute inset-x-0 bottom-0" style={{ top: liquidTop }}>
            <div className="absolute -top-[14px] left-0 h-[18px] w-[200%] opacity-60"><svg className="wave-x-slow h-full w-full" viewBox="0 0 240 20" preserveAspectRatio="none"><path d="M0 10 Q30 0 60 10 T120 10 T180 10 T240 10 V20 H0Z" fill="#34e3b0" /></svg></div>
            <div className="absolute -top-[10px] left-0 h-[16px] w-[200%]"><svg className="wave-x h-full w-full" viewBox="0 0 240 20" preserveAspectRatio="none"><path d="M0 10 Q30 0 60 10 T120 10 T180 10 T240 10 V20 H0Z" fill="#0fa37f" /></svg></div>
            <div className="absolute inset-x-0 bottom-0 top-[5px] brand-gradient" />
            {/* bubbles rising in the liquid */}
            {[22, 56, 88].map((x, i) => (
              <span key={x} className="twinkle absolute bottom-3 block h-2 w-2 rounded-full bg-white/60" style={{ left: x, animationDelay: `${i * 0.7}s` }} />
            ))}
          </motion.div>
          {/* glass highlight */}
          <div className="absolute bottom-6 left-2.5 top-5 w-2 rounded-full bg-white/50 blur-[1px]" />
        </div>
        <p className="font-hand absolute -bottom-7 inset-x-0 text-center text-[22px] font-semibold text-accent">our family pot</p>
      </motion.div>

      {/* running total */}
      <div className="absolute left-1/2 top-[8px] -translate-x-1/2 text-center">
        <div className="whitespace-nowrap rounded-full bg-fg px-3.5 py-1 text-[17px] font-extrabold tabular-nums text-bg shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)]">
          <motion.span>{totalText}</motion.span>
        </div>
        <p className="font-hand mt-0.5 whitespace-nowrap text-[21px] font-semibold leading-none text-muted">saved together</p>
      </div>

      {/* celebration when the pot is full */}
      {!reduced && [-70, -40, 0, 40, 70].map((dx, i) => (
        <Spark key={dx} burst={burst} dx={dx} color={['#ffc46b', '#34e3b0', '#ffffff', '#ffc46b', '#34e3b0'][i]!} />
      ))}

      {/* the four people, each tossing a coin into the pot every few seconds */}
      {PEOPLE.map((p) => {
        const dx = POT.x - p.x;
        const dy = POT.y - p.y;
        return (
          <div key={p.name}>
            <motion.div
              className="absolute grid place-items-center"
              style={{ left: p.x - 32, top: p.y - 32 }}
              animate={reduced ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: p.bob, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="block overflow-hidden rounded-full shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] ring-[3px] ring-white dark:ring-white/80"><Person kind={p.kind} size={64} /></span>
              <span className="font-hand absolute -bottom-6 whitespace-nowrap text-[20px] font-semibold text-fg">{p.name}</span>
            </motion.div>

            {!reduced && (
              <motion.span
                className="absolute grid h-[26px] place-items-center rounded-full px-2.5 text-[12px] font-bold text-[#5a3a00] shadow-[0_6px_14px_-4px_rgba(255,160,0,0.7)]"
                style={{ left: p.x - 28, top: p.y - 13, minWidth: 56, background: 'linear-gradient(140deg,#ffe29a,#ffc46b)' }}
                initial={{ opacity: 0 }}
                animate={{ x: [0, dx * 0.5, dx], y: [0, dy * 0.5 - 52, dy], scale: [0.5, 1.1, 0.55], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, delay: p.delay, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut', times: [0, 0.5, 1] }}
              >
                {p.amount}
              </motion.span>
            )}
          </div>
        );
      })}
    </div>
  );
}
