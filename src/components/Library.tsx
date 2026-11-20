import { useMemo, useState } from "react";
import type { Course, Lesson } from "../types";
import { Search, UploadCloud, ChevronRight, Check } from "lucide-react";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes} min${seconds > 0 ? ` ${seconds}s` : ""}`;
}

interface LibraryProps {
  courses: Course[];
  lessons: Map<string, Lesson[]>;
  onSelectLesson: (lesson: Lesson) => void;
  onImport: (file: File) => void;
}

export const Library = ({ courses, lessons, onSelectLesson, onImport }: LibraryProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const allLessons = useMemo(() => Array.from(lessons.values()).flat(), [lessons]);

  const continueListening = useMemo(
    () =>
      allLessons
        .filter((l) => l.lastPlayedAt && !l.isCompleted)
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
        .slice(0, 6),
    [allLessons]
  );

  const query = searchQuery.trim().toLowerCase();
  const filteredCourses = courses.filter((c) => {
    if (!query) return true;
    if (c.title.toLowerCase().includes(query)) return true;
    if (c.tags.some((t) => t.toLowerCase().includes(query))) return true;
    const courseLessons = lessons.get(c.id) || [];
    return courseLessons.some(
      (l) => l.title.toLowerCase().includes(query) || l.channel?.toLowerCase().includes(query)
    );
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = "";
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 bg-slate-950/95 backdrop-blur-sm px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-white tracking-tight">Echo Studio</h1>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium cursor-pointer transition active:scale-95">
            <UploadCloud className="w-4 h-4" />
            Import
            <input type="file" accept=".zip" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search courses and lessons"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.07] transition"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {courses.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <div className="px-4 py-5 space-y-7">
            {continueListening.length > 0 && !query && (
              <section>
                <h2 className="text-sm font-semibold text-slate-300 mb-3">Continue listening</h2>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
                  {continueListening.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => onSelectLesson(lesson)}
                      className="shrink-0 w-36 text-left snap-start group"
                    >
                      <div className="w-36 h-36 rounded-xl overflow-hidden bg-slate-800 mb-2 relative">
                        {lesson.thumbnailUrl ? (
                          <img
                            src={lesson.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-violet-700 to-fuchsia-700" />
                        )}
                        {lesson.transcriptCues.length > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                            <div
                              className="h-full bg-violet-400"
                              style={{
                                width: `${Math.round(
                                  (lesson.practisedCount / lesson.transcriptCues.length) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
                      <p className="text-xs text-slate-500 truncate">{lesson.channel}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-sm font-semibold text-slate-300 mb-3">
                {query ? "Results" : "Your courses"}
              </h2>
              {filteredCourses.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-slate-400 text-sm">No matches for "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-violet-400 text-sm hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCourses.map((course) => (
                    <CourseRow
                      key={course.id}
                      course={course}
                      lessonsInCourse={lessons.get(course.id) || []}
                      onSelectLesson={onSelectLesson}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyLibrary = () => (
  <div className="flex flex-col items-center justify-center text-center px-8 py-20">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center mb-4">
      <UploadCloud className="w-7 h-7 text-white" />
    </div>
    <h2 className="text-lg font-semibold text-white mb-1.5">Your library is empty</h2>
    <p className="text-sm text-slate-400 max-w-xs">
      Import a ZIP file produced by your lesson tool to start building your speech-shadowing
      library.
    </p>
  </div>
);

interface CourseRowProps {
  course: Course;
  lessonsInCourse: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
}

const CourseRow = ({ course, lessonsInCourse, onSelectLesson }: CourseRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const thumbnail = lessonsInCourse[0]?.thumbnailUrl;
  const completed = lessonsInCourse.filter((l) => l.isCompleted).length;
  const progress = lessonsInCourse.length > 0 ? completed / lessonsInCourse.length : 0;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.04] transition text-left"
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-700 to-fuchsia-700" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate text-sm">{course.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {lessonsInCourse.length} {lessonsInCourse.length === 1 ? "lesson" : "lessons"}
            {completed > 0 && ` · ${completed} completed`}
          </p>
          {lessonsInCourse.length > 0 && (
            <div className="w-full bg-white/5 rounded-full h-1 mt-1.5 max-w-[160px]">
              <div
                className="bg-violet-500 h-1 rounded-full transition-[width]"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>

        <ChevronRight
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-white/5">
          {lessonsInCourse.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-500">No lessons in this course.</p>
          ) : (
            lessonsInCourse.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition border-b border-white/[0.03] last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{lesson.title}</p>
                  <p className="text-xs text-slate-500">
                    {lesson.durationSeconds > 0 ? formatDuration(lesson.durationSeconds) : "Duration unknown"}
                    {lesson.transcriptCues.length === 0 && " · no transcript"}
                  </p>
                </div>
                {lesson.isCompleted && (
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
