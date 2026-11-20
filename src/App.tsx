import { useCallback, useEffect, useState } from "react";
import type { Course, Lesson } from "./types";
import { initDB, getAllCourses, getLessonsByCourse } from "./services/storage";
import { importZipFile } from "./services/zipImporter";
import { hydrateLessonsArtwork, resolveLessonAudioUrl } from "./services/mediaUrls";
import { Library } from "./components/Library";
import { Player } from "./components/Player";
import { MiniPlayer } from "./components/MiniPlayer";
import { usePlaybackController } from "./hooks/usePlaybackController";
import "./styles/globals.css";

type View = "library" | "player";

export default function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Map<string, Lesson[]>>(new Map());
  const [view, setView] = useState<View>("library");
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const controller = usePlaybackController();

  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        const allCourses = await getAllCourses();

        const lessonsMap = new Map<string, Lesson[]>();
        for (const course of allCourses) {
          const courseLessons = await getLessonsByCourse(course.id);
          const hydrated = await hydrateLessonsArtwork(courseLessons);
          lessonsMap.set(course.id, hydrated);
        }

        setCourses(allCourses);
        setLessons(lessonsMap);
      } catch (error) {
        console.error("Failed to initialize Echo Studio:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Keep the library's copy of the active lesson in sync when the player
  // mutates it (practised/difficult flags, resume position).
  useEffect(() => {
    if (!controller.lesson) return;
    const updated = controller.lesson;
    setLessons((prev) => {
      const courseLessons = prev.get(updated.courseId);
      if (!courseLessons) return prev;
      const next = new Map(prev);
      next.set(
        updated.courseId,
        courseLessons.map((l) => (l.id === updated.id ? updated : l))
      );
      return next;
    });
  }, [controller.lesson]);

  const handleSelectLesson = useCallback(
    async (lesson: Lesson) => {
      const audioUrl = await resolveLessonAudioUrl(lesson);
      if (!audioUrl) {
        setImportMessage(`"${lesson.title}" has no playable audio for this lesson.`);
        return;
      }
      controller.loadLesson(lesson, audioUrl);
      setView("player");
    },
    [controller]
  );

  const handleImport = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportMessage("");

    try {
      const result = await importZipFile(file);
      const hydratedLessons = await hydrateLessonsArtwork(result.lessons);

      setCourses((prev) => {
        const exists = prev.some((c) => c.id === result.course.id);
        return exists
          ? prev.map((c) => (c.id === result.course.id ? result.course : c))
          : [...prev, result.course];
      });

      setLessons((prev) => {
        const next = new Map(prev);
        next.set(result.course.id, hydratedLessons);
        return next;
      });

      const parts = [`Imported ${result.progress.imported} of ${result.progress.total} lessons`];
      const errorCount = Object.keys(result.errors).length;
      if (errorCount > 0) {
        parts.push(`${errorCount} lesson${errorCount > 1 ? "s" : ""} couldn't be imported`);
      }
      setImportMessage(parts.join(" · "));
    } catch (error) {
      setImportMessage(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsImporting(false);
    }
  }, []);

  useEffect(() => {
    if (!importMessage) return;
    const id = window.setTimeout(() => setImportMessage(""), 6000);
    return () => window.clearTimeout(id);
  }, [importMessage]);

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading Echo Studio…</p>
        </div>
      </div>
    );
  }

  const showPlayer = view === "player" && controller.lesson;

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 overflow-hidden relative">
      <div className={showPlayer ? "hidden" : "w-full h-full flex flex-col"}>
        <div className="flex-1 overflow-hidden">
          <Library
            courses={courses}
            lessons={lessons}
            onSelectLesson={handleSelectLesson}
            onImport={handleImport}
          />
        </div>

        {controller.lesson && (
          <MiniPlayer controller={controller} onExpand={() => setView("player")} />
        )}

        {(isImporting || importMessage) && (
          <div
            className={[
              "fixed left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2.5 rounded-full bg-slate-800 border border-white/10 text-sm text-slate-200 shadow-lg transition-[bottom]",
              controller.lesson ? "bottom-20" : "bottom-4",
            ].join(" ")}
          >
            {isImporting ? "Importing lessons…" : importMessage}
          </div>
        )}
      </div>

      {showPlayer && (
        <div className="absolute inset-0">
          <Player controller={controller} onBack={() => setView("library")} />
        </div>
      )}
    </div>
  );
}
