import { useEffect, useState } from "react";
import type { Course, Lesson } from "./types";
import { initDB, getAllCourses, getLessonsByCourse, getAsset } from "./services/storage";
import { importZipFile } from "./services/zipImporter";
import { Library } from "./components/Library";
import { Player } from "./components/Player";
import "./styles/globals.css";
import { X } from "lucide-react";

export default function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Map<string, Lesson[]>>(new Map());
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Initialize database and load data
  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        const allCourses = await getAllCourses();
        setCourses(allCourses);

        // Load lessons for each course
        const lessonsMap = new Map<string, Lesson[]>();
        for (const course of allCourses) {
          const courseLessons = await getLessonsByCourse(course.id);
          lessonsMap.set(course.id, courseLessons);
        }
        setLessons(lessonsMap);
      } catch (error) {
        console.error("Failed to initialize database:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Load audio URL when lesson is selected
  useEffect(() => {
    const loadAudio = async () => {
      if (selectedLesson) {
        if (selectedLesson.audioUrl) {
          setAudioUrl(selectedLesson.audioUrl);
        } else {
          // Try to load from storage
          const asset = await getAsset(selectedLesson.id, "audio");
          if (asset) {
            const url = URL.createObjectURL(asset.blob);
            setAudioUrl(url);
          }
        }
      }
    };

    loadAudio();
  }, [selectedLesson]);

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportError("");

    try {
      const result = await importZipFile(file);

      // Refresh courses and lessons
      setCourses((prev) => {
        const updated = prev.map((c) => (c.id === result.course.id ? result.course : c));
        if (!updated.find((c) => c.id === result.course.id)) {
          return [...updated, result.course];
        }
        return updated;
      });

      // Update lessons map
      setLessons((prev) => {
        const updated = new Map(prev);
        updated.set(result.course.id, result.lessons);
        return updated;
      });

      // Show success message
      const successMessage = `Imported ${result.progress.imported}/${result.progress.total} lessons`;
      if (Object.keys(result.errors).length > 0) {
        const errorMessage = Object.entries(result.errors)
          .slice(0, 2)
          .map(([folder, error]) => `${folder}: ${error}`)
          .join("; ");
        setImportError(`${successMessage}. Errors: ${errorMessage}`);
      }

      // Select first lesson if available
      if (result.lessons.length > 0) {
        setSelectedLesson(result.lessons[0]);
      }
    } catch (error) {
      setImportError(`Import failed: ${String(error)}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading Echo Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-950 flex">
      {/* Sidebar */}
      {selectedLesson ? (
        <div className="hidden md:flex md:w-80 flex-col border-r border-slate-700 bg-slate-900">
          <button
            onClick={() => setSelectedLesson(null)}
            className="px-4 py-3 text-left hover:bg-slate-800 border-b border-slate-700 font-medium flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Back to Library
          </button>
          {selectedLesson && (
            <div className="p-4 flex-1 overflow-y-auto">
              {selectedLesson.thumbnailUrl && (
                <img
                  src={selectedLesson.thumbnailUrl}
                  alt={selectedLesson.title}
                  className="w-full h-48 rounded-lg object-cover mb-4"
                />
              )}
              <h2 className="font-bold text-lg mb-2">{selectedLesson.title}</h2>
              <p className="text-sm text-slate-400 mb-4">{selectedLesson.channel}</p>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-slate-400">Cues:</span> {selectedLesson.transcriptCues.length}
                </p>
                <p>
                  <span className="text-slate-400">Duration:</span>{" "}
                  {Math.round(selectedLesson.durationSeconds / 60)} min
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full md:w-2/3 md:border-r md:border-slate-700 transition-all">
          <Library
            courses={courses}
            lessons={lessons}
            onSelectLesson={setSelectedLesson}
            onImport={handleImport}
            onSelectCourse={() => {}}
          />
          {importError && (
            <div className="fixed bottom-4 left-4 right-4 md:right-auto md:w-96 bg-red-900 text-red-100 p-4 rounded-lg">
              {importError}
            </div>
          )}
          {isImporting && (
            <div className="fixed bottom-4 left-4 right-4 md:right-auto md:w-96 bg-blue-900 text-blue-100 p-4 rounded-lg">
              Importing...
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {selectedLesson && audioUrl ? (
        <div className="flex-1 flex flex-col md:w-1/3">
          <div className="md:hidden p-4 border-b border-slate-700 flex items-center justify-between">
            <button
              onClick={() => setSelectedLesson(null)}
              className="text-violet-400 hover:text-violet-300"
            >
              ← Back
            </button>
            <h3 className="font-semibold text-sm truncate px-2">{selectedLesson.title}</h3>
            <div className="w-8" />
          </div>
          <Player lesson={selectedLesson} audioUrl={audioUrl} />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Welcome to Echo Studio</h2>
            <p className="text-slate-400 mb-6">Select a lesson to begin practising</p>
            <p className="text-sm text-slate-500">Or import a ZIP file to add new content</p>
          </div>
        </div>
      )}
    </div>
  );
}
