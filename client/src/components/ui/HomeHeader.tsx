import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';

/** Date and "Hello, name" on the left, the person's photo on the right (tap it to open Profile). */
export function HomeHeader() {
  const { user } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <header className="flex items-center justify-between gap-3 pt-1">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold uppercase tracking-[0.04em] text-muted">{today}</p>
        <h1 className="truncate text-[34px] font-bold leading-[1.1] tracking-[-0.03em]">Hello, {user.name.split(' ')[0]}</h1>
      </div>
      <motion.button
        type="button"
        onClick={() => nav('/profile')}
        aria-label="Open your profile"
        whileTap={{ scale: 0.92 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="shrink-0 rounded-full p-[3px] shadow-[var(--sm-shadow)]"
        style={{ background: 'linear-gradient(140deg,#34e3b0,#0fa37f 55%,#0a7a8d)' }}
      >
        <span className="block rounded-full border-2 border-bg">
          <Avatar name={user.name} src={user.avatarUrl} size={52} />
        </span>
      </motion.button>
    </header>
  );
}
