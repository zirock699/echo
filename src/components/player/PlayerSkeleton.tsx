import { Skeleton } from "../ui/Skeleton";

export const PlayerSkeleton = () => (
  <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-950">
    {/* Atmospheric background skeleton */}
    <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-slate-800/50 to-slate-950" />

    <div className="relative z-10 flex items-center justify-between px-3 pt-3 pb-2">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 text-center px-2">
        <Skeleton className="h-3 w-24 mx-auto mb-1" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>
    </div>

    {/* Phrase display skeleton */}
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-4">
        <Skeleton className="h-12 w-3/4 mx-auto rounded-lg" />
        <Skeleton className="h-8 w-2/3 mx-auto rounded-lg" />
      </div>
    </div>

    {/* Controls skeleton */}
    <div className="relative z-10 px-5 pb-8 pt-2 flex flex-col gap-5">
      <div className="w-full max-w-lg mx-auto space-y-3">
        <Skeleton className="h-8 w-full rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
      </div>
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="w-11 h-11 rounded-full" />
        <Skeleton className="w-11 h-11 rounded-full" />
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="w-11 h-11 rounded-full" />
        <Skeleton className="w-11 h-11 rounded-full" />
      </div>
    </div>
  </div>
);
