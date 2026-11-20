import { useMemo, useState } from "react";
import type { Course, Lesson, CourseStatus, SortOption } from "../types";
import { getCourseStatus } from "../types";
import { Search, UploadCloud, ChevronRight, Check, Grid, List, Pin, Clock, CheckCircle2 } from "lucide-react";
import { FilterPill } from "./ui/FilterPill";
import { SortDropdown } from "./ui/SortDropdown";
import { CourseCard } from "./CourseCard";
import { EmptyState } from "./EmptyState";
import { cn } from "../utils/cn";
import { sortCourses, matchesSearch } from "../utils/sorting";
import { formatRelativeTime } from "../utils/formatters";

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
  const [activeFilters, setActiveFilters] = useState<Set<CourseStatus>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const allLessons = useMemo(() => Array.from(lessons.values()).flat(), [lessons]);

  const continueListening = useMemo(
    () =>
      allLessons
        .filter((l) => l.lastPlayedAt && !l.isCompleted)
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
        .slice(0, 6),
    [allLessons]
  );

  const filteredAndSorted = useMemo(() => {
    let filtered = courses.filter(c => {
      // Search filtering
      const query = searchQuery.trim().toLowerCase();
      if (query && !matchesSearch(c, query, lessons.get(c.id) || [])) return false;

      // Status filtering
      if (activeFilters.size > 0) {
        const status = getCourseStatus(c, lessons.get(c.id) || []);
        if (!activeFilters.has(status)) return false;
      }

      return true;
    });

    return sortCourses(filtered, sortBy, lessons);
  }, [courses, searchQuery, activeFilters, sortBy, lessons]);

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
          <div className="flex items-center gap-2">
            <SortDropdown value={sortBy} onChange={setSortBy} />
            <div className="hidden md:flex items-center gap-1 bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded transition-colors',
                  viewMode === 'list' ? 'bg-violet-500/20 text-violet-400' : 'text-slate-400 hover:text-white'
                )}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded transition-colors',
                  viewMode === 'grid' ? 'bg-violet-500/20 text-violet-400' : 'text-slate-400 hover:text-white'
                )}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium cursor-pointer transition active:scale-95">
              <UploadCloud className="w-4 h-4" />
              Import
              <input type="file" accept=".zip" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
          <FilterPill
            label="Pinned"
            active={activeFilters.has('pinned')}
            count={courses.filter(c => c.isPinned).length}
            onClick={() => {
              const newFilters = new Set(activeFilters);
              if (newFilters.has('pinned')) newFilters.delete('pinned');
              else newFilters.add('pinned');
              setActiveFilters(newFilters);
            }}
            icon={<Pin className="w-3.5 h-3.5" />}
          />
          <FilterPill
            label="In Progress"
            active={activeFilters.has('in-progress')}
            count={courses.filter(c => getCourseStatus(c, lessons.get(c.id) || []) === 'in-progress').length}
            onClick={() => {
              const newFilters = new Set(activeFilters);
              if (newFilters.has('in-progress')) newFilters.delete('in-progress');
              else newFilters.add('in-progress');
              setActiveFilters(newFilters);
            }}
            icon={<Clock className="w-3.5 h-3.5" />}
          />
          <FilterPill
            label="Not Started"
            active={activeFilters.has('not-started')}
            count={courses.filter(c => getCourseStatus(c, lessons.get(c.id) || []) === 'not-started').length}
            onClick={() => {
              const newFilters = new Set(activeFilters);
              if (newFilters.has('not-started')) newFilters.delete('not-started');
              else newFilters.add('not-started');
              setActiveFilters(newFilters);
            }}
          />
          <FilterPill
            label="Completed"
            active={activeFilters.has('completed')}
            count={courses.filter(c => getCourseStatus(c, lessons.get(c.id) || []) === 'completed').length}
            onClick={() => {
              const newFilters = new Set(activeFilters);
              if (newFilters.has('completed')) newFilters.delete('completed');
              else newFilters.add('completed');
              setActiveFilters(newFilters);
            }}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          />
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
            {continueListening.length > 0 && !searchQuery && (
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
                {searchQuery ? "Results" : activeFilters.size > 0 ? "Filtered courses" : "Your courses"}
              </h2>
              {filteredAndSorted.length === 0 ? (
                <EmptyState
                  icon={<UploadCloud className="w-7 h-7 text-violet-400" />}
                  title="No courses found"
                  description={
                    searchQuery
                      ? `No courses match "${searchQuery}"`
                      : activeFilters.size > 0
                      ? "Try adjusting your filters"
                      : "Import a ZIP file to get started"
                  }
                  action={
                    searchQuery || activeFilters.size > 0
                      ? {
                          label: "Clear filters",
                          onClick: () => {
                            setSearchQuery("");
                            setActiveFilters(new Set());
                          }
                        }
                      : undefined
                  }
                />
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSorted.map(course => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      lessonsInCourse={lessons.get(course.id) || []}
                      onSelectLesson={onSelectLesson}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAndSorted.map((course) => (
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
  const status = getCourseStatus(course, lessonsInCourse);

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-all",
      "bg-white/[0.03] border-white/5 hover:border-white/10 hover:bg-white/[0.05]",
      course.isPinned && "ring-1 ring-violet-500/20"
    )}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        {/* Pin indicator */}
        {course.isPinned && (
          <div className="shrink-0">
            <Pin className="w-4 h-4 text-violet-400" fill="currentColor" />
          </div>
        )}

        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-700 to-fuchsia-700" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-white truncate text-sm">{course.title}</p>
            {status === 'completed' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
          </div>

          <p className="text-xs text-slate-500 mb-1">
            {lessonsInCourse.length} {lessonsInCourse.length === 1 ? "lesson" : "lessons"}
            {completed > 0 && ` · ${completed} completed`}
            {course.lastAccessedAt && ` · ${formatRelativeTime(course.lastAccessedAt)}`}
          </p>

          {lessonsInCourse.length > 0 && (
            <div className="w-full bg-white/5 rounded-full h-1 max-w-[160px]">
              <div
                className="bg-violet-500 h-1 rounded-full transition-[width]"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>

        <ChevronRight
          className={cn("w-4 h-4 text-slate-500 shrink-0 transition-transform", expanded && "rotate-90")}
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
