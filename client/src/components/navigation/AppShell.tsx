import { motion } from 'framer-motion';
import { Home, Receipt, UserRound, Users } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTabSwipe } from '@/components/navigation/useTabSwipe';
import { TopProgress } from '@/components/ui/TopProgress';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/history', label: 'History', icon: Receipt },
  { to: '/family', label: 'Family', icon: Users },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const;

/**
 * Phone-sized frame with a frosted tab bar that content scrolls underneath, like iOS.
 * Swiping right to left moves to the next tab (Home, History, Family, Profile) and left to right to the previous one.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const key = pathname;

  // Which tab we are on, or -1 on a page inside a tab (such as someone's entries), where swiping does nothing.
  const index = tabs.findIndex((t) => t.to === pathname);
  const swipe = useTabSwipe((direction) => {
    const next = index + (direction === 'next' ? 1 : -1);
    if (next >= 0 && next < tabs.length) navigate(tabs[next]!.to);
  }, index >= 0);

  // The new page slides in from the side the finger (or the tab) is heading toward.
  const previous = useRef(index);
  const slide = index >= 0 && previous.current >= 0 ? Math.sign(index - previous.current) : 0;
  useEffect(() => { previous.current = index; }, [index]);

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-bg">
      <div className="pt-safe relative h-dvh w-full max-w-[430px] overflow-hidden bg-bg sm:h-[min(100dvh,900px)] sm:rounded-[38px] sm:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] sm:ring-1 sm:ring-line">
        <TopProgress />
        <main {...swipe} className="h-full overflow-y-auto overscroll-y-contain overscroll-x-none px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-3">
          {/* One copy of the page, keyed by address: it slides and fades in at once. (Holding the old page on screen while
              the new one loads made every screen load twice and left taps feeling ignored.) */}
          <motion.div key={key} initial={slide ? { opacity: 0, x: slide * 44 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}>
            <Outlet />
          </motion.div>
        </main>

        <nav aria-label="Main" className="glass pb-safe absolute inset-x-0 bottom-0 border-x-0 border-b-0 border-t-[0.5px] border-line">
          <ul className="flex px-2 pt-1.5">
            {tabs.map(({ to, label, icon: Icon }) => (
              <li key={to} className="flex-1">
                <NavLink to={to} end={to === '/'} className={({ isActive }) => cn('relative flex h-[58px] flex-col items-center justify-center gap-0.5 text-[12px] font-semibold', isActive ? 'text-accent' : 'text-muted')}>
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId="tab-glow" className="absolute inset-x-3 top-0.5 h-[34px] rounded-full bg-accent/12" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                      <motion.span className="relative" animate={{ scale: isActive ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                        <Icon size={25} strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                      </motion.span>
                      <span className="relative">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
