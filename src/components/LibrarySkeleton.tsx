import { Skeleton } from "./ui/Skeleton";

export const LibrarySkeleton = () => (
  <div className="w-full h-full flex flex-col bg-slate-950">
    <div className="shrink-0 border-b border-white/5 bg-slate-950/95 backdrop-blur-sm px-4 pt-4 pb-3">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>

    <div className="flex-1 overflow-hidden px-4 py-5 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-white/5 p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
