export interface TranscriptCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  practised?: boolean;
  difficult?: boolean;
}

export interface Lesson {
  id: string;
  courseId: string;
  videoId: string;
  title: string;
  channel?: string;
  youtubeUrl?: string;
  durationSeconds: number;
  captionSource?: string;
  captionLanguage?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  thumbnailUrl?: string;
  frameUrl?: string;
  transcriptText?: string;
  transcriptCues: TranscriptCue[];
  importedAt: number;
  lastPlayedAt?: number;
  lastPlayedPosition?: number;
  lastCueIndex?: number;
  practisedCount: number;
  isCompleted: boolean;
  tags: string[];
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  category?: string;
  tags: string[];
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  lessonsCount: number;
  completedCount: number;
  lastAccessedAt?: number;
}

export interface StoredAsset {
  lessonId: string;
  type: "audio" | "thumbnail" | "frame";
  blob: Blob;
  mimeType: string;
}

export interface ImportProgress {
  total: number;
  processed: number;
  imported: number;
  failed: number;
  warnings: string[];
}

export type PlaybackMode = "manual" | "automatic" | "continuous";

export type PlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "pending-advance"
  | "ended";

export const LEAD_IN_OPTIONS = [0, 0.25, 0.5, 1, 2] as const;
export type LeadInSeconds = (typeof LEAD_IN_OPTIONS)[number];

export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];
