import { cn } from "../../utils/cn";

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    className={cn(
      "animate-pulse bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded",
      "bg-[length:200%_100%]",
      className
    )}
    style={{ animation: "shimmer 2s ease-in-out infinite" }}
  />
);
