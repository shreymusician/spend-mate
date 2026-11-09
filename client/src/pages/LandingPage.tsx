import { motion } from 'framer-motion';
import { Moon, NotebookPen, PieChart, Sun, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

const features = [
  { icon: NotebookPen, title: 'Every rupee, with a reason', text: 'Note what it was for as you spend it.' },
  { icon: UsersRound, title: 'Share only what you choose', text: 'Family sees just the entries you show them.' },
  { icon: PieChart, title: 'Clear summaries', text: 'See where your money went, month by month.' },
];

// Decorative only: relative bar heights, not data.
const bars = [38, 62, 46, 80, 56, 94, 70];

const rise = (i: number) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 220, damping: 26, delay: 0.12 + i * 0.09 },
});

interface Props { onCreate: () => void; onSignIn: () => void; isDark: boolean; onToggleTheme: () => void }

export function LandingPage({ onCreate, onSignIn, isDark, onToggleTheme }: Props) {
  return (
    <div className="pt-safe pb-safe relative isolate flex h-full flex-col overflow-y-auto overflow-x-hidden">
      {/* Colour fields + grain give the gradient depth, so it doesn't read as a flat vector fill. */}
      <div aria-hidden className="grain pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="blob blob-a -left-24 -top-20 h-[340px] w-[340px]" />
        <div className="blob blob-b -right-28 top-[28%] h-[320px] w-[320px]" />
        <div className="blob blob-c -bottom-24 left-[8%] h-[300px] w-[300px]" />
      </div>

      <header className="flex items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-2.5">
          <Logo size={38} />
          <span className="text-[20px] font-bold tracking-[-0.02em]">SpendMate</span>
        </div>
        <button type="button" onClick={onToggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="glass grid h-11 w-11 place-items-center rounded-full active:scale-95">
          <motion.span key={isDark ? 'moon' : 'sun'} initial={{ rotate: -60, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
            {isDark ? <Moon size={20} aria-hidden /> : <Sun size={20} aria-hidden />}
          </motion.span>
        </button>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4 px-6 py-3 [@media(max-height:760px)]:gap-3">
        <motion.div {...rise(0)}>
          <h1 className="text-[42px] font-bold leading-[1.04] tracking-[-0.035em] [@media(max-height:760px)]:text-[34px]">Know where your money goes.</h1>
          <p className="mt-2.5 text-[18px] leading-snug text-muted [@media(max-height:760px)]:text-[16px]">Write down what you spend and why. See it clearly. Share it with family only when you choose.</p>
        </motion.div>

        <motion.div {...rise(1)} aria-hidden className="glass float flex h-[92px] items-end gap-2.5 rounded-[24px] p-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.35)] [@media(max-height:760px)]:hidden">
          {bars.map((h, i) => (
            <motion.span
              key={i}
              className="brand-gradient flex-1 rounded-[7px]"
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ type: 'spring', stiffness: 110, damping: 14, delay: 0.5 + i * 0.07 }}
            />
          ))}
        </motion.div>

        <motion.ul {...rise(2)} className="glass divide-y divide-line overflow-hidden rounded-[24px]">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3.5 px-4 py-3 [@media(max-height:760px)]:py-2.5">
              <span className="brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-white shadow-[0_8px_16px_-8px_rgba(10,150,120,0.8)]"><Icon size={22} aria-hidden /></span>
              <span>
                <span className="block text-[16px] font-semibold leading-tight">{title}</span>
                <span className="block text-[14px] leading-snug text-muted">{text}</span>
              </span>
            </li>
          ))}
        </motion.ul>
      </main>

      <motion.footer {...rise(4)} className="sticky bottom-0 space-y-1 px-6 pb-5 pt-3">
        <Button block onClick={onCreate} className="h-[56px] text-[18px]">Get started</Button>
        <Button block variant="link" onClick={onSignIn} className="text-[16px]">I already have an account</Button>
      </motion.footer>
    </div>
  );
}
