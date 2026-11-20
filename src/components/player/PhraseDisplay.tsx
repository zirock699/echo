import type { TranscriptCue } from "../../types";

interface PhraseDisplayProps {
  cues: TranscriptCue[];
  currentIndex: number;
  onSelect: (index: number) => void;
  showText: boolean;
}

const CONTEXT_RADIUS = 2;

export const PhraseDisplay = ({ cues, currentIndex, onSelect, showText }: PhraseDisplayProps) => {
  if (cues.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-slate-400 text-base">
          This lesson doesn't have a transcript. You can still listen and use the recording timeline below.
        </p>
      </div>
    );
  }

  const start = Math.max(0, currentIndex - CONTEXT_RADIUS);
  const end = Math.min(cues.length - 1, currentIndex + CONTEXT_RADIUS);
  const visible = cues.slice(start, end + 1);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 min-h-0 select-none">
      <div className="w-full max-w-lg flex flex-col items-center gap-3">
        {visible.map((cue, i) => {
          const absoluteIndex = start + i;
          const distance = Math.abs(absoluteIndex - currentIndex);
          const isCurrent = absoluteIndex === currentIndex;

          if (!showText && !isCurrent) return null;

          return (
            <button
              key={cue.id}
              onClick={() => onSelect(absoluteIndex)}
              className={[
                "text-center transition-all duration-300 ease-out max-w-full px-2",
                isCurrent
                  ? "text-white font-semibold"
                  : distance === 1
                  ? "text-slate-500 font-normal"
                  : "text-slate-600 font-normal",
              ].join(" ")}
              style={{
                fontSize: isCurrent
                  ? "clamp(1.375rem, 5.5vw, 2.25rem)"
                  : "clamp(0.9rem, 3.4vw, 1.15rem)",
                lineHeight: 1.35,
                opacity: isCurrent ? 1 : distance === 1 ? 0.65 : 0.35,
              }}
            >
              {showText ? cue.text : isCurrent ? "●  ●  ●" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
};
