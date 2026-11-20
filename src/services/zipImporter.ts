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

const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const importZipFile = async (
  zipFile: File,
  courseName?: string,
  existingCourseId?: string
): Promise<ImportResult> => {
  const zip = new JSZip();
  await zip.loadAsync(zipFile);

  const progress: ImportProgress = {
    total: 0,
    processed: 0,
    imported: 0,
    failed: 0,
    warnings: [],
  };

  const errors: { [key: string]: string } = {};
  const lessons: Lesson[] = [];

  // Detect structure
  const manifest = await loadManifest(zip);
  const structure = detectStructure(zip, manifest);

  progress.total = structure.lessons.length;

  let courseId = existingCourseId;
  let course: Course | null = null;

  if (!courseId) {
    const courseTitle = courseName || zipFile.name.replace(".zip", "").slice(0, 100);
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
      errors[lessonDir] = String(error);
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

const loadManifest = async (zip: JSZip): Promise<ZipMetadata[] | null> => {
  try {
    const manifestFile = zip.file("manifest.json") || zip.file("echo_media/manifest.json");
    if (manifestFile) {
      const content = await manifestFile.async("string");
      return JSON.parse(content);
    }
  } catch {
    // Manifest is optional
  }
  return null;
};

const detectStructure = (zip: JSZip, manifest: ZipMetadata[] | null) => {
  const lessons: string[] = [];

  if (manifest && Array.isArray(manifest)) {
    manifest.forEach((m) => {
      if (m.video_id) {
        lessons.push(m.video_id);
      }
    });
  } else {
    // Auto-discover folders
    zip.forEach((relativePath) => {
      const depth = relativePath.split("/").length;
      if (depth === 2) {
        const folder = relativePath.split("/")[0];
        if (!folder.startsWith(".") && folder !== "echo_media" && !lessons.includes(folder)) {
          lessons.push(folder);
        }
      } else if (depth === 3 && relativePath.includes("echo_media/")) {
        const folder = relativePath.split("/")[1];
        if (!folder.startsWith(".") && !lessons.includes(folder)) {
          lessons.push(folder);
        }
      }
    });
  }

  return { lessons: [...new Set(lessons)] };
};

const processLesson = async (
  zip: JSZip,
  folderName: string,
  courseId: string
): Promise<Lesson | null> => {
  const basePrefix = findFolderPrefix(zip, folderName);
  const metadataPath = `${basePrefix}metadata.json`;

  let metadata: ZipMetadata = {
    video_id: folderName,
    title: folderName,
  };

  // Try to load metadata
  const metadataFile = zip.file(metadataPath);
  if (metadataFile) {
    try {
      const content = await metadataFile.async("string");
      metadata = JSON.parse(content);
    } catch (error) {
      // Metadata parse failed, continue with defaults
    }
  }

  // Load audio
  const audioPath = metadata.audio ? findFile(zip, metadata.audio) : findFile(zip, `${basePrefix}audio.mp3`);
  if (!audioPath) {
    throw new Error("Audio file not found");
  }

  const audioFile = zip.file(audioPath);
  if (!audioFile) {
    throw new Error("Audio file cannot be read");
  }

  const audioBlob = await audioFile.async("blob");

  // Load transcript
  let transcriptCues: ReturnType<typeof parseSRT> = [];
  const transcriptPath = metadata.transcript ? findFile(zip, metadata.transcript) : findFile(zip, `${basePrefix}transcript.srt`);
  if (transcriptPath) {
    try {
      const transcriptFile = zip.file(transcriptPath);
      if (transcriptFile) {
        const transcriptContent = await transcriptFile.async("string");
        transcriptCues = parseSRT(transcriptContent);
      }
    } catch (error) {
      // Transcript parsing failed, continue without it
    }
  }

  // Load images
  const thumbnailPath = metadata.thumbnail ? findFile(zip, metadata.thumbnail) : findFile(zip, `${basePrefix}thumbnail.jpg`);
  const framePath = metadata.frame ? findFile(zip, metadata.frame) : findFile(zip, `${basePrefix}frame.jpg`);

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

  // Store assets
  if (audioBlob) {
    lesson.audioUrl = URL.createObjectURL(audioBlob);
    await saveAsset({
      lessonId: lesson.id,
      type: "audio",
      blob: audioBlob,
      mimeType: "audio/mpeg",
    });
  }

  if (thumbnailPath) {
    const thumbFile = zip.file(thumbnailPath);
    if (thumbFile) {
      const thumbBlob = await thumbFile.async("blob");
      lesson.thumbnailUrl = URL.createObjectURL(thumbBlob);
      await saveAsset({
        lessonId: lesson.id,
        type: "thumbnail",
        blob: thumbBlob,
        mimeType: "image/jpeg",
      });
    }
  }

  if (framePath) {
    const frameFile = zip.file(framePath);
    if (frameFile) {
      const frameBlob = await frameFile.async("blob");
      lesson.frameUrl = URL.createObjectURL(frameBlob);
      await saveAsset({
        lessonId: lesson.id,
        type: "frame",
        blob: frameBlob,
        mimeType: "image/jpeg",
      });
    }
  }

  return lesson;
};

const findFolderPrefix = (zip: JSZip, folderName: string): string => {
  const folders = new Set<string>();
  zip.forEach((path) => {
    if (path.includes(folderName)) {
      const match = path.match(`^(.*${folderName}/?)`);
      if (match) {
        folders.add(match[1]);
      }
    }
  });

  // Return the shortest matching prefix (most specific)
  return Array.from(folders).sort((a, b) => a.length - b.length)[0] || `${folderName}/`;
};

const findFile = (zip: JSZip, possiblePath: string): string | null => {
  const candidates = [
    possiblePath,
    possiblePath.replace(/\\/g, "/"),
    `echo_media/${possiblePath}`,
    `echo_media/${possiblePath.replace(/^.*\//, "")}`,
  ];

  for (const candidate of candidates) {
    if (zip.file(candidate)) {
      return candidate;
    }
  }

  return null;
};

const loadCourseById = async (courseId: string) => {
  const course = await getCourse(courseId);
  return course || {
    id: courseId,
    title: "New Course",
    tags: [],
    isPinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lessonsCount: 0,
    completedCount: 0,
  };
};
