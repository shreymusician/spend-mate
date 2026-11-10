import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Heart, Utensils } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Person } from '@/components/landing/People';
import { cn } from '@/lib/utils';

const STEP_MS = 2300;

const CAPTIONS = [
  { title: 'Aarav notes it', text: 'The amount, what it was for, and why. Takes a few seconds.' },
  { title: 'Dad sees it at once', text: 'Only the entries Aarav chooses to share, and they appear live.' },
  { title: 'Dad replies', text: 'A comment, not a lecture. Parents can view and cheer, never edit.' },
];
/** Which caption each moment of the animation belongs to. */
const CAPTION_FOR_STEP = [0, 0, 1, 2];

function Phone({ who, children, className }: { who: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative w-[148px] shrink-0', className)}>
      <p className="font-hand mb-1 text-center text-[21px] font-semibold leading-none text-accent">{who}</p>
      <div className="relative h-[262px] overflow-hidden rounded-[26px] border-[5px] border-fg/90 bg-bg shadow-[0_28px_50px_-22px_rgba(0,0,0,0.55)] dark:border-white/25">
        <div className="absolute left-1/2 top-1.5 z-10 h-[7px] w-12 -translate-x-1/2 rounded-full bg-fg/90 dark:bg-white/25" />
        <div className="h-full px-2.5 pt-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * The whole idea in one loop: a student writes down a spend on the left; on the right the parent's phone shows it
 * the moment it is shared, and the parent replies. It loops quietly. Decorative: the captions below say the same in words.
 */
export function PhoneStory() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(reduced ? 3 : 0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setStep((s) => (s + 1) % 4), STEP_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const saved = step >= 1;
  const active = CAPTION_FOR_STEP[step]!;

  return (
    <div>
      <div className="relative flex items-start justify-center gap-3" aria-hidden>
        {/* a glowing dot carries the entry from one phone to the other */}
        <AnimatePresence>
          {step === 1 && !reduced && (
            <motion.span key="orb" className="absolute top-[130px] z-20 block h-4 w-4 rounded-full bg-[#ffc46b] shadow-[0_0_0_6px_rgba(255,196,107,0.35),0_0_24px_6px_rgba(255,196,107,0.6)]"
              initial={{ left: '26%', opacity: 0, scale: 0.4 }} animate={{ left: '70%', opacity: [0, 1, 1, 0], scale: 1 }} transition={{ duration: 1, ease: 'easeInOut' }} />
          )}
        </AnimatePresence>

        {/* Aarav's phone */}
        <Phone who="Aarav's phone">
          <p className="text-[12px] font-extrabold tracking-tight">Add spending</p>
          <p className="mt-2 text-[7.5px] font-bold uppercase tracking-wider text-muted">Amount</p>
          <div className="mt-0.5 rounded-lg bg-surface px-2 py-1.5 text-[17px] font-bold tabular-nums shadow-[var(--sm-shadow)] dark:bg-surface-2">
            ₹120<span className={cn('ml-0.5 inline-block h-[15px] w-[2px] translate-y-[2px] bg-accent', !saved && 'blink')} />
          </div>
          <p className="mt-2 text-[7.5px] font-bold uppercase tracking-wider text-muted">Category</p>
          <div className="mt-1 flex gap-1">
            <span className="brand-gradient inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold text-white"><Utensils size={8} />Food</span>
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[8.5px] font-semibold dark:bg-surface-2">Travel</span>
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[8.5px] font-semibold dark:bg-surface-2">Study</span>
          </div>
          <p className="mt-2 text-[7.5px] font-bold uppercase tracking-wider text-muted">What was it for</p>
          <div className="mt-0.5 rounded-lg bg-surface px-2 py-1.5 text-[10px] font-semibold dark:bg-surface-2">Lunch with friends</div>
          <motion.div
            className={cn('mt-3 grid h-8 place-items-center rounded-xl text-[11px] font-extrabold text-white', saved ? 'bg-[#1f8a3b]' : 'brand-gradient')}
            animate={{ scale: step === 1 ? [1, 0.92, 1] : 1 }} transition={{ duration: 0.35 }}
          >
            {saved ? <span className="inline-flex items-center gap-1"><Check size={13} strokeWidth={3} />Saved</span> : 'Save'}
          </motion.div>
        </Phone>

        {/* Dad's phone */}
        <Phone who="Dad's phone">
          <div className="flex items-center gap-1.5">
            <span className="block overflow-hidden rounded-full"><Person kind="son" size={20} /></span>
            <div className="leading-tight"><p className="text-[10px] font-extrabold">Aarav</p><p className="text-[7px] font-semibold text-muted">View only</p></div>
          </div>
          <div className="mt-2 rounded-xl bg-surface p-2 shadow-[var(--sm-shadow)] dark:bg-surface-2">
            <p className="text-[7px] font-bold uppercase tracking-wider text-muted">Spent this month</p>
            <AnimatePresence mode="wait">
              <motion.p key={saved ? 'b' : 'a'} className="text-[16px] font-extrabold tabular-nums" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                {saved ? '₹3,134' : '₹3,014'}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="mt-2 text-[7.5px] font-bold uppercase tracking-wider text-muted">Latest</p>
          <div className="mt-1 space-y-1">
            <AnimatePresence initial={false}>
              {saved && (
                <motion.div key="new" layout initial={{ opacity: 0, y: -16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="rounded-lg bg-[#34e3b0]/25 px-1.5 py-1 ring-1 ring-[#0fa37f]/50">
                  <div className="flex items-center justify-between text-[9px] font-bold"><span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-[#0fa37f]" />Lunch</span><span className="text-neg">−₹120</span></div>
                  <p className="text-[7px] font-semibold text-muted">Food · just now</p>
                  <AnimatePresence>
                    {step >= 3 && (
                      <motion.div key="c" initial={{ opacity: 0, scale: 0.6, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                        className="mt-1 flex items-center gap-1 rounded-md bg-surface px-1.5 py-1 text-[8px] font-bold shadow-sm dark:bg-surface-2">
                        <Heart size={9} className="fill-[#ff6259] text-[#ff6259]" />Good choice!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
            {[['Metro card', '−₹500'], ['Physics book', '−₹625']].map(([n, a]) => (
              <div key={n} className="flex items-center justify-between rounded-lg bg-surface px-1.5 py-1 text-[9px] font-bold dark:bg-surface-2"><span>{n}</span><span className="text-neg">{a}</span></div>
            ))}
          </div>
        </Phone>
      </div>

      <ol className="mt-6 space-y-2">
        {CAPTIONS.map((c, i) => (
          <li key={c.title} className={cn('flex gap-3 rounded-2xl p-3 transition-colors duration-500', active === i ? 'bg-accent/12' : 'bg-transparent')}>
            <span className={cn('display grid h-9 w-9 shrink-0 place-items-center rounded-full text-[20px] font-bold transition-colors duration-500', active === i ? 'brand-gradient text-white' : 'bg-surface-2 text-muted')}>{i + 1}</span>
            <span><span className="block text-[17px] font-bold leading-tight">{c.title}</span><span className="block text-[15px] leading-snug text-muted">{c.text}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}
