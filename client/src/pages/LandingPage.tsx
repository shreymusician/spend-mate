import { motion } from 'framer-motion';
import { MessageCircleHeart, Moon, NotebookPen, Sun, UsersRound } from 'lucide-react';
import { FamilyHero } from '@/components/landing/FamilyHero';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

const STEPS = [
  { icon: NotebookPen, title: 'Note it', text: 'Every spend, with a reason' },
  { icon: UsersRound, title: 'Share it', text: 'Only what you choose' },
  { icon: MessageCircleHeart, title: 'Talk about it', text: 'Parents view and reply' },
];

const rise = (i: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 220, damping: 26, delay: 0.08 + i * 0.08 },
});

/** One short screen: the idea, three tiny steps, and Log in / Sign up / theme switch together in the top bar. */
interface Props { onCreate: () => void; onSignIn: () => void; isDark: boolean; onToggleTheme: () => void }

export function LandingPage({ onCreate, onSignIn, isDark, onToggleTheme }: Props) {
  return (
    <div className="font-land pt-safe pb-safe relative isolate flex h-full flex-col overflow-y-auto overflow-x-hidden">
      {/* Colour fields + grain give the gradient depth, so it doesn't read as a flat vector fill. */}
      <div aria-hidden className="grain pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="blob blob-a -left-24 -top-20 h-[340px] w-[340px]" />
        <div className="blob blob-b -right-28 top-[30%] h-[320px] w-[320px]" />
        <div className="blob blob-c -bottom-24 left-[8%] h-[300px] w-[300px]" />
      </div>

      <header className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <Logo size={38} />
          {/* The name gives way on the narrowest phones so the two buttons and the switch always fit. */}
          <span className="display truncate text-[21px] font-extrabold tracking-[-0.02em] max-[379px]:hidden">SpendMate</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="secondary" onClick={onSignIn} className="h-10 rounded-full px-3.5 text-[15px]">Log in</Button>
          <Button onClick={onCreate} className="h-10 rounded-full px-3.5 text-[15px]">Sign up</Button>
          <button type="button" onClick={onToggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="glass grid h-10 w-10 place-items-center rounded-full active:scale-95">
            <motion.span key={isDark ? 'moon' : 'sun'} initial={{ rotate: -60, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
              {isDark ? <Moon size={19} aria-hidden /> : <Sun size={19} aria-hidden />}
            </motion.span>
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4 px-6 py-3 text-center [@media(max-height:760px)]:gap-2">
        <motion.div {...rise(0)}>
          <h1 className="display text-[54px] font-extrabold leading-[0.96] [@media(max-height:760px)]:text-[44px] max-[359px]:text-[44px]">
            Save more,
            <br />
            <span className="display-i relative inline-block text-accent">
              together.
              <svg aria-hidden viewBox="0 0 260 16" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-[14px] w-full overflow-visible">
                <motion.path d="M3 11 C 45 3, 95 15, 150 7 S 230 11, 257 4" stroke="#ffc46b" strokeWidth="6" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.7, ease: 'easeInOut' }} />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-[320px] text-[17px] leading-snug text-muted [@media(max-height:760px)]:mt-3 [@media(max-height:760px)]:text-[16px]">
            Log every spend, share it with your family, and save more together.
          </p>
        </motion.div>

        {/* The scene is 320 px tall; it shrinks a little on short phones so everything still fits. */}
        <motion.div {...rise(1)} className="mx-auto h-[320px] [@media(max-height:760px)]:h-[262px]">
          <div className="origin-top [@media(max-height:760px)]:scale-[0.82]"><FamilyHero /></div>
        </motion.div>

        <motion.ul {...rise(2)} className="glass grid grid-cols-3 divide-x divide-line rounded-[24px] py-3.5">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col items-center gap-1 px-2">
              <span className="brand-gradient grid h-10 w-10 place-items-center rounded-[13px] text-white shadow-[0_8px_16px_-8px_rgba(10,150,120,0.8)]"><Icon size={20} aria-hidden /></span>
              <span className="text-[15px] font-extrabold leading-tight">{title}</span>
              <span className="text-[12.5px] leading-snug text-muted">{text}</span>
            </li>
          ))}
        </motion.ul>
      </main>
    </div>
  );
}
