import assert from 'node:assert/strict';
import test from 'node:test';
import {LibraryUI} from '../src/library-ui.mjs';
import {applyLessonAssetChanges, mediaReferences, removeLesson} from '../src/library-mutations.mjs';

const asset = number => ({
  url: '/api/audio/00000000-0000-4000-8000-' + String(number).padStart(12, '0'),
});

function fixture() {
  const removed = {id: 'remove', audio: asset(1), thumbnail: asset(2), frame: asset(3)};
  const kept = {id: 'keep', title: 'Kept lesson', courseId: 'other', audio: asset(2),
    videoId: 'fixture-video', thumbnail: asset(4), frame: asset(5),
    favourite: true, createdAt: 17, duration: 6, audioOffset: .4,
    statuses: {cue: {practised: true, difficult: true}},
    phrases: [{id: 'cue', start: 0, end: 5, text: 'Repeat the phrase.'}],
    source: 'Saved original captions', progress: {position: 3, phraseId: 'cue', coverage: [[0, 3]]},
    pauseOverrides: {cue: 4}, ipaOverrides: {'phrase': 'fixture'}, tags: ['saved'],
  };
  const course = {id: 'course', title: 'First course', category: '', tags: [], lessonIds: ['remove', 'keep'],
    cover: {url: 'https://example.test' + asset(3).url}};
  const other = {id: 'other', title: 'Second course', category: '', tags: [], lessonIds: ['keep']};
  const data = {lessons: [removed, kept], courses: [course, other],
    collections: [{id: 'collection', lessonIds: ['remove', 'keep']}],
    sessions: [{lessonId: 'remove'}, {lessonId: 'keep'}],
    lastLessonId: 'remove', preferences: {startupLesson: 'remove', mode: 'automatic'},
  };
  return {data, removed, kept, course, other};
}

test('one removal operation clears all lesson pointers and keeps shared audio and course cover', () => {
  const {data, kept, course} = fixture();
  const progress = structuredClone(kept.progress);
  data.pendingAudioDeletes = [asset(2).url, '/api/audio/legacy-image', 'https://example.test/image.jpg'];
  removeLesson(data, 'remove');
  assert.deepEqual(data.lessons, [kept]);
  assert.deepEqual(course.lessonIds, ['keep']);
  assert.deepEqual(data.collections[0].lessonIds, ['keep']);
  assert.deepEqual(data.sessions, [{lessonId: 'keep'}]);
  assert.equal(data.lastLessonId, null);
  assert.deepEqual(data.preferences, {startupLesson: 'recent', mode: 'automatic'});
  assert.deepEqual(data.pendingAudioDeletes, [asset(1).url]);
  assert.ok(mediaReferences(data).has(asset(3).url));
  assert.deepEqual(kept.progress, progress);
});

test('asset changes keep omissions and retire only replaced or explicitly removed fields', () => {
  const {data, kept} = fixture();
  applyLessonAssetChanges(data, kept, {audio: asset(6), frame: null});
  assert.deepEqual(kept.audio, asset(6));
  assert.deepEqual(kept.thumbnail, asset(4));
  assert.equal(kept.frame, null);
  assert.deepEqual(data.pendingAudioDeletes, [asset(5).url]);
});

test('Library Continue skips obsolete membership and course deletion keeps a surviving course member', () => {
  const {data, kept, course} = fixture();
  course.cover = asset(3);
  course.lessonIds.unshift('historic-missing');
  const opened = [];
  const library = new LibraryUI({data, mutate(fn){fn(data);}}, () => {}, id => opened.push(id));
  removeLesson(data, 'remove');
  library.action('continue', {id: course.id});
  assert.deepEqual(opened, ['keep']);
  library.remove(['c:' + course.id], true);
  assert.deepEqual(data.lessons, [kept]);
  assert.deepEqual(data.courses.map(c => c.id), ['other']);
  assert.deepEqual(data.pendingAudioDeletes, [asset(1).url, asset(3).url]);
});

function zipReplacement(data, lesson, {captions = [], artwork = false, failArtwork = false} = {}) {
  const store = {owner: 'synthetic-owner', data, mode: 'cloud', mutate(fn){fn(this.data);}, async flush(){}};
  const library = new LibraryUI(store, () => {}, () => {});
  library.packageScope = library.captureOwner();
  library.draft = {destination: data.courses[0].id, duplicates: 'replace'};
  library.package = {zip: {async read(){return new TextEncoder().encode('ID3 sample');}}, lessons: [{
    title: 'Replacement', folder: 'fixture', notes: [], meta: {video_id: lesson.videoId},
    audio: 'speech.mp3', thumbnail: artwork?'photo.jpg':null, phrases: captions, segments: captions,
    source: 'Updated captions', ...(captions.length?{transcript: 'captions.srt'}:{}),
  }]};
  library.duration = async () => 6;
  library.upload = async (_bytes, _type, name, scope) => {
    assert.equal(scope.owner, 'synthetic-owner');
    if (name === 'speech.mp3') return asset(8);
    if (failArtwork) throw Error('Fixture upload failed.');
    return asset(9);
  };
  return library;
}

test('ZIP assets can be replaced without dropping old captions or omitted and failed artwork', async () => {
  for (const [options, courseTags] of [[{}, undefined], [{artwork: true, failArtwork: true}, ['course tag']]]) {
    const {data, kept, course} = fixture();
    if (courseTags) course.tags = courseTags;
    else delete course.tags;
    const original = structuredClone(kept);
    const library = zipReplacement(data, kept, options);
    await library.commit();
    assert.equal(library.summary.imported, 1);
    assert.equal(library.summary.noTranscript, 0);
    assert.deepEqual(kept.audio, asset(8));
    for (const field of ['id', 'phrases', 'source', 'thumbnail', 'frame', 'progress', 'statuses',
      'pauseOverrides', 'ipaOverrides', 'favourite', 'createdAt', 'audioOffset', 'tags']) {
      assert.deepEqual(kept[field], original[field], field);
    }
    assert.equal(kept.courseId, data.courses[0].id);
    assert.deepEqual(course.tags, courseTags);
    assert.deepEqual(data.pendingAudioDeletes ?? [], []);
  }
});

test('ZIP replacement saves new artwork and preserves exact matching cue identities and practice', async () => {
  const {data, kept, removed} = fixture();
  removed.thumbnail = asset(7);
  const captions = [{...kept.phrases[0], id: 'imported-cue'}];
  const library = zipReplacement(data, kept, {captions, artwork: true});
  await library.commit();
  assert.equal(library.summary.imported, 1);
  assert.equal(kept.source, 'Updated captions');
  assert.deepEqual(kept.thumbnail, asset(9));
  assert.deepEqual(kept.frame, asset(5));
  assert.equal(kept.phrases[0].id, 'cue');
  assert.equal(kept.progress.phraseId, 'cue');
  assert.deepEqual(kept.statuses.cue, {practised: true, difficult: true});
  assert.deepEqual(data.pendingAudioDeletes, [asset(2).url, asset(4).url]);
});
