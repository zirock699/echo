import type { Course, Lesson, SortOption } from "../types";

export function sortCourses(
  courses: Course[],
  sortBy: SortOption,
  lessons: Map<string, Lesson[]>
): Course[] {
  const sorted = [...courses];

  switch (sortBy) {
    case "recent":
      return sorted.sort((a, b) => {
        const aTime = a.lastAccessedAt || 0;
        const bTime = b.lastAccessedAt || 0;
        return bTime - aTime;
      });

    case "alphabetical":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));

    case "progress":
      return sorted.sort((a, b) => {
        const aProgress = a.lessonsCount > 0 ? a.completedCount / a.lessonsCount : 0;
        const bProgress = b.lessonsCount > 0 ? b.completedCount / b.lessonsCount : 0;
        return bProgress - aProgress;
      });

    case "date-added":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);

    default:
      return sorted;
  }
}

export function matchesSearch(
  course: Course,
  query: string,
  courseLessons: Lesson[]
): boolean {
  const lowerQuery = query.toLowerCase();

  if (course.title.toLowerCase().includes(lowerQuery)) return true;
  if (course.description?.toLowerCase().includes(lowerQuery)) return true;
  if (course.category?.toLowerCase().includes(lowerQuery)) return true;
  if (course.tags.some((t) => t.toLowerCase().includes(lowerQuery))) return true;

  return courseLessons.some(
    (l) =>
      l.title.toLowerCase().includes(lowerQuery) ||
      l.channel?.toLowerCase().includes(lowerQuery)
  );
}
