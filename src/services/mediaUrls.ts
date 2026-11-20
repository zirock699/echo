import type { Lesson } from "../types";
import { getAsset } from "./storage";

type AssetType = "audio" | "thumbnail" | "frame";

// Blob URLs only live for the current page session. We cache them here keyed
// by lesson+type so repeated lookups (e.g. re-opening the library) don't
// create duplicate object URLs for the same underlying blob.
const urlCache = new Map<string, string>();

async function getCachedAssetUrl(lessonId: string, type: AssetType): Promise<string | undefined> {
  const key = `${lessonId}:${type}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const asset = await getAsset(lessonId, type);
  if (!asset) return undefined;

  const url = URL.createObjectURL(asset.blob);
  urlCache.set(key, url);
  return url;
}

/**
 * Lessons loaded from IndexedDB may carry stale blob: URLs from a previous
 * page session (those registrations die on reload even though the string
 * survives). This always re-resolves thumbnail/frame artwork from the asset
 * store so the library never shows a broken image after a refresh.
 */
export async function hydrateLessonArtwork(lesson: Lesson): Promise<Lesson> {
  const [thumbnailUrl, frameUrl] = await Promise.all([
    getCachedAssetUrl(lesson.id, "thumbnail"),
    getCachedAssetUrl(lesson.id, "frame"),
  ]);
  return { ...lesson, thumbnailUrl, frameUrl };
}

export async function hydrateLessonsArtwork(lessons: Lesson[]): Promise<Lesson[]> {
  return Promise.all(lessons.map(hydrateLessonArtwork));
}

/** Resolves (and caches) a playable audio URL for a lesson. Audio is loaded
 * lazily — only when a lesson is actually opened — to avoid decoding/holding
 * every lesson's audio blob in memory while browsing the library. */
export async function resolveLessonAudioUrl(lesson: Lesson): Promise<string | null> {
  const url = await getCachedAssetUrl(lesson.id, "audio");
  return url ?? null;
}
