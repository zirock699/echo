import { useState } from "react";
import type { Course, Lesson } from "../types";
import { Search, Upload } from "lucide-react";

interface LibraryProps {
  courses: Course[];
  lessons: Map<string, Lesson[]>;
  onSelectLesson: (lesson: Lesson) => void;
  onImport: (file: File) => void;
  onSelectCourse: (course: Course) => void;
}

export const Library = ({
  courses,
  lessons,
  onSelectLesson,
  onImport,
}: LibraryProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = "";
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Echo Studio</h1>

          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-violet-500 text-sm"
              />
            </div>

            <label className="px-4 py-2 bg-violet-600 rounded-lg font-medium cursor-pointer hover:bg-violet-700 transition flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>Import</span>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4">
          {filteredCourses.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-lg font-semibold mb-2">No courses found</h2>
              <p className="text-slate-400">Import a ZIP file to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  lessonsInCourse={lessons.get(course.id) || []}
                  onSelectLesson={onSelectLesson}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CourseCardProps {
  course: Course;
  lessonsInCourse: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
}

const CourseCard = ({
  course,
  lessonsInCourse,
  onSelectLesson,
}: CourseCardProps) => {
  const [showLessons, setShowLessons] = useState(false);
  const thumbnail = lessonsInCourse[0]?.thumbnailUrl;
  const progress = lessonsInCourse.length > 0
    ? Math.round((lessonsInCourse.filter((l) => l.isCompleted).length / lessonsInCourse.length) * 100)
    : 0;

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-slate-600 transition">
      {/* Course Header */}
      <button
        onClick={() => setShowLessons(!showLessons)}
        className="w-full text-left"
      >
        <div className="flex gap-4 p-4">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={course.title}
              className="w-16 h-16 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded bg-slate-700 flex-shrink-0" />
          )}

          <div className="flex-1">
            <h3 className="font-semibold mb-1">{course.title}</h3>
            <p className="text-sm text-slate-400 mb-2">
              {lessonsInCourse.length} {lessonsInCourse.length === 1 ? "lesson" : "lessons"}
            </p>

            {lessonsInCourse.length > 0 && (
              <div className="w-full bg-slate-700 rounded-full h-1">
                <div
                  className="bg-violet-600 h-1 rounded-full transition"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Lessons List */}
      {showLessons && lessonsInCourse.length > 0 && (
        <div className="border-t border-slate-700 bg-slate-900 max-h-64 overflow-y-auto">
          {lessonsInCourse.map((lesson) => (
            <button
              key={lesson.id}
              onClick={() => onSelectLesson(lesson)}
              className="w-full text-left px-4 py-3 border-b border-slate-700 last:border-0 hover:bg-slate-800 transition flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{lesson.title}</p>
                <p className="text-xs text-slate-400">
                  {lesson.durationSeconds > 0
                    ? `${Math.round(lesson.durationSeconds / 60)} min`
                    : "Unknown duration"}
                </p>
              </div>
              {lesson.isCompleted && (
                <span className="text-xs bg-green-600 px-2 py-1 rounded">Done</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
