import type { Lesson, TranscriptCue } from "../types";

export class AudioSyncController {
  private audioElement: HTMLAudioElement | null = null;
  private currentCueIndex = 0;
  private onCueChange: ((cueIndex: number) => void) | null = null;
  private animationFrameId: number | null = null;
  private lesson: Lesson | null = null;

  initialize(audioUrl: string) {
    if (!this.audioElement) {
      this.audioElement = new Audio(audioUrl);
      this.audioElement.addEventListener("timeupdate", this.handleTimeUpdate.bind(this));
    }
  }

  setLesson(lesson: Lesson) {
    this.lesson = lesson;
    this.currentCueIndex = 0;
  }

  getCurrentCue(): TranscriptCue | null {
    if (!this.lesson || this.currentCueIndex >= this.lesson.transcriptCues.length) {
      return null;
    }
    return this.lesson.transcriptCues[this.currentCueIndex];
  }

  play() {
    if (this.audioElement) {
      this.audioElement.play().catch(() => {
        // Autoplay might be blocked
      });
    }
  }

  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  seek(time: number) {
    if (this.audioElement) {
      this.audioElement.currentTime = time;
      this.updateCueIndex();
    }
  }

  setPlaybackRate(rate: number) {
    if (this.audioElement) {
      this.audioElement.playbackRate = Math.max(0.5, Math.min(2, rate));
    }
  }

  getPlaybackRate(): number {
    return this.audioElement?.playbackRate || 1;
  }

  getCurrentTime(): number {
    return this.audioElement?.currentTime || 0;
  }

  getDuration(): number {
    return this.audioElement?.duration || 0;
  }

  nextCue() {
    if (this.lesson && this.currentCueIndex < this.lesson.transcriptCues.length - 1) {
      this.currentCueIndex++;
      const cue = this.getCurrentCue();
      if (cue) {
        this.seek(cue.startTime);
      }
    }
  }

  previousCue() {
    if (this.currentCueIndex > 0) {
      this.currentCueIndex--;
      const cue = this.getCurrentCue();
      if (cue) {
        this.seek(cue.startTime);
      }
    }
  }

  replayCue() {
    const cue = this.getCurrentCue();
    if (cue) {
      this.seek(cue.startTime);
      this.play();
    }
  }

  selectCue(index: number) {
    if (this.lesson && index >= 0 && index < this.lesson.transcriptCues.length) {
      this.currentCueIndex = index;
      const cue = this.getCurrentCue();
      if (cue) {
        this.seek(cue.startTime);
      }
    }
  }

  onCueChangeCallback(callback: (cueIndex: number) => void) {
    this.onCueChange = callback;
  }

  private handleTimeUpdate = () => {
    this.updateCueIndex();
  };

  private updateCueIndex() {
    if (!this.lesson || !this.audioElement) return;

    const currentTime = this.audioElement.currentTime;
    let newIndex = this.currentCueIndex;

    for (let i = 0; i < this.lesson.transcriptCues.length; i++) {
      const cue = this.lesson.transcriptCues[i];
      if (currentTime >= cue.startTime && currentTime < cue.endTime) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== this.currentCueIndex) {
      this.currentCueIndex = newIndex;
      if (this.onCueChange) {
        this.onCueChange(newIndex);
      }
    }
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = "";
    }
  }
}

export const createAudioSyncController = () => new AudioSyncController();
