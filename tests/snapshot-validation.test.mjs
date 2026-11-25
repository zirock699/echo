import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSnapshot } from '../src/snapshot.mjs';
import { validateSegments } from '../src/transcript.mjs';

function legacyLibrary() {
  const phrase = {
    id: 'line-1', start: 1, end: 2, text: 'Try "less than <" & "greater than >".', speaker: 'A&B',
    words: [{ text: 'Try', start: 1, end: 1.1 }],
  };
  const progress = { position: 1.5, phraseId: phrase.id, coverage: [[1, 1.5]] };
  const revision = { phrases: [phrase], segments: [phrase], statuses: { [phrase.id]: { practised: true } } };
  return {
    lessons: [{
      id: 'lesson "one"', title: 'A & B’s lesson', phrases: [phrase], segments: [phrase], progress,
      revisions: [revision], playbackRecoveryBackup: { ...revision, progress },
      courseId: 'old-course', statuses: revision.statuses, pauseOverrides: { [phrase.id]: 2 },
      ipaOverrides: { 'one': 'wʌn' }, duration: null,
      audio: { id: 'original-asset', url: '/api/audio/original-asset', name: 'Lesson & Audio.wav', size: 1024 },
      thumbnail: { url: 'http://images.example.test/lesson.jpg?fit=cover&width=640' },
    }],
    courses: [{ id: 'old-course', title: 'Course', lessonIds: ['lesson "one"'] }],
    collections: [{ id: 'old-list', name: 'Old library', lessonIds: ['lesson "one"'] }],
    sessions: [{ id: 'session-1', lessonId: 'lesson "one"', coveredIds: [phrase.id], activeSeconds: .5 }],
    preferences: { mode: 'manual', theme: 'light' }, lastLessonId: 'lesson "one"',
    customImportMetadata: { language: 'en-GB' },
  };
}

test('legacy identifiers, text and revisions survive validation unchanged', () => {
  const data = legacyLibrary();
  const backup = JSON.stringify(data);
  assert.strictEqual(validateSnapshot(data), data);
  assert.equal(JSON.stringify(data), backup);
  assert.deepEqual(validateSnapshot(JSON.parse(backup)), data);

  // The older D1 codec can have omitted optional fields.
  const sparse = {
    lessons: [{ id: 'old' }], collections: [], sessions: [], preferences: {},
    courses: null, tags: null, categories: null,
  };
  assert.strictEqual(validateSnapshot(sparse), sparse);

  const { segments: short } = validateSegments([{ id: 'short', text: 'Short cue', start: .4, end: .4001 }]);
  assert.equal(short[0].start, short[0].end);
  sparse.lessons[0].phrases = short;
  assert.strictEqual(validateSnapshot(sparse), sparse);
});

test('malformed nested records fail before a snapshot can be applied', () => {
  const invalidFields = [
    data => { data.lessons[0].phrases = {}; },
    data => { data.lessons[0].phrases = [null]; },
    data => { delete data.lessons[0].phrases[0].end; },
    data => { data.lessons[0].phrases[0].end = .5; },
    data => { delete data.lessons[0].phrases[0].words[0].start; },
    data => { data.lessons[0].phrases[0].words[0].end = 1; },
    data => { data.lessons[0].revisions[0].phrases = 'not an array'; },
    data => { data.lessons[0].revisions[0].duration = 30; },
    data => { data.lessons[0].progress.coverage = [[1]]; },
    data => { data.lessons[0].statuses = { 'line-1': null }; },
    data => { data.collections[0].lessonIds = ['a', {}]; },
    data => { data.courses[0].cover = 'an image URL without a record'; },
    data => { data.preferences = []; },
  ];
  for (const change of invalidFields) {
    const data = legacyLibrary();
    change(data);
    assert.throws(() => validateSnapshot(data), /Invalid library snapshot/);
  }
});

test('private audio stays on the media API and valid legacy image URLs remain usable', () => {
  const data = legacyLibrary();
  assert.doesNotThrow(() => validateSnapshot(data));
  data.lessons[0].audio.url = 'https://static.example.test/lesson.wav';
  assert.throws(() => validateSnapshot(data), /audio attachment url/);
  data.lessons[0].audio.url = '/api/audio/original-asset';
  data.lessons[0].thumbnail.url = 'file:///lesson.jpg';
  assert.throws(() => validateSnapshot(data), /thumbnail url/);
});

test('unsupported record counts and excessively nested metadata are bounded', () => {
  const data = legacyLibrary();
  const lessons = data.lessons;
  data.lessons = Array(3001).fill(lessons[0]);
  assert.throws(() => validateSnapshot(data), { name: 'RangeError', message: 'Backup exceeds supported limits.' });
  data.lessons = lessons;
  let value = 'normal metadata';
  for (let level = 0; level < 40; level++) value = { next: value };
  data.customImportMetadata = value;
  assert.throws(() => validateSnapshot(data), /metadata nesting/);
});
