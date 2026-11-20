import { cn } from "../../utils/cn";

interface FilterPillProps {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
  icon?: React.ReactNode;
}

export const FilterPill = ({
  label,
  active,
  count,
  onClick,
  icon,
}: FilterPillProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
      "transition-all duration-200 hover:scale-105 active:scale-95",
      "whitespace-nowrap shrink-0",
      active
        ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
        : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
    )}
  >
    {icon}
    <span>{label}</span>
    <span
      className={cn(
        "px-1.5 py-0.5 rounded-full text-xs font-semibold tabular-nums",
        active ? "bg-white/20" : "bg-slate-700"
      )}
    >
      {count}
    </span>
  </button>
);
