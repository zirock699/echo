import type { TranscriptCue } from "../../types";
import { formatTime } from "../../services/srtParser";

interface ProgressBarsProps {
  cue: TranscriptCue | null;
  currentTime: number;
  duration: number;
  onSeekPhrase: (time: number) => void;
  onSeekRecording: (time: number) => void;
}

export const ProgressBars = ({
  cue,
  currentTime,
  duration,
  onSeekPhrase,
  onSeekRecording,
}: ProgressBarsProps) => {
  const phraseStart = cue?.startTime ?? 0;
  const phraseEnd = cue?.endTime ?? Math.max(duration, 0.001);
  const phraseLen = Math.max(phraseEnd - phraseStart, 0.001);
  const phrasePos = cue ? clamp01((currentTime - phraseStart) / phraseLen) : 0;

  const recordingPos = duration > 0 ? clamp01(currentTime / duration) : 0;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-3">
      {/* Phrase timeline — prominent */}
      <div>
        <div className="flex items-center justify-between mb-1.5 text-xs text-slate-400 tabular-nums">
          <span>{cue ? formatTime(Math.max(0, currentTime - phraseStart)) : formatTime(currentTime)}</span>
          <span className="text-slate-500">phrase</span>
          <span>{cue ? formatTime(phraseLen) : formatTime(duration)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(phrasePos * 1000)}
          onChange={(e) => {
            if (!cue) return;
            const frac = Number(e.target.value) / 1000;
            onSeekPhrase(phraseStart + frac * phraseLen);
          }}
          className="w-full h-2 text-violet-400 cursor-pointer"
          aria-label="Phrase position"
        />
      </div>

      {/* Recording timeline — secondary */}
      <div>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(recordingPos * 1000)}
          onChange={(e) => {
            if (duration <= 0) return;
            const frac = Number(e.target.value) / 1000;
            onSeekRecording(frac * duration);
          }}
          className="w-full h-1 text-slate-400 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Full recording position"
        />
        <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
