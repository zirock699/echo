import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../server/worker.mjs';
import { DevDB } from '../scripts/dev-state.mjs';
import { MAX_STATE_BYTES } from '../src/sync-limits.mjs';

const url = 'https://echo.test/api/state';
const email = {'oai-authenticated-user-email': 'snapshot-fixture@example.test'};
const library = extra => ({lessons: [], collections: [], sessions: [], preferences: {theme: 'dark'}, ...extra});

async function fixture() {
  const env = {DB: new DevDB()};
  const state = () => worker.fetch(new Request(url, {headers: email}), env);
  const owner = (await state()).headers.get('x-echo-owner');
  const put = (body, headers) => worker.fetch(new Request(url, {
    method: 'PUT', body, duplex: 'half', headers: {...email, 'x-echo-owner': owner, ...headers},
  }), env);
  return {owner, state, put};
}

test('a declared oversized state is rejected without pulling its body', async () => {
  const {owner, state, put} = await fixture();
  let pulls = 0;
  const body = new ReadableStream({pull() { pulls++; }}, {highWaterMark: 0});
  const response = await put(body, {'Content-Length': String(MAX_STATE_BYTES + 1)});
  assert.equal(response.status, 413);
  assert.equal(response.headers.get('x-echo-owner'), owner);
  assert.equal((await response.json()).code, 'state-too-large');
  assert.equal(pulls, 0);
  assert.deepEqual(await (await state()).json(), {revision: 0, data: null});
});

test('state body bytes are counted and excess streaming input is cancelled without a declared size', async () => {
  const {state, put} = await fixture();
  const chunk = new Uint8Array(1_000_000).fill(32);
  let pulls = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (++pulls > 20) controller.close();
      else controller.enqueue(chunk);
    },
    cancel() { cancelled = true; },
  }, {highWaterMark: 0});
  const response = await put(body);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, 'state-too-large');
  assert.ok(cancelled);
  assert.ok(pulls < 20, `Received ${pulls} chunks`);
  assert.deepEqual(await (await state()).json(), {revision: 0, data: null});
});

test('a compressible state exactly at the wire cap round-trips chunked UTF-8', async () => {
  const {state, put} = await fixture();
  const data = library({lessons: [{id: 'long-lesson', source: 'é😀'}]});
  const serialise = () => JSON.stringify({expectedRevision: 0, data});
  data.lessons[0].source += 'x'.repeat(MAX_STATE_BYTES - Buffer.byteLength(serialise()));
  const bytes = Buffer.from(serialise());
  assert.equal(bytes.length, MAX_STATE_BYTES);
  const start = bytes.indexOf('é😀');
  assert.ok(start > 0);
  const parts = [bytes.subarray(0, start + 1), bytes.subarray(start + 1, start + 4), bytes.subarray(start + 4)];
  const body = new ReadableStream({
    pull(controller) {
      if (parts.length) controller.enqueue(parts.shift());
      else controller.close();
    },
  });
  const saved = await put(body);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
  assert.deepEqual(await (await state()).json(), {revision: 1, data});
});

test('stored and record limits return separate outcomes without replacing the accepted revision', async () => {
  const {state, put} = await fixture();
  const accepted = library();
  const saved = await put(JSON.stringify({expectedRevision: 0, data: accepted}));
  assert.equal(saved.status, 200);
  const noise = Buffer.alloc(2_100_000);
  let seed = 0x12345678;
  for (let index = 0; index < noise.length; index++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    noise[index] = seed >>> 24;
  }
  const oversized = library({lessons: [{id: 'large-source', source: noise.toString('base64')}]});
  const wire = JSON.stringify({expectedRevision: 1, data: oversized});
  assert.ok(Buffer.byteLength(wire) < MAX_STATE_BYTES);
  const rejected = await put(wire);
  assert.equal(rejected.status, 413);
  assert.equal((await rejected.json()).code, 'storage-too-large');
  const tooMany = library({lessons: Array.from({length: 3001}, (_, index) => ({id: `lesson-${index}`}))});
  const count = await put(JSON.stringify({expectedRevision: 1, data: tooMany}));
  assert.equal(count.status, 413);
  assert.equal((await count.json()).code, 'state-count-limit');
  assert.deepEqual(await (await state()).json(), {revision: 1, data: accepted});
});
