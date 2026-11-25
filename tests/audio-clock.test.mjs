import assert from 'node:assert/strict';
import test from 'node:test';
import {PlayerEngine} from '../src/player.mjs';

class FakeAudio extends EventTarget {
  paused = true;
  readyState = 1;
  duration = 8;
  position = 0;
  reads = 0;

  get currentTime() { this.reads++; return this.position; }
  set currentTime(value) {
    if (this.deferSeeks) {
      this.destination = value;
      this.seeking = true;
    } else this.position = value;
  }

  emit(event) { this.dispatchEvent(new Event(event)); }
  load() { if (this.src) queueMicrotask(() => this.emit('loadedmetadata')); }
  play() { this.paused = false; this.emit('playing'); return Promise.resolve(); }
  pause() { this.paused = true; this.emit('pause'); }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
}

function lesson(id = '00000000-0000-4000-8000-000000000001') {
  return {
    id, audio: {id, url: '/api/audio/' + id}, mediaSource: 'audio',
    phrases: [{id: 'first', start: .1, end: 1.2}, {id: 'next', start: 2, end: 3.2}],
    progress: {position: .1, phraseId: 'first', coverage: []}, statuses: {},
  };
}

async function fixture(t, mode = 'manual') {
  t.mock.timers.enable({apis: ['setTimeout', 'setInterval', 'Date'], now: 10000});
  const prior = {Audio: globalThis.Audio, document: globalThis.document};
  globalThis.Audio = FakeAudio;
  globalThis.document = {querySelector: () => null};
  const player = new PlayerEngine();
  t.after(() => {
    player.destroy();
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  });
  const saves = [];
  player.onSave = reason => saves.push(reason);
  player.load(lesson(), {mode, pauseType: 'fixed', fixedPause: .8});
  await player.initialise();
  return {player, audio: player.yt.audio, saves};
}

test('paused native clock stays idle, wakes on Play and still reaches the Manual boundary', async t => {
  const {player, audio, saves} = await fixture(t);
  assert.equal(player.duration, 8);
  assert.deepEqual(saves, ['checkpoint']);
  const before = audio.reads;
  t.mock.timers.tick(2000);
  assert.equal(audio.reads, before);

  player.play();
  audio.position = .8;
  t.mock.timers.tick(20);
  assert.equal(player.time, .8);
  audio.position = 1.2;
  t.mock.timers.tick(20);
  assert.equal(player.phraseDone, true);
  assert.equal(player.playing, false);
  assert.equal(saves.at(-1), 'checkpoint');
  const stopped = audio.reads;
  t.mock.timers.tick(2000);
  assert.equal(audio.reads, stopped);

  player.replay();
  assert.equal(audio.position, .1);
  player.pause();
  assert.equal(saves.at(-1), undefined);
});

test('a delayed paused seek keeps polling, then external seeks reconcile on the native event', async t => {
  const {player, audio} = await fixture(t);
  audio.deferSeeks = true;
  player.seekRecording(2.25, false);
  assert.equal(player.pendingSeek.target, 2.25);
  t.mock.timers.tick(60);
  assert.equal(player.pendingSeek.target, 2.25);

  audio.position = audio.destination;
  audio.seeking = false;
  t.mock.timers.tick(20);
  assert.equal(player.pendingSeek, null);
  assert.equal(player.current().id, 'next');
  const afterSeek = audio.reads;
  t.mock.timers.tick(100);
  assert.equal(audio.reads, afterSeek);

  audio.position = .5;
  audio.emit('seeked');
  assert.equal(player.current().id, 'first');
  assert.equal(player.time, .5);
  assert.equal(player.playing, false);

  player.play();
  player.load(lesson('00000000-0000-4000-8000-000000000002'), {mode: 'manual'});
  assert.equal(player.timer, null);
  await player.initialise();
  assert.notEqual(player.yt.audio, audio);
  assert.equal(player.playing, false);
  assert.equal(player.timer, null);
});

test('Automatic cue advancement wakes new playback without requesting a deliberate save', async t => {
  const {player, audio, saves} = await fixture(t, 'automatic');
  player.play();
  audio.position = 1.2;
  t.mock.timers.tick(20);
  assert.equal(player.state, 'speaking-pause');
  saves.length = 0;
  t.mock.timers.tick(801);
  assert.equal(player.current().id, 'next');
  assert.equal(player.playing, true);
  assert.deepEqual(saves, ['checkpoint']);
  audio.position = 2.25;
  t.mock.timers.tick(20);
  assert.equal(player.time, 2.25);
});
