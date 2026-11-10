import { motion } from 'framer-motion';
import { Check, Eye, Lock, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';

/* Four small animated pictures, one per promise. All decorative. */

function BarsArt() {
  return (
    <div className="flex h-full items-end gap-1.5 px-2.5 pb-2.5">
      {[40, 70, 50, 92, 64].map((h, i) => (
        <motion.span key={i} className="brand-gradient block flex-1 rounded-[4px]" initial={{ height: '12%' }} whileInView={{ height: `${h}%` }} viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 120, damping: 12, delay: 0.1 + i * 0.08 }} />
      ))}
    </div>
  );
}

function ViewOnlyArt() {
  return (
    <div className="relative grid h-full place-items-center">
      <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 2.4, repeat: Infinity }} className="text-accent"><Eye size={30} /></motion.span>
      <span className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-surface text-muted shadow-sm dark:bg-surface-2">
        <Pencil size={12} /><span className="absolute h-[2px] w-5 -rotate-45 rounded bg-neg" />
      </span>
    </div>
  );
}

function ControlArt() {
  return (
    <div className="grid h-full place-items-center gap-1.5 px-2.5 py-2">
      {[0, 1].map((r) => (
        <motion.span key={r} className="relative block h-[18px] w-[34px] rounded-full" animate={{ backgroundColor: r ? ['#34c759', '#34c759', '#c7c7cc', '#c7c7cc', '#34c759'] : ['#c7c7cc', '#34c759', '#34c759', '#c7c7cc', '#c7c7cc'] }} transition={{ duration: 5, repeat: Infinity, delay: r * 0.4 }}>
          <motion.span className="absolute left-[2px] top-[2px] block h-[14px] w-[14px] rounded-full bg-white shadow" animate={{ x: r ? [16, 16, 0, 0, 16] : [0, 16, 16, 0, 0] }} transition={{ duration: 5, repeat: Infinity, delay: r * 0.4 }} />
        </motion.span>
      ))}
    </div>
  );
}

function LiveArt() {
  return (
    <div className="relative grid h-full place-items-center">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="absolute block h-8 w-8 rounded-full border-2 border-accent" animate={{ scale: [0.4, 1.6], opacity: [0.8, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }} />
      ))}
      <span className="brand-gradient relative block h-3.5 w-3.5 rounded-full" />
    </div>
  );
}

const CARDS: { art: ReactNode; title: string; text: string }[] = [
  { art: <BarsArt />, title: 'See where it really goes', text: 'Every entry has a reason. At month end, the picture is clear: food, travel, study, fun.' },
  { art: <ViewOnlyArt />, title: 'Parents in the loop, not in the way', text: 'Parents can look and encourage. They can never change an entry or touch the money.' },
  { art: <ControlArt />, title: 'You stay in control', text: 'Show or hide any entry, or stop sharing completely, whenever you like.' },
  { art: <LiveArt />, title: 'Everyone sees it live', text: 'New entries and replies appear on the family’s phones in a moment. No refreshing.' },
];

export function WhyCards() {
  return (
    <ul className="space-y-3">
      {CARDS.map((c, i) => (
        <motion.li key={c.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -8% 0px' }} transition={{ type: 'spring', stiffness: 200, damping: 24, delay: i * 0.05 }}
          className="glass flex items-center gap-4 rounded-[24px] p-4">
          <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[20px] bg-surface shadow-[var(--sm-shadow)] dark:bg-surface-2" aria-hidden>{c.art}</span>
          <span>
            <span className="display block text-[21px] font-bold leading-[1.15]">{c.title}</span>
            <span className="mt-1 block text-[15px] leading-snug text-muted">{c.text}</span>
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

const AUDIENCE = [
  { who: 'For students', tone: 'from-[#34e3b0]/30 to-[#38b6ff]/20', points: ['Know where your pocket money went', 'Add an entry in a few seconds', 'You decide what your parents see'] },
  { who: 'For parents', tone: 'from-[#ffc46b]/35 to-[#ff8a9b]/20', points: ['See the month at a glance', 'Cheer good choices with a comment', 'View only, never in the way'] },
];

export function Audience() {
  return (
    <div className="grid gap-3">
      {AUDIENCE.map((a, i) => (
        <motion.div key={a.who} initial={{ opacity: 0, x: i ? 30 : -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          className={`glass rounded-[26px] bg-gradient-to-br p-5 ${a.tone}`}>
          <p className="display text-[26px] font-bold italic leading-none">{a.who}</p>
          <ul className="mt-3 space-y-2">
            {a.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[16px] font-medium leading-snug">
                <span className="brand-gradient mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white"><Check size={12} strokeWidth={3.5} /></span>{p}
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
      <p className="flex items-center justify-center gap-1.5 pt-1 text-[14px] text-muted"><Lock size={14} aria-hidden />Your Secret Pin and your choices stay yours.</p>
    </div>
  );
}
