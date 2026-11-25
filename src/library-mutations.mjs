const lessonAssetFields = ['audio', 'thumbnail', 'frame'];

export function isManagedMediaPath(path) {
  return typeof path === 'string' &&
    /^\/api\/audio\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(path);
}

/** Intrinsic library references, including an independently assigned course cover. */
export function mediaReferences(data) {
  const paths = new Set();
  const add = asset => {
    const url = asset?.url;
    if (isManagedMediaPath(url)) paths.add(url);
    else if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      // Preserve a local path if an older snapshot used an absolute asset URL.
      try {
        const {pathname} = new URL(url);
        if (isManagedMediaPath(pathname)) paths.add(pathname);
      } catch {}
    }
  };
  for (const lesson of data?.lessons ?? []) for (const field of lessonAssetFields) add(lesson[field]);
  for (const course of data?.courses ?? []) add(course.cover);
  return paths;
}

/** Queue only owned-path candidates with no remaining reference in this snapshot. */
export function queueUnreferencedMedia(data, urls = []) {
  const live = mediaReferences(data);
  const pending = new Set([...(data.pendingAudioDeletes ?? []), ...urls]
    .filter(url => isManagedMediaPath(url) && !live.has(url)));
  if (pending.size || data.pendingAudioDeletes) data.pendingAudioDeletes = [...pending];
}

/** Absent fields keep their assets. A new asset replaces one and null removes it. */
export function applyLessonAssetChanges(data, lesson, changes) {
  const released = [];
  for (const field of lessonAssetFields) {
    if (changes[field] === undefined) continue;
    const before = lesson[field]?.url;
    const after = changes[field];
    lesson[field] = after;
    if (before !== after?.url) released.push(before);
  }
  queueUnreferencedMedia(data, released);
}

export function removeLessons(data, ids) {
  const selected = new Set(ids);
  if (!selected.size) return;
  const released = [];
  data.lessons = data.lessons.filter(lesson => {
    if (!selected.has(lesson.id)) return true;
    for (const field of lessonAssetFields) released.push(lesson[field]?.url);
    return false;
  });
  for (const list of [...(data.courses ?? []), ...(data.collections ?? [])]) {
    list.lessonIds = list.lessonIds.filter(id => !selected.has(id));
  }
  data.sessions = data.sessions.filter(session => !selected.has(session.lessonId));
  if (selected.has(data.lastLessonId)) data.lastLessonId = null;
  const startup = data.preferences?.startupLesson;
  if (startup !== 'recent' && startup !== 'none' && selected.has(startup)) data.preferences.startupLesson = 'recent';
  queueUnreferencedMedia(data, released);
}

export function removeLesson(data, id) {
  removeLessons(data, [id]);
}
