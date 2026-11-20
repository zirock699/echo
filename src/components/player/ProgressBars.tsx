import { useState } from "react";
import type { TranscriptCue } from "../../types";
import { formatTime } from "../../utils/formatters";

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
  const [phraseHoverPos, setPhraseHoverPos] = useState<number | null>(null);

  const phraseStart = cue?.startTime ?? 0;
  const phraseEnd = cue?.endTime ?? Math.max(duration, 0.001);
  const phraseLen = Math.max(phraseEnd - phraseStart, 0.001);
  const phrasePos = cue ? clamp01((currentTime - phraseStart) / phraseLen) : 0;

  const recordingPos = duration > 0 ? clamp01(currentTime / duration) : 0;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-4">
      {/* Phrase timeline — prominent */}
      <div className="relative">
        <div className="flex items-center justify-between mb-1.5 text-xs text-slate-400 tabular-nums">
          <span>{cue ? formatTime(Math.max(0, currentTime - phraseStart)) : formatTime(currentTime)}</span>
          <span className="text-slate-500">phrase</span>
          <span>{cue ? formatTime(phraseLen) : formatTime(duration)}</span>
        </div>
        {phraseHoverPos !== null && (
          <div
            className="absolute -top-8 transform -translate-x-1/2 px-2 py-1 bg-slate-800 border border-white/10 rounded text-xs text-white font-medium shadow-lg pointer-events-none"
            style={{ left: `${phraseHoverPos * 100}%` }}
          >
            {formatTime((phraseHoverPos * phraseLen) + phraseStart)}
          </div>
        )}
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
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            setPhraseHoverPos(Math.max(0, Math.min(1, pos)));
          }}
          onMouseLeave={() => setPhraseHoverPos(null)}
          className="w-full h-2 text-violet-400 cursor-pointer hover:scale-y-110 transition-transform"
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
