import { useState } from "react";
import { ChevronDown, Clock, SortAsc, TrendingUp, Calendar, Check } from "lucide-react";
import type { SortOption } from "../../types";
import { cn } from "../../utils/cn";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] =
  [
    {
      value: "recent",
      label: "Recently accessed",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      value: "alphabetical",
      label: "Alphabetical",
      icon: <SortAsc className="w-4 h-4" />,
    },
    {
      value: "progress",
      label: "Progress",
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      value: "date-added",
      label: "Date added",
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

export const SortDropdown = ({ value, onChange }: SortDropdownProps) => {
  const [open, setOpen] = useState(false);
  const selected = SORT_OPTIONS.find((opt) => opt.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-sm focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        {selected?.icon}
        <span className="hidden sm:inline">{selected?.label}</span>
        <ChevronDown
          className={cn("w-4 h-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-[var(--shadow-lg)] overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                  value === opt.value
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {opt.icon}
                <span className="flex-1 text-left">{opt.label}</span>
                {value === opt.value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
