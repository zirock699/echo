import { useEffect, useRef, useState } from "react";
import type { Lesson } from "../types";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import { formatTime } from "../services/srtParser";

interface PlayerProps {
  lesson: Lesson;
  audioUrl: string;
  onProgressUpdate?: (position: number) => void;
}

export const Player = ({ lesson, audioUrl, onProgressUpdate }: PlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentCueIndex, setCurrentCueIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const currentCue = lesson.transcriptCues[currentCueIndex] || null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      onProgressUpdate?.(time);

      // Find current cue
      for (let i = 0; i < lesson.transcriptCues.length; i++) {
        const cue = lesson.transcriptCues[i];
        if (time >= cue.startTime && time < cue.endTime) {
          setCurrentCueIndex(i);
          break;
        }
      }
    };

    const handleDurationChange = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [lesson, onProgressUpdate]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleReplay = () => {
    if (currentCue && audioRef.current) {
      audioRef.current.currentTime = currentCue.startTime;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handlePrevious = () => {
    if (currentCueIndex > 0) {
      const prevCue = lesson.transcriptCues[currentCueIndex - 1];
      if (audioRef.current && prevCue) {
        audioRef.current.currentTime = prevCue.startTime;
        setCurrentCueIndex(currentCueIndex - 1);
      }
    }
  };

  const handleNext = () => {
    if (currentCueIndex < lesson.transcriptCues.length - 1) {
      const nextCue = lesson.transcriptCues[currentCueIndex + 1];
      if (audioRef.current && nextCue) {
        audioRef.current.currentTime = nextCue.startTime;
        setCurrentCueIndex(currentCueIndex + 1);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col">
      <audio ref={audioRef} src={audioUrl} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />

      {/* Thumbnail Background */}
      {lesson.thumbnailUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${lesson.thumbnailUrl})`, filter: "blur(4px)" }}
        />
      )}

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Current Phrase */}
        <div className="w-full max-w-xl mb-12">
          <div className="text-center">
            <p className="text-3xl md:text-5xl font-bold leading-relaxed text-white mb-4">
              {currentCue?.text || "No transcript available"}
            </p>
            <p className="text-sm text-slate-400">
              {currentCueIndex + 1} / {lesson.transcriptCues.length}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-xl mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-violet-500"
            />
            <span className="text-xs text-slate-400">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={handlePrevious}
            disabled={currentCueIndex === 0}
            className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={handleReplay}
            className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlayPause}
            className="p-4 rounded-full bg-violet-600 hover:bg-violet-700 transition shadow-lg"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <button
            onClick={handleNext}
            disabled={currentCueIndex === lesson.transcriptCues.length - 1}
            className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <select
            value={playbackRate}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setPlaybackRate(rate);
              if (audioRef.current) {
                audioRef.current.playbackRate = rate;
              }
            }}
            className="px-3 py-1 bg-slate-700 rounded text-sm hover:bg-slate-600 cursor-pointer"
          >
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </div>
      </div>

      {/* Transcript Context */}
      <div className="relative z-10 bg-slate-900 bg-opacity-95 overflow-y-auto max-h-48 border-t border-slate-700 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          {lesson.transcriptCues.map((cue, idx) => (
            <div
              key={cue.id}
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = cue.startTime;
                  setCurrentCueIndex(idx);
                }
              }}
              className={`p-2 mb-2 rounded cursor-pointer text-sm transition ${
                idx === currentCueIndex
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              {cue.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
