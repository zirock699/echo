import { useEffect, useState } from "react";
import { ChevronDown, Eye, EyeOff, ListMusic } from "lucide-react";
import type { PlaybackController } from "../hooks/usePlaybackController";
import { PhraseDisplay } from "./player/PhraseDisplay";
import { ProgressBars } from "./player/ProgressBars";
import { PlayerControls } from "./player/PlayerControls";
import { PhraseQueue } from "./player/PhraseQueue";
import { PlaybackSettingsSheet } from "./player/PlaybackSettingsSheet";

interface PlayerProps {
  controller: PlaybackController;
  onBack: () => void;
}

export const Player = ({ controller, onBack }: PlayerProps) => {
  const [queueOpen, setQueueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showText, setShowText] = useState(true);

  const { lesson } = controller;

  // Desktop keyboard shortcuts. Ignored while typing in an input, and the
  // overlay-sensitive ones (Q/Escape) respect whichever sheet is open.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          controller.playPause();
          break;
        case "ArrowLeft":
          controller.previous();
          break;
        case "ArrowRight":
          controller.next();
          break;
        case "r":
        case "R":
          controller.replay();
          break;
        case "l":
        case "L":
          controller.toggleLoop();
          break;
        case "q":
        case "Q":
          setQueueOpen((v) => !v);
          break;
        case "t":
        case "T":
          setShowText((v) => !v);
          break;
        case "Escape":
          setQueueOpen(false);
          setSettingsOpen(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controller]);

  if (!lesson) return null;

  const cues = lesson.transcriptCues;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-950">
      {/* Atmospheric background */}
      {controller.thumbnailUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            backgroundImage: `url(${controller.thumbnailUrl})`,
            filter: "blur(40px) saturate(1.3)",
            opacity: 0.35,
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/85 to-slate-950" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button
          onClick={onBack}
          aria-label="Back to library"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-300 transition"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        <div className="flex-1 text-center px-2 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 truncate">
            {lesson.channel || "Echo Studio"}
          </p>
          <h1 className="text-sm font-medium text-white truncate">{lesson.title}</h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowText((v) => !v)}
            aria-label={showText ? "Hide text" : "Show text"}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-300 transition"
          >
            {showText ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
          </button>
          <button
            onClick={() => setQueueOpen(true)}
            aria-label="Open phrase queue"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-300 transition"
          >
            <ListMusic className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* Phrase index */}
      <div className="relative z-10 text-center">
        <p className="text-xs text-slate-500 tabular-nums">
          {cues.length > 0 ? `${controller.cueIndex + 1} of ${cues.length}` : ""}
        </p>
      </div>

      {/* Current phrase, lyrics-style */}
      <PhraseDisplay
        cues={cues}
        currentIndex={controller.cueIndex}
        onSelect={controller.selectCue}
        showText={showText}
      />

      {/* Compact audio indicator — minimal, audio-only lessons have no video to show */}
      <div className="relative z-10 flex items-center justify-center gap-2 pb-2 text-[11px] text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        <span>Audio lesson</span>
      </div>

      {/* Controls + timelines */}
      <div className="relative z-10 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 flex flex-col gap-5">
        <ProgressBars
          cue={controller.currentCue}
          currentTime={controller.currentTime}
          duration={controller.duration}
          onSeekPhrase={controller.seekTime}
          onSeekRecording={controller.seekTime}
        />
        <PlayerControls
          status={controller.status}
          mode={controller.mode}
          rate={controller.rate}
          loop={controller.loop}
          pauseRemaining={controller.pauseRemaining}
          canPrevious={controller.cueIndex > 0}
          canNext={controller.cueIndex < cues.length - 1}
          onPlayPause={controller.playPause}
          onReplay={controller.replay}
          onPrevious={controller.previous}
          onNext={controller.next}
          onToggleLoop={controller.toggleLoop}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <PhraseQueue
        open={queueOpen}
        cues={cues}
        currentIndex={controller.cueIndex}
        onClose={() => setQueueOpen(false)}
        onSelect={controller.selectCue}
        onToggleFlag={controller.toggleCueFlag}
      />

      <PlaybackSettingsSheet
        open={settingsOpen}
        mode={controller.mode}
        rate={controller.rate}
        leadIn={controller.leadIn}
        onClose={() => setSettingsOpen(false)}
        onModeChange={controller.setMode}
        onRateChange={controller.setRate}
        onLeadInChange={controller.setLeadIn}
      />
    </div>
  );
};
