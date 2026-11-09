import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(''), 2800);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[104px] z-[60] flex justify-center px-4">
        <AnimatePresence>
          {msg && (
            <motion.div
              key={msg}
              initial={{ opacity: 0, y: 18, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 460, damping: 30 }}
              className="glass flex max-w-[380px] items-center gap-2.5 rounded-full py-2.5 pl-3 pr-5 text-[15px] font-semibold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)]"
            >
              <span className="brand-gradient grid h-6 w-6 place-items-center rounded-full text-white"><Check size={14} strokeWidth={3.2} aria-hidden /></span>
              {msg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
