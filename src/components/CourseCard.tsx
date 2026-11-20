import { useState } from "react";
import { ChevronRight, Pin, Check } from "lucide-react";
import type { Course, Lesson } from "../types";
import { cn } from "../utils/cn";

interface CourseCardProps {
  course: Course;
  lessonsInCourse: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
}

export const CourseCard = ({
  course,
  lessonsInCourse,
  onSelectLesson,
}: CourseCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const thumbnail = course.coverUrl || lessonsInCourse[0]?.thumbnailUrl;
  const completed = lessonsInCourse.filter((l) => l.isCompleted).length;
  const progress =
    lessonsInCourse.length > 0 ? completed / lessonsInCourse.length : 0;

  return (
    <div className="group rounded-xl bg-slate-900/50 border border-white/5 overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] hover:border-white/10 transition-all duration-300">
      {/* Cover Image */}
      <button
        onClick={() =>
          lessonsInCourse[0] && onSelectLesson(lessonsInCourse[0])
        }
        className="relative w-full aspect-video overflow-hidden bg-slate-800"
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-700 to-fuchsia-700" />
        )}

        {/* Progress overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Pin indicator */}
        {course.isPinned && (
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center shadow-lg">
            <Pin className="w-4 h-4 text-white" fill="currentColor" />
          </div>
        )}
      </button>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-white text-sm line-clamp-1">
            {course.title}
          </h3>
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <ChevronRight
              className={cn(
                "w-4 h-4 transition-transform",
                expanded && "rotate-90"
              )}
            />
          </button>
        </div>

        {course.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-3">
            {course.description}
          </p>
        )}

        {/* Category badge */}
        {course.category && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-medium mb-3">
            {course.category}
          </span>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span>{lessonsInCourse.length} lessons</span>
          <span className="text-violet-400 font-semibold">
            {Math.round(progress * 100)}%
          </span>
        </div>

        {/* Tags */}
        {course.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {course.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 hover:text-slate-300 hover:bg-slate-700 transition-colors"
              >
                #{tag}
              </span>
            ))}
            {course.tags.length > 4 && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-500">
                +{course.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Expanded lesson list */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {lessonsInCourse.slice(0, 5).map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group/lesson focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <span className="text-xs text-slate-400 group-hover/lesson:text-white truncate flex-1">
                  {lesson.title}
                </span>
                {lesson.isCompleted && (
                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
              </button>
            ))}
            {lessonsInCourse.length > 5 && (
              <p className="text-xs text-slate-500 text-center pt-1">
                +{lessonsInCourse.length - 5} more
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
