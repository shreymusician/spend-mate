import { cn } from '@/lib/utils';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('skeleton h-4', className)} />;

export function AppSkeleton() {
  return (
    <div className="flex h-dvh items-center justify-center bg-bg" aria-busy="true" aria-label="Loading">
      <div className="flex h-dvh w-full max-w-[430px] flex-col gap-4 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
