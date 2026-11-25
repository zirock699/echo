import assert from 'node:assert/strict';
import test from 'node:test';
import {PracticeRecorder} from '../src/recorder.mjs';

function fixture(t) {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalRecorder = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder');
  const requests = [];
  const mediaRecorders = [];
  let failStart = false;

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {mediaDevices: {getUserMedia: () => new Promise((resolve, reject) => {
      requests.push({resolve, reject});
    })}},
  });
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    value: class {
      state = 'inactive';
      mimeType = 'audio/webm';

      constructor() { mediaRecorders.push(this); }
      start() {
        if (failStart) throw new Error('Recorder failed to start');
        this.state = 'recording';
      }
      stop() { this.state = 'inactive'; }
      finish(data) {
        this.ondataavailable({data: new Blob([data])});
        this.onstop();
      }
    },
  });

  const recorder = new PracticeRecorder(() => {});
  t.after(() => {
    recorder.reset();
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalRecorder) Object.defineProperty(globalThis, 'MediaRecorder', originalRecorder);
    else delete globalThis.MediaRecorder;
  });

  function grant(index) {
    const track = {stops: 0, stop() { this.stops++; }};
    requests[index].resolve({getTracks: () => [track]});
    return track;
  }

  return {recorder, requests, mediaRecorders, grant, failNextStart: () => { failStart = true; }};
}

test('stopping before the permission decision releases a late stream without capturing', async (t) => {
  const {recorder, mediaRecorders, grant} = fixture(t);
  const pending = recorder.start();
  assert.equal(recorder.requesting, true);
  recorder.stop();
  assert.equal(recorder.requesting, false);
  const track = grant(0);
  await pending;

  assert.equal(track.stops, 1);
  assert.equal(mediaRecorders.length, 0);
  assert.equal(recorder.url, null);
});

test('a cancelled permission result cannot interfere with a subsequent recording', async (t) => {
  const {recorder, mediaRecorders, grant} = fixture(t);
  const cancelled = recorder.start();
  recorder.stop();
  const active = recorder.start();
  const track = grant(1);
  await active;
  const obsoleteTrack = grant(0);
  await cancelled;

  assert.equal(obsoleteTrack.stops, 1);
  assert.equal(track.stops, 0);
  assert.equal(mediaRecorders.length, 1);
  assert.equal(recorder.recorder.state, 'recording');
});

test('a valid stop releases tracks and publishes a local clip, while a repeat denial preserves it', async (t) => {
  const {recorder, requests, mediaRecorders, grant} = fixture(t);
  const active = recorder.start();
  const track = grant(0);
  await active;
  recorder.stop();
  assert.equal(track.stops, 1);
  mediaRecorders[0].finish('first clip');
  assert.equal(track.stops, 1);
  const url = recorder.url;
  assert.equal(await (await fetch(url)).text(), 'first clip');

  const retry = recorder.start();
  requests[1].reject(new Error('Denied'));
  await retry;
  assert.equal(recorder.requesting, false);
  assert.match(recorder.error, /microphone access/i);
  assert.equal(recorder.url, url);
});

test('obsolete recorder events cannot replace the current clip', async (t) => {
  const {recorder, mediaRecorders, grant} = fixture(t);
  const first = recorder.start();
  const firstTrack = grant(0);
  await first;
  recorder.stop();

  const second = recorder.start();
  const secondTrack = grant(1);
  await second;
  recorder.stop();
  mediaRecorders[1].finish('second clip');
  const url = recorder.url;
  mediaRecorders[0].finish('obsolete clip');

  assert.equal(firstTrack.stops, 1);
  assert.equal(secondTrack.stops, 1);
  assert.equal(recorder.url, url);
  assert.equal(await (await fetch(url)).text(), 'second clip');
});

test('a recorder start failure releases access immediately', async (t) => {
  const {recorder, grant, failNextStart} = fixture(t);
  failNextStart();
  const pending = recorder.start();
  const track = grant(0);
  await pending;

  assert.equal(track.stops, 1);
  assert.equal(recorder.requesting, false);
  assert.equal(recorder.recorder, null);
  assert.equal(recorder.url, null);
  assert.match(recorder.error, /could not start/i);
});

test('reset revokes the previous clip and discards an active capture across owner changes', async (t) => {
  const {recorder, mediaRecorders, grant} = fixture(t);
  const first = recorder.start();
  grant(0);
  await first;
  recorder.stop();
  mediaRecorders[0].finish('previous clip');
  const previous = recorder.url;

  const second = recorder.start();
  const track = grant(1);
  await second;
  recorder.reset();
  mediaRecorders[1].finish('discarded clip');

  assert.equal(track.stops, 1);
  assert.equal(recorder.url, null);
  assert.equal(recorder.recorder, null);
  await assert.rejects(fetch(previous));
});
