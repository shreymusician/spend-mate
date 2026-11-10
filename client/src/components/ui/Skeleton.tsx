import { BrandLoader } from '@/components/ui/BrandLoader';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('skeleton h-4', className)} />;

/** Shown while the app starts and checks who is signed in. On a sleeping server this can take a while, so it says so. */
export function AppSkeleton() {
  return (
    <div className="grid h-dvh place-items-center bg-bg" aria-busy="true">
      <BrandLoader slowHint="Waking up the server. The first visit after a quiet spell can take up to a minute." />
    </div>
  );
}
