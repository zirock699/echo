import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { Check, Flag, X } from "lucide-react";
import type { TranscriptCue } from "../../types";
import { formatTime } from "../../services/srtParser";

interface PhraseQueueProps {
  open: boolean;
  cues: TranscriptCue[];
  currentIndex: number;
  onClose: () => void;
  onSelect: (index: number) => void;
  onToggleFlag: (index: number, flag: "practised" | "difficult") => void;
}

export const PhraseQueue = ({
  open,
  cues,
  currentIndex,
  onClose,
  onSelect,
  onToggleFlag,
}: PhraseQueueProps) => {
  const activeRefMobile = useRef<HTMLDivElement | null>(null);
  const activeRefDesktop = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Both variants exist in the DOM (one hidden via CSS); scrolling the
    // hidden one is a harmless no-op, so it's safe to scroll both.
    activeRefMobile.current?.scrollIntoView({ block: "center" });
    activeRefDesktop.current?.scrollIntoView({ block: "center" });
  }, [open, currentIndex]);

  if (!open) return null;

  const renderList = (activeRef: RefObject<HTMLDivElement | null>) => (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {cues.map((cue, idx) => {
        const isCurrent = idx === currentIndex;
        return (
          <div
            key={cue.id}
            ref={isCurrent ? activeRef : undefined}
            className={[
              "group flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition animate-in fade-in duration-200",
              isCurrent ? "bg-violet-500/15" : "hover:bg-white/5",
            ].join(" ")}
            onClick={() => {
              onSelect(idx);
              onClose();
            }}
          >
            <span
              className={[
                "mt-0.5 text-[11px] w-6 shrink-0 tabular-nums",
                isCurrent ? "text-violet-300 font-semibold" : "text-slate-500",
              ].join(" ")}
            >
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className={[
                  "text-sm leading-snug",
                  isCurrent ? "text-white font-medium" : "text-slate-300",
                ].join(" ")}
              >
                {cue.text}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {formatTime(cue.startTime)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFlag(idx, "practised");
                }}
                aria-label="Mark practised"
                className={[
                  "w-9 h-9 flex items-center justify-center rounded-full transition",
                  cue.practised
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-white/10",
                ].join(" ")}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFlag(idx, "difficult");
                }}
                aria-label="Mark difficult"
                className={[
                  "w-9 h-9 flex items-center justify-center rounded-full transition",
                  cue.difficult
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-white/10",
                ].join(" ")}
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex sm:justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Mobile: bottom sheet */}
      <div className="relative sm:hidden mt-auto w-full max-h-[75vh] bg-slate-900 border-t border-white/10 rounded-t-2xl flex flex-col animate-in slide-in-from-bottom-8 duration-300">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/15 absolute left-1/2 -translate-x-1/2 top-2" />
          <h3 className="font-semibold text-white text-sm">Phrases</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        {renderList(activeRefMobile)}
      </div>
      {/* Desktop: right sidebar */}
      <div className="relative hidden sm:flex sm:w-96 h-full bg-slate-900 border-l border-white/10 flex-col animate-in slide-in-from-right-8 duration-300">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white text-sm">Phrases</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        {renderList(activeRefDesktop)}
      </div>
    </div>
  );
};
