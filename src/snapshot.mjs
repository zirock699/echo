/** Validate the JSON shared by library backup, browser storage and the state API. */
export function validateSnapshot(data) {
  const text = value => typeof value === 'string';
  const number = Number.isFinite;
  const boolean = value => typeof value === 'boolean';
  const record = value => value !== null && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const nullable = check => value => value === null || check(value);
  const id = value => text(value) && value.trim() !== '' && !/[\x00-\x1f\x7f]/.test(value) &&
    !Object.hasOwn(Object.prototype, value);

  function require(condition, field) {
    if (!condition) throw new Error(`Invalid library snapshot: ${field}.`);
  }

  function fields(value, checks, label) {
    require(record(value), label);
    for (const [name, check] of Object.entries(checks)) {
      if (Object.hasOwn(value, name) && value[name] !== undefined) require(check(value[name]), `${label} ${name}`);
    }
  }

  function array(value, check, label) {
    require(Array.isArray(value), label);
    for (const item of value) require(check(item), label);
    return true;
  }

  function dictionary(value, check, label) {
    require(record(value), label);
    for (const item of Object.values(value)) require(check(item), label);
    return true;
  }

  // Untyped legacy metadata round-trips, but must still be plain JSON. Old
  // snapshots are spread or copied into ordinary records during migration.
  function plainJSON(value, depth = 0) {
    require(depth <= 32, 'metadata nesting');
    if (value === null || value === undefined || text(value) || number(value) || boolean(value)) return;
    if (Array.isArray(value)) {
      for (const item of value) plainJSON(item, depth + 1);
      return;
    }
    require(record(value) && !Object.hasOwn(value, '__proto__'), 'metadata record');
    for (const item of Object.values(value)) plainJSON(item, depth + 1);
  }

  const identifiers = value => array(value, id, 'identifier list');
  const strings = value => array(value, text, 'text list');
  const localMedia = value => text(value) && /^\/api\/audio\/[a-z0-9_-]+$/i.test(value);
  function webURL(value) {
    if (!text(value) || !/^https?:\/\//i.test(value)) return false;
    try {
      const url = new URL(value);
      return !!url.hostname && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  const imageURL = value => localMedia(value) || webURL(value);

  function asset(value, checkURL, label) {
    if (value === null) return true;
    fields(value, {id, url: nullable(checkURL), name: text, size: size => number(size) && size >= 0, type: text}, label);
    return true;
  }

  function words(value) {
    return array(value, word => {
      fields(word, {text, start: number, end: number}, 'word timing');
      require(number(word.start) && number(word.end) && word.start >= -.1 && word.end > word.start, 'word timing range');
      return text(word.text);
    }, 'word timings');
  }

  function cues(value) {
    return array(value, cue => {
      fields(cue, {id, text, speaker: nullable(text), start: number, end: number, words: nullable(words), segmentIds: identifiers, timingEstimated: boolean}, 'cue');
      // Older imports can round a positive sub-millisecond interval to one timestamp.
      require(number(cue.start) && number(cue.end) && cue.start >= 0 && cue.end >= cue.start, 'cue timing range');
      return id(cue.id) && text(cue.text);
    }, 'cues');
  }

  function statuses(value) {
    return dictionary(value, status => {
      fields(status, {practised: boolean, difficult: boolean, updatedAt: number}, 'phrase status');
      return true;
    }, 'phrase statuses');
  }

  function progress(value) {
    const coverage = intervals => array(intervals, interval => Array.isArray(interval) && interval.length === 2 &&
      interval.every(number) && interval[1] >= interval[0], 'listening coverage');
    fields(value, {position: number, phraseId: nullable(id), updatedAt: number, coverage}, 'lesson progress');
    return true;
  }

  const revisionFields = {phrases: cues, segments: cues, statuses, grouping: text, source: nullable(text), format: nullable(text), offset: number, at: number, kind: text};
  function revision(value, backup = false) {
    const checks = backup ? {...revisionFields, progress} : revisionFields;
    fields(value, checks, 'transcript revision');
    // Undo assigns a revision onto its lesson, so revisions may only carry
    // the transcript fields it is intended to restore.
    require(Object.keys(value).every(key => Object.hasOwn(checks, key)), 'transcript revision fields');
    return Array.isArray(value.phrases);
  }

  function palette(value) {
    fields(value, {version: number, videoId: nullable(text), source: text, colours: strings}, 'artwork palette');
    return true;
  }

  function lesson(value) {
    fields(value, {
      id, title: text, videoId: nullable(text), youtubeUrl: nullable(webURL), speaker: nullable(text),
      channel: nullable(text), category: nullable(text), tags: nullable(strings), courseId: nullable(id),
      source: nullable(text), format: nullable(text), grouping: text, mediaSource: text, audioOffset: number,
      offset: number, duration: nullable(number), createdAt: number, updatedAt: number, importedAt: number,
      favourite: boolean, pinned: boolean, completed: boolean, segments: cues, phrases: cues, statuses, progress,
      ipaOverrides: overrides => dictionary(overrides, text, 'pronunciation overrides'),
      pauseOverrides: overrides => dictionary(overrides, nullable(number), 'pause overrides'),
      revisions: values => array(values, entry => revision(entry), 'transcript revisions'),
      playbackRecoveryBackup: backup => revision(backup, true),
      audio: value => asset(value, localMedia, 'audio attachment'),
      thumbnail: value => asset(value, imageURL, 'thumbnail'), frame: value => asset(value, imageURL, 'frame'),
      ambientPalette: nullable(palette), transcriptWarnings: strings,
    }, 'lesson');
    return id(value.id);
  }

  function course(value) {
    fields(value, {
      id, title: text, description: nullable(text), category: nullable(text), tags: nullable(strings),
      cover: value => asset(value, imageURL, 'course cover'), pinned: boolean,
      createdAt: number, updatedAt: number, lastPlayedAt: number, lessonIds: identifiers,
    }, 'course');
    return id(value.id) && Array.isArray(value.lessonIds);
  }

  function collection(value) {
    fields(value, {id, name: text, lessonIds: identifiers, createdAt: number, updatedAt: number}, 'collection');
    return id(value.id) && text(value.name) && Array.isArray(value.lessonIds);
  }

  function session(value) {
    fields(value, {
      id, lessonId: id, coveredIds: identifiers, activeSeconds: number, startedAt: number, finishedAt: number,
      practised: number, difficult: number, selection: text, mode: text,
    }, 'practice session');
    return true;
  }

  function categoryRule(value) {
    fields(value, {keywords: text, course: text, tag: text, filter: text}, 'category rule');
    return true;
  }

  require(record(data) && Array.isArray(data.lessons) && Array.isArray(data.collections) &&
    Array.isArray(data.sessions) && record(data.preferences), 'library structure');
  if (data.lessons.length > 3000 || data.collections.length > 1000 || data.sessions.length > 20000) {
    throw new RangeError('Backup exceeds supported limits.');
  }
  plainJSON(data);
  array(data.lessons, lesson, 'lessons');
  array(data.collections, collection, 'collections');
  array(data.sessions, session, 'practice sessions');
  fields(data.preferences, {
    originalPlaybackVersion: number, theme: text, mode: text, speed: number, grouping: text,
    leadIn: number, pauseType: text, fixedPause: number, multiplier: number, showText: boolean,
    showIPA: boolean, wakeLock: boolean, reduceMotion: boolean, startupLesson: text,
  }, 'preferences');
  fields(data, {
    courses: nullable(value => array(value, course, 'courses')), categories: nullable(strings), tags: nullable(strings),
    categoryRules: nullable(value => dictionary(value, categoryRule, 'category rules')), lastLessonId: nullable(id),
    pendingAudioDeletes: value => array(value, imageURL, 'media retirement list'),
  }, 'library');
  return data;
}
