import { Check, Pause, Play, Repeat, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import { cn } from "../../utils/cn";
import type { PlaybackMode, PlaybackStatus } from "../../types";

interface PlayerControlsProps {
  status: PlaybackStatus;
  mode: PlaybackMode;
  rate: number;
  loop: boolean;
  pauseRemaining: number;
  canPrevious: boolean;
  canNext: boolean;
  onPlayPause: () => void;
  onReplay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleLoop: () => void;
  onOpenSettings: () => void;
}

const MODE_LABELS: Record<PlaybackMode, string> = {
  manual: "Manual",
  automatic: "Automatic",
  continuous: "Continuous",
};

export const PlayerControls = ({
  status,
  mode,
  rate,
  loop,
  pauseRemaining,
  canPrevious,
  canNext,
  onPlayPause,
  onReplay,
  onPrevious,
  onNext,
  onToggleLoop,
  onOpenSettings,
}: PlayerControlsProps) => {
  const isPlaying = status === "playing";
  const isPending = status === "pending-advance";

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-3">
      {/* Status line — reserved height so layout never jumps */}
      <div className="h-6 flex items-center justify-center mb-1">
        {isPending ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <p className="text-sm text-violet-300 font-medium tabular-nums">
              {loop ? "Repeating" : "Next phrase"} in {pauseRemaining.toFixed(1)}s
            </p>
          </div>
        ) : status === "ended" ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <Check className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-emerald-300 font-medium">Session complete</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <button
          onClick={onPrevious}
          disabled={!canPrevious}
          aria-label="Previous phrase"
          className="w-11 h-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <SkipBack className="w-5 h-5" fill="currentColor" />
        </button>

        <button
          onClick={onReplay}
          aria-label="Replay phrase"
          className="w-11 h-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-white text-slate-950 shadow-[var(--shadow-xl)] hover:scale-110 hover:shadow-[var(--shadow-elevated)] active:scale-95 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          {isPlaying || isPending ? (
            <Pause className="w-7 h-7" fill="currentColor" />
          ) : (
            <Play className="w-7 h-7 ml-0.5" fill="currentColor" />
          )}
        </button>

        <button
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next phrase"
          className="w-11 h-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <SkipForward className="w-5 h-5" fill="currentColor" />
        </button>

        <button
          onClick={onToggleLoop}
          aria-label="Toggle loop"
          aria-pressed={loop}
          className={cn(
            "w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200",
            "hover:scale-105 active:scale-95",
            "focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
            loop
              ? "text-violet-400 bg-violet-500/15 animate-pulse"
              : "text-slate-300 hover:text-white hover:bg-white/5",
          )}
        >
          <Repeat className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition"
      >
        <span className="font-medium">{MODE_LABELS[mode]}</span>
        <span className="w-1 h-1 rounded-full bg-slate-500" />
        <span className="tabular-nums">{rate}×</span>
      </button>
    </div>
  );
};
