import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }} className="flex flex-col items-center px-6 py-12 text-center">
      <div className="brand-gradient mb-4 grid h-16 w-16 place-items-center rounded-[20px] text-white shadow-[0_10px_24px_-8px_rgba(10,150,120,0.6)]">
        <Icon size={30} aria-hidden />
      </div>
      <p className="text-[20px] font-bold tracking-[-0.02em]">{title}</p>
      {hint && <p className="mt-1 text-muted">{hint}</p>}
    </motion.div>
  );
}
