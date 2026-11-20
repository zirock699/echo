import { X } from "lucide-react";
import type { PlaybackMode } from "../../types";
import { LEAD_IN_OPTIONS, SPEED_OPTIONS } from "../../types";

interface PlaybackSettingsSheetProps {
  open: boolean;
  mode: PlaybackMode;
  rate: number;
  leadIn: number;
  onClose: () => void;
  onModeChange: (mode: PlaybackMode) => void;
  onRateChange: (rate: number) => void;
  onLeadInChange: (seconds: number) => void;
}

const MODE_OPTIONS: { value: PlaybackMode; label: string; description: string }[] = [
  { value: "manual", label: "Manual", description: "Plays one phrase, pauses, waits for you" },
  { value: "automatic", label: "Automatic", description: "Pauses briefly, then moves on by itself" },
  { value: "continuous", label: "Continuous", description: "Plays the full recording naturally" },
];

export const PlaybackSettingsSheet = ({
  open,
  mode,
  rate,
  leadIn,
  onClose,
  onModeChange,
  onRateChange,
  onLeadInChange,
}: PlaybackSettingsSheetProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl bg-slate-900 border border-white/10 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Practice settings</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-5">
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
            Playback mode
          </p>
          <div className="flex flex-col gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onModeChange(opt.value)}
                className={[
                  "text-left px-3 py-2.5 rounded-xl border transition",
                  mode === opt.value
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-white/10 hover:border-white/20",
                ].join(" ")}
              >
                <p className="text-sm font-medium text-white">{opt.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
            Speed
          </p>
          <div className="flex gap-2 flex-wrap">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onRateChange(s)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm transition tabular-nums",
                  rate === s
                    ? "bg-white text-slate-950 font-semibold"
                    : "bg-white/5 text-slate-300 hover:bg-white/10",
                ].join(" ")}
              >
                {s}×
              </button>
            ))}
            <button
              onClick={() => onRateChange(1)}
              className="px-3 py-1.5 rounded-full text-sm text-violet-300 hover:bg-white/5 transition"
            >
              Reset
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
            Lead-in
          </p>
          <div className="flex gap-2 flex-wrap">
            {LEAD_IN_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onLeadInChange(s)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm transition tabular-nums",
                  leadIn === s
                    ? "bg-white text-slate-950 font-semibold"
                    : "bg-white/5 text-slate-300 hover:bg-white/10",
                ].join(" ")}
              >
                {s === 0 ? "None" : `${s}s`}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Starts playback slightly before the phrase so it doesn't sound abrupt.
          </p>
        </div>

        <div className="hidden sm:block mt-5 pt-4 border-t border-white/5">
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
            Keyboard shortcuts
          </p>
          <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-400">
            <Shortcut keys="Space" label="Play / pause" />
            <Shortcut keys="← →" label="Previous / next" />
            <Shortcut keys="R" label="Replay phrase" />
            <Shortcut keys="L" label="Toggle loop" />
            <Shortcut keys="Q" label="Phrase queue" />
            <Shortcut keys="T" label="Show / hide text" />
          </div>
        </div>
      </div>
    </div>
  );
};

const Shortcut = ({ keys, label }: { keys: string; label: string }) => (
  <div className="flex items-center gap-2">
    <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[11px]">{keys}</kbd>
    <span>{label}</span>
  </div>
);
