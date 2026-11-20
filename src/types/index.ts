export interface TranscriptCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
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
