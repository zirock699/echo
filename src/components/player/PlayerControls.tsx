import { Pause, Play, Repeat, SkipBack, SkipForward, RotateCcw } from "lucide-react";
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
      <div className="h-5 flex items-center justify-center">
        {isPending ? (
          <p className="text-xs text-violet-300 tabular-nums">
            {loop ? "Repeating" : "Next phrase"} in {pauseRemaining.toFixed(1)}s
          </p>
        ) : status === "ended" ? (
          <p className="text-xs text-slate-400">Session complete</p>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <button
          onClick={onPrevious}
          disabled={!canPrevious}
          aria-label="Previous phrase"
          className="w-11 h-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-95"
        >
          <SkipBack className="w-5 h-5" fill="currentColor" />
        </button>

        <button
          onClick={onReplay}
          aria-label="Replay phrase"
          className="w-11 h-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-white text-slate-950 shadow-lg shadow-black/30 hover:scale-105 active:scale-95 transition"
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
          className="w-11 h-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-95"
        >
          <SkipForward className="w-5 h-5" fill="currentColor" />
        </button>

        <button
          onClick={onToggleLoop}
          aria-label="Toggle loop"
          aria-pressed={loop}
          className={[
            "w-11 h-11 flex items-center justify-center rounded-full transition active:scale-95",
            loop ? "text-violet-400 bg-violet-500/15" : "text-slate-300 hover:text-white hover:bg-white/5",
          ].join(" ")}
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
