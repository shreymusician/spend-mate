import { AnimatePresence, motion } from 'framer-motion';
import { Home, Receipt, UserRound, Users } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/history', label: 'History', icon: Receipt },
  { to: '/family', label: 'Family', icon: Users },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const;

/** Phone-sized frame with a frosted tab bar that content scrolls underneath, like iOS. */
export function AppShell() {
  const { pathname } = useLocation();
  // Child pages under /family share the Family tab's transition key.
  const key = pathname.startsWith('/family/') ? pathname : pathname;

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-bg">
      <div className="pt-safe relative h-dvh w-full max-w-[430px] overflow-hidden bg-bg sm:h-[min(100dvh,900px)] sm:rounded-[38px] sm:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] sm:ring-1 sm:ring-line">
        <main className="h-full overflow-y-auto overscroll-contain px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
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
