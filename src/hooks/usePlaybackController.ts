import { useCallback, useEffect, useRef, useState } from "react";
import type { Lesson, PlaybackMode, PlaybackStatus, TranscriptCue } from "../types";
import { saveLesson } from "../services/storage";

const MIN_PAUSE = 1.2;
const MAX_PAUSE = 6;
const PAUSE_MULTIPLIER = 1.4;
const LOOP_GAP = 0.9;

const RATE_STORAGE_KEY = "echo-studio:playback-rate";

function readStoredRate(): number {
  const raw = window.localStorage.getItem(RATE_STORAGE_KEY);
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function findCueIndexAtTime(cues: TranscriptCue[], time: number, fallback: number): number {
  for (let i = 0; i < cues.length; i++) {
    if (time >= cues[i].startTime && time < cues[i].endTime) return i;
  }
  // Between cues: snap to the next upcoming one for highlighting purposes
  for (let i = 0; i < cues.length; i++) {
    if (time < cues[i].startTime) return Math.max(0, i - 1 < 0 ? i : fallback);
  }
  return fallback;
}

export interface PlaybackController {
  lesson: Lesson | null;
  status: PlaybackStatus;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  cueIndex: number;
  currentCue: TranscriptCue | null;
  mode: PlaybackMode;
  rate: number;
  loop: boolean;
  leadIn: number;
  pauseRemaining: number;
  thumbnailUrl?: string;

  loadLesson: (lesson: Lesson, audioUrl: string) => void;
  clearLesson: () => void;
  playPause: () => void;
  play: () => void;
  pause: () => void;
  replay: () => void;
  next: () => void;
  previous: () => void;
  selectCue: (index: number) => void;
  seekTime: (time: number) => void;
  setMode: (mode: PlaybackMode) => void;
  setRate: (rate: number) => void;
  toggleLoop: () => void;
  setLeadIn: (seconds: number) => void;
  toggleCueFlag: (index: number, flag: "practised" | "difficult") => void;
}

export function usePlaybackController(): PlaybackController {
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const lessonRef = useRef<Lesson | null>(null);
  const modeRef = useRef<PlaybackMode>("manual");
  const loopRef = useRef(false);
  const leadInRef = useRef(0);
  const cueIndexRef = useRef(0);
  const pendingAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cueIndex, setCueIndex] = useState(0);
  const [mode, setModeState] = useState<PlaybackMode>("manual");
  const [rate, setRateState] = useState(readStoredRate);
  const [loop, setLoopState] = useState(false);
  const [leadIn, setLeadInState] = useState(0);
  const [pauseRemaining, setPauseRemaining] = useState(0);

  const clearPendingTimers = useCallback(() => {
    if (pendingAdvanceTimerRef.current) {
      window.clearTimeout(pendingAdvanceTimerRef.current);
      pendingAdvanceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setPauseRemaining(0);
  }, []);

  const persistProgress = useCallback(() => {
    const l = lessonRef.current;
    const audio = audioElRef.current;
    if (!l || !audio) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const updated: Lesson = {
        ...l,
        lastPlayedAt: Date.now(),
        lastPlayedPosition: audio.currentTime,
        lastCueIndex: cueIndexRef.current,
      };
      lessonRef.current = updated;
      saveLesson(updated).catch(() => {});
    }, 800);
  }, []);

  const goToCue = useCallback(
    (index: number, options: { autoplay?: boolean } = {}) => {
      const l = lessonRef.current;
      const audio = audioElRef.current;
      if (!l || !audio) return;
      const clamped = clamp(index, 0, Math.max(0, l.transcriptCues.length - 1));
      const cue = l.transcriptCues[clamped];
      if (!cue) return;
      clearPendingTimers();
      cueIndexRef.current = clamped;
      setCueIndex(clamped);
      const lead = leadInRef.current;
      const startAt = Math.max(0, cue.startTime - lead);
      audio.currentTime = startAt;
      setCurrentTime(startAt);
      if (options.autoplay) {
        audio.play().catch(() => {});
      }
    },
    [clearPendingTimers]
  );

  const scheduleAdvanceOrLoop = useCallback(() => {
    const l = lessonRef.current;
    if (!l) return;
    const cue = l.transcriptCues[cueIndexRef.current];
    if (!cue) return;

    if (loopRef.current) {
      setStatus("pending-advance");
      const waitMs = LOOP_GAP * 1000;
      let remaining = LOOP_GAP;
      setPauseRemaining(remaining);
      countdownIntervalRef.current = window.setInterval(() => {
        remaining -= 0.1;
        setPauseRemaining(Math.max(0, remaining));
      }, 100);
      pendingAdvanceTimerRef.current = window.setTimeout(() => {
        clearPendingTimers();
        goToCue(cueIndexRef.current, { autoplay: true });
      }, waitMs);
      return;
    }

    if (modeRef.current === "automatic") {
      const hasNext = cueIndexRef.current < l.transcriptCues.length - 1;
      if (!hasNext) {
        setStatus("ended");
        return;
      }
      const phraseDuration = cue.endTime - cue.startTime;
      const pauseSeconds = clamp(phraseDuration * PAUSE_MULTIPLIER, MIN_PAUSE, MAX_PAUSE);
      setStatus("pending-advance");
      let remaining = pauseSeconds;
      setPauseRemaining(remaining);
      countdownIntervalRef.current = window.setInterval(() => {
        remaining -= 0.1;
        setPauseRemaining(Math.max(0, remaining));
      }, 100);
      pendingAdvanceTimerRef.current = window.setTimeout(() => {
        clearPendingTimers();
        goToCue(cueIndexRef.current + 1, { autoplay: true });
      }, pauseSeconds * 1000);
      return;
    }

    // Manual mode: just stay paused at the end of the phrase.
    setStatus("paused");
  }, [clearPendingTimers, goToCue]);

  const attachAudio = useCallback(
    (audio: HTMLAudioElement) => {
      const handleTimeUpdate = () => {
        const l = lessonRef.current;
        if (!l) return;
        const t = audio.currentTime;
        setCurrentTime(t);

        if (modeRef.current === "continuous") {
          const idx = findCueIndexAtTime(l.transcriptCues, t, cueIndexRef.current);
          if (idx !== cueIndexRef.current) {
            cueIndexRef.current = idx;
            setCueIndex(idx);
          }
          return;
        }

        const cue = l.transcriptCues[cueIndexRef.current];
        if (cue && t >= cue.endTime - 0.02 && !audio.paused) {
          audio.pause();
          audio.currentTime = cue.endTime;
          scheduleAdvanceOrLoop();
        }
      };

      const handleDurationChange = () => setDuration(audio.duration || 0);
      const handlePlay = () => setStatus((s) => (s === "pending-advance" ? s : "playing"));
      const handlePause = () => setStatus((s) => (s === "pending-advance" ? s : "paused"));
      const handleEnded = () => setStatus("ended");
      const handleLoadedMeta = () => setDuration(audio.duration || 0);

      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("durationchange", handleDurationChange);
      audio.addEventListener("loadedmetadata", handleLoadedMeta);
      audio.addEventListener("play", handlePlay);
      audio.addEventListener("pause", handlePause);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("durationchange", handleDurationChange);
        audio.removeEventListener("loadedmetadata", handleLoadedMeta);
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("ended", handleEnded);
      };
    },
    [scheduleAdvanceOrLoop]
  );

  const loadLesson = useCallback(
    (newLesson: Lesson, audioUrl: string) => {
      clearPendingTimers();
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.src = "";
      }

      const audio = new Audio(audioUrl);
      audio.preload = "auto";
      audio.playbackRate = rate;
      audioElRef.current = audio;
      lessonRef.current = newLesson;
      cueIndexRef.current = newLesson.lastCueIndex ?? 0;

      setLesson(newLesson);
      setStatus("loading");
      setDuration(newLesson.durationSeconds || 0);
      setCueIndex(cueIndexRef.current);
      setCurrentTime(newLesson.lastPlayedPosition || 0);

      const detach = attachAudio(audio);
      (audio as HTMLAudioElement & { __detach?: () => void }).__detach = detach;

      audio.addEventListener(
        "loadedmetadata",
        () => {
          if (newLesson.lastPlayedPosition) {
            audio.currentTime = newLesson.lastPlayedPosition;
          }
          setStatus("paused");
        },
        { once: true }
      );
    },
    [attachAudio, clearPendingTimers, rate]
  );

  const clearLesson = useCallback(() => {
    clearPendingTimers();
    if (audioElRef.current) {
      audioElRef.current.pause();
      const detach = (audioElRef.current as HTMLAudioElement & { __detach?: () => void }).__detach;
      detach?.();
      audioElRef.current.src = "";
      audioElRef.current = null;
    }
    lessonRef.current = null;
    setLesson(null);
    setStatus("idle");
  }, [clearPendingTimers]);

  const play = useCallback(() => {
    const audio = audioElRef.current;
    const l = lessonRef.current;
    if (!audio || !l) return;
    // If we're sitting exactly at the end of the current cue (manual mode stop), replay it.
    const cue = l.transcriptCues[cueIndexRef.current];
    if (cue && audio.currentTime >= cue.endTime - 0.05) {
      goToCue(cueIndexRef.current, { autoplay: true });
      return;
    }
    clearPendingTimers();
    audio.play().catch(() => {});
  }, [clearPendingTimers, goToCue]);

  const pause = useCallback(() => {
    clearPendingTimers();
    audioElRef.current?.pause();
  }, [clearPendingTimers]);

  const playPause = useCallback(() => {
    if (status === "playing" || status === "pending-advance") {
      pause();
    } else {
      play();
    }
  }, [pause, play, status]);

  const replay = useCallback(() => {
    goToCue(cueIndexRef.current, { autoplay: true });
  }, [goToCue]);

  const next = useCallback(() => {
    goToCue(cueIndexRef.current + 1, { autoplay: status === "playing" || status === "pending-advance" });
  }, [goToCue, status]);

  const previous = useCallback(() => {
    goToCue(cueIndexRef.current - 1, { autoplay: status === "playing" || status === "pending-advance" });
  }, [goToCue, status]);

  const selectCue = useCallback(
    (index: number) => {
      goToCue(index, { autoplay: status === "playing" || status === "pending-advance" });
    },
    [goToCue, status]
  );

  const seekTime = useCallback((time: number) => {
    const audio = audioElRef.current;
    const l = lessonRef.current;
    if (!audio || !l) return;
    clearPendingTimers();
    audio.currentTime = time;
    setCurrentTime(time);
    const idx = findCueIndexAtTime(l.transcriptCues, time, cueIndexRef.current);
    cueIndexRef.current = idx;
    setCueIndex(idx);
  }, [clearPendingTimers]);

  const setMode = useCallback((m: PlaybackMode) => {
    modeRef.current = m;
    setModeState(m);
  }, []);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    window.localStorage.setItem(RATE_STORAGE_KEY, String(r));
    if (audioElRef.current) audioElRef.current.playbackRate = r;
  }, []);

  const toggleLoop = useCallback(() => {
    loopRef.current = !loopRef.current;
    setLoopState(loopRef.current);
  }, []);

  const setLeadIn = useCallback((seconds: number) => {
    leadInRef.current = seconds;
    setLeadInState(seconds);
  }, []);

  const toggleCueFlag = useCallback(
    (index: number, flag: "practised" | "difficult") => {
      const l = lessonRef.current;
      if (!l) return;
      const cues = l.transcriptCues.map((c, i) =>
        i === index ? { ...c, [flag]: !c[flag] } : c
      );
      const practisedCount = cues.filter((c) => c.practised).length;
      const updated: Lesson = {
        ...l,
        transcriptCues: cues,
        practisedCount,
        isCompleted: practisedCount === cues.length && cues.length > 0,
      };
      lessonRef.current = updated;
      setLesson(updated);
      saveLesson(updated).catch(() => {});
    },
    []
  );

  useEffect(() => {
    return () => {
      clearPendingTimers();
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
    };
  }, [clearPendingTimers]);

  // Persist playback position periodically while playing.
  useEffect(() => {
    if (status !== "playing") return;
    const id = window.setInterval(() => persistProgress(), 4000);
    return () => window.clearInterval(id);
  }, [status, persistProgress]);

  const currentCue = lesson?.transcriptCues[cueIndex] ?? null;

  return {
    lesson,
    status,
    isPlaying: status === "playing",
    currentTime,
    duration,
    cueIndex,
    currentCue,
    mode,
    rate,
    loop,
    leadIn,
    pauseRemaining,
    thumbnailUrl: lesson?.thumbnailUrl || lesson?.frameUrl,
    loadLesson,
    clearLesson,
    playPause,
    play,
    pause,
    replay,
    next,
    previous,
    selectCue,
    seekTime,
    setMode,
    setRate,
    toggleLoop,
    setLeadIn,
    toggleCueFlag,
  };
}
