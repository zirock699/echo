import { Pause, Play } from "lucide-react";
import type { PlaybackController } from "../hooks/usePlaybackController";

interface MiniPlayerProps {
  controller: PlaybackController;
  onExpand: () => void;
}

export const MiniPlayer = ({ controller, onExpand }: MiniPlayerProps) => {
  const { lesson } = controller;
  if (!lesson) return null;

  const progress =
    controller.duration > 0 ? Math.min(1, controller.currentTime / controller.duration) : 0;
  const isPlaying = controller.status === "playing" || controller.status === "pending-advance";

  return (
    <div className="shrink-0 border-t border-white/10 bg-slate-900/95 backdrop-blur-sm">
      <div className="h-0.5 bg-white/5">
        <div
          className="h-full bg-violet-500 transition-[width]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-left"
      >
        {controller.thumbnailUrl ? (
          <img
            src={controller.thumbnailUrl}
            alt=""
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
          <p className="text-xs text-slate-400 truncate">
            {controller.currentCue?.text || lesson.channel || "Tap to open"}
          </p>
        </div>
        <span
          role="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={(e) => {
            e.stopPropagation();
            controller.playPause();
          }}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-slate-950 shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
        </span>
      </button>
    </div>
  );
};
