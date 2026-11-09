import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** iOS-style modal sheet: springs up, blurs what's behind, closes with the button, a swipe on the grabber, or Esc. */
export function Sheet({ open, onClose, title, children }: Props) {
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            className="relative max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-bg pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.25)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.9 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 100 || i.velocity.y > 500) && onClose()}
          >
            <div className="flex h-6 touch-none justify-center pt-2" onPointerDown={(e) => controls.start(e)}>
              <div className="h-[5px] w-9 rounded-full bg-muted/40" />
            </div>
            <div className="flex items-center justify-between px-5 pb-1">
              <h2 className="text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted active:opacity-70">
                <X size={18} strokeWidth={2.6} aria-hidden />
              </button>
            </div>
            <div className="p-5 pt-3">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
