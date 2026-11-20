import JSZip from "jszip";
import type { Lesson, Course, ImportProgress } from "../types";
import { parseSRT } from "./srtParser";
import { saveLesson, saveCourse, saveAsset, getCourse } from "./storage";

export interface ImportResult {
  course: Course;
  lessons: Lesson[];
  progress: ImportProgress;
  errors: { [key: string]: string };
}

interface ZipMetadata {
  video_id: string;
  youtube_url?: string;
  title: string;
  channel?: string;
  duration_seconds?: number;
  caption_source?: string;
  caption_language?: string;
  audio?: string;
  thumbnail?: string;
  frame?: string;
  transcript?: string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * The ZIP spec mandates forward-slash path separators, but some Windows
 * tools (PowerShell's Compress-Archive in particular) write backslashes
 * instead. Building one normalized index up front means every lookup below
 * works regardless of which separator the archive actually used.
 */
class ZipIndex {
  readonly paths: string[];
  private readonly realKeyByNormalized: Map<string, string>;
  private readonly zip: JSZip;

  constructor(zip: JSZip) {
    this.zip = zip;
    this.realKeyByNormalized = new Map();
    zip.forEach((relativePath) => {
      this.realKeyByNormalized.set(normalize(relativePath), relativePath);
    });
    this.paths = Array.from(this.realKeyByNormalized.keys());
  }

  file(normalizedPath: string) {
    const realKey = this.realKeyByNormalized.get(normalize(normalizedPath));
    return realKey ? this.zip.file(realKey) : null;
  }

  has(normalizedPath: string) {
    return this.realKeyByNormalized.has(normalize(normalizedPath));
  }
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/");
}

export const importZipFile = async (
  zipFile: File,
  courseName?: string,
  existingCourseId?: string
): Promise<ImportResult> => {
  const rawZip = new JSZip();
  await rawZip.loadAsync(zipFile);
  const zip = new ZipIndex(rawZip);

  const progress: ImportProgress = {
    total: 0,
    processed: 0,
    imported: 0,
    failed: 0,
    warnings: [],
  };

  const errors: { [key: string]: string } = {};
  const lessons: Lesson[] = [];

  const manifest = await loadManifest(zip);
  const structure = detectStructure(zip, manifest);

  progress.total = structure.lessons.length;

  let courseId = existingCourseId;
  let course: Course | null = null;

  if (!courseId) {
    const courseTitle = courseName || zipFile.name.replace(/\.zip$/i, "").slice(0, 100);
    course = {
      id: generateId(),
      title: courseTitle,
      tags: [],
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lessonsCount: 0,
      completedCount: 0,
    };
    courseId = course.id;
    await saveCourse(course);
  }

  if (structure.lessons.length === 0) {
    errors["(archive)"] =
      "No lesson folders were found in this ZIP. Expected a manifest.json or per-video folders containing audio.mp3.";
  }

  for (const lessonDir of structure.lessons) {
    progress.processed++;
    try {
      const lesson = await processLesson(zip, lessonDir, courseId);
      if (lesson) {
        lessons.push(lesson);
        await saveLesson(lesson);
        progress.imported++;
      }
    } catch (error) {
      errors[lessonDir] = error instanceof Error ? error.message : String(error);
      progress.failed++;
    }
  }

  if (course) {
    course.lessonsCount = progress.imported;
    await saveCourse(course);
  }

  return {
    course: course || (await loadCourseById(courseId)),
    lessons,
    progress,
    errors,
  };
};

const loadManifest = async (zip: ZipIndex): Promise<ZipMetadata[] | null> => {
  try {
    const manifestFile = zip.file("manifest.json") || zip.file("echo_media/manifest.json");
    if (manifestFile) {
      const content = await manifestFile.async("string");
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : null;
    }
  } catch {
    // Manifest is optional — fall back to folder discovery.
  }
  return null;
};

const detectStructure = (zip: ZipIndex, manifest: ZipMetadata[] | null) => {
  const lessons: string[] = [];

  if (manifest && manifest.length > 0) {
    manifest.forEach((m) => {
      if (m.video_id) lessons.push(m.video_id);
    });
    return { lessons: [...new Set(lessons)] };
  }

  // Auto-discover folders by walking the normalized path list.
  zip.paths.forEach((relativePath) => {
    const segments = relativePath.split("/").filter(Boolean);
    const depth = segments.length;

    if (depth === 2) {
      const folder = segments[0];
      if (!folder.startsWith(".") && folder !== "echo_media" && !lessons.includes(folder)) {
        lessons.push(folder);
      }
    } else if (depth === 3 && segments[0] === "echo_media") {
      const folder = segments[1];
      if (!folder.startsWith(".") && !lessons.includes(folder)) {
        lessons.push(folder);
      }
    }
  });

  return { lessons: [...new Set(lessons)] };
};

const processLesson = async (
  zip: ZipIndex,
  folderName: string,
  courseId: string
): Promise<Lesson | null> => {
  const basePrefix = findFolderPrefix(zip, folderName);
  const metadataPath = `${basePrefix}metadata.json`;

  let metadata: ZipMetadata = {
    video_id: folderName,
    title: folderName,
  };

  const metadataFile = zip.file(metadataPath);
  if (metadataFile) {
    try {
      const content = await metadataFile.async("string");
      metadata = { ...metadata, ...JSON.parse(content) };
    } catch {
      // Metadata parse failed — continue with the folder-derived defaults.
    }
  }

  const audioPath = metadata.audio
    ? findFile(zip, metadata.audio, basePrefix)
    : findFile(zip, "audio.mp3", basePrefix);
  if (!audioPath) {
    throw new Error("Audio file not found");
  }

  const audioFile = zip.file(audioPath);
  if (!audioFile) {
    throw new Error("Audio file cannot be read");
  }

  const audioBlob = await audioFile.async("blob");

  let transcriptCues: ReturnType<typeof parseSRT> = [];
  const transcriptPath = metadata.transcript
    ? findFile(zip, metadata.transcript, basePrefix)
    : findFile(zip, "transcript.srt", basePrefix);
  if (transcriptPath) {
    try {
      const transcriptFile = zip.file(transcriptPath);
      if (transcriptFile) {
        const transcriptContent = await transcriptFile.async("string");
        transcriptCues = parseSRT(transcriptContent);
      }
    } catch {
      // Transcript parsing failed — import the audio anyway, without cues.
    }
  }

  const thumbnailPath = metadata.thumbnail
    ? findFile(zip, metadata.thumbnail, basePrefix)
    : findFile(zip, "thumbnail.jpg", basePrefix);
  const framePath = metadata.frame
    ? findFile(zip, metadata.frame, basePrefix)
    : findFile(zip, "frame.jpg", basePrefix);

  const lesson: Lesson = {
    id: generateId(),
    courseId,
    videoId: metadata.video_id || folderName,
    title: metadata.title || folderName,
    channel: metadata.channel,
    youtubeUrl: metadata.youtube_url,
    durationSeconds: metadata.duration_seconds || 0,
    captionSource: metadata.caption_source,
    captionLanguage: metadata.caption_language,
    transcriptCues,
    importedAt: Date.now(),
    practisedCount: 0,
    isCompleted: false,
    tags: [],
  };

  // Store assets. URLs are resolved on demand via mediaUrls.ts rather than
  // persisted here, since blob: URLs don't survive a page reload.
  await saveAsset({
    lessonId: lesson.id,
    type: "audio",
    blob: audioBlob,
    mimeType: "audio/mpeg",
  });

  if (thumbnailPath) {
    const thumbFile = zip.file(thumbnailPath);
    if (thumbFile) {
      const thumbBlob = await thumbFile.async("blob");
      await saveAsset({ lessonId: lesson.id, type: "thumbnail", blob: thumbBlob, mimeType: "image/jpeg" });
    }
  }

  if (framePath) {
    const frameFile = zip.file(framePath);
    if (frameFile) {
      const frameBlob = await frameFile.async("blob");
      await saveAsset({ lessonId: lesson.id, type: "frame", blob: frameBlob, mimeType: "image/jpeg" });
    }
  }

  return lesson;
};

/** Finds the directory prefix (e.g. "echo_media/testVideo001/") that contains `folderName`. */
const findFolderPrefix = (zip: ZipIndex, folderName: string): string => {
  const escaped = folderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^(.*?${escaped}/)`);

  const candidates = zip.paths
    .map((p) => p.match(pattern)?.[1])
    .filter((p): p is string => Boolean(p));

  return candidates.sort((a, b) => a.length - b.length)[0] || `${folderName}/`;
};

/**
 * Resolves a file referenced by metadata (paths are relative to the
 * `echo_media` root, not the lesson's own folder) or falls back to the
 * conventional filename inside the lesson's folder.
 */
const findFile = (zip: ZipIndex, referencedPath: string, basePrefix: string): string | null => {
  const bareName = referencedPath.replace(/^.*\//, "");
  const candidates = [
    referencedPath,
    `echo_media/${referencedPath}`,
    `${basePrefix}${bareName}`,
  ];

  for (const candidate of candidates) {
    if (zip.has(candidate)) return candidate;
  }

  return null;
};

const loadCourseById = async (courseId: string) => {
  const course = await getCourse(courseId);
  return (
    course || {
      id: courseId,
      title: "New Course",
      tags: [],
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lessonsCount: 0,
      completedCount: 0,
    }
  );
};
