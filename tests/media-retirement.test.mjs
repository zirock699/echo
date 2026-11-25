import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.mjs';
import {DevDB, DevBucket} from '../scripts/dev-state.mjs';

const a = 'retirement-a@sample.test';
const b = 'retirement-b@sample.test';
const library = fields => ({lessons: [], collections: [], courses: [], sessions: [], preferences: {}, ...fields});

async function fixture(bucket = new DevBucket()) {
  const env = {DB: new DevDB(), BUCKET: bucket};
  async function account(email) {
    const headers = {'oai-authenticated-user-email': email};
    const route = (path, {method = 'GET', headers: extra, body} = {}) =>
      worker.fetch(new Request(`https://echo.test${path}`, {method, headers: {...headers, ...extra}, body}), env);
    const handshake = await route('/api/state');
    assert.equal(handshake.status, 200);
    headers['x-echo-owner'] = handshake.headers.get('x-echo-owner');
    return {
      route,
      async upload() {
        const result = await route('/api/audio', {method: 'POST', headers: {'content-type': 'audio/wav', 'content-length': '3'}, body: Uint8Array.of(1, 2, 3)});
        assert.equal(result.status, 201);
        return result.json();
      },
      save: (expectedRevision, data) => route('/api/state', {method: 'PUT', body: JSON.stringify({expectedRevision, data})}),
      async read() { return (await route('/api/state')).json(); },
      remove: url => route(url, {method: 'DELETE'}),
    };
  }
  return {env, primary: await account(a), other: await account(b)};
}

test('the current course cover protects a removed lesson asset until a later accepted revision explicitly retires it', async () => {
  const {primary, other} = await fixture();
  const asset = await primary.upload();
  const withReference = library({lessons: [{id: 'lesson', thumbnail: asset}], courses: [{id: 'course', lessonIds: ['lesson'], cover: asset}]});
  assert.equal((await primary.save(0, withReference)).status, 200);

  // Older snapshots may carry same-site absolute artwork URLs.
  const leaveCover = library({courses: [{id: 'course', lessonIds: [], cover: {...asset, url: `https://echo.test${asset.url}`}}], pendingAudioDeletes: [asset.url]});
  assert.deepEqual(await (await primary.save(1, leaveCover)).json(), {revision: 2, pendingAudioDeletes: []});
  assert.equal((await primary.remove(asset.url)).status, 409);
  assert.equal((await primary.route(asset.url)).status, 200);
  assert.equal((await other.remove(asset.url)).status, 409);

  // Neither a conflicting save nor merely requesting a DELETE can remove the file.
  const withoutReference = library({pendingAudioDeletes: [asset.url, asset.url]});
  assert.equal((await primary.save(1, withoutReference)).status, 409);
  assert.equal((await primary.remove(asset.url)).status, 409);
  assert.equal((await primary.route(asset.url)).status, 200);
  const accepted = await primary.save(2, withoutReference);
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), {revision: 3, pendingAudioDeletes: [asset.url]});
  assert.equal((await primary.route(asset.url)).status, 200);
  assert.equal((await primary.remove(asset.url)).status, 204);
  assert.equal((await primary.route(asset.url)).status, 404);
  assert.equal((await primary.read()).revision, 3);

  // Clearing the pending UI queue must not clear the server's retirement record.
  assert.equal((await primary.save(3, library())).status, 200);
  assert.equal((await primary.remove(asset.url)).status, 204);
  const staleBackup = await primary.save(4, withReference);
  assert.equal(staleBackup.status, 422);
  assert.equal((await staleBackup.json()).code, 'media-retired');
  assert.deepEqual(await primary.read(), {revision: 4, data: library()});
});

test('old unacknowledged queues and incoming reserved data confer no deletion authority', async () => {
  const {env, primary} = await fixture();
  const asset = await primary.upload();
  const old = library({pendingAudioDeletes: [asset.url], _retiredMedia: [asset.url]});
  env.DB.rows.set(a, {revision: 1, data: JSON.stringify(old), payload: null});
  assert.deepEqual(await primary.read(), {revision: 1, data: library()});
  assert.equal((await primary.remove(asset.url)).status, 409);
  assert.equal((await primary.save(1, library({_retiredMedia: [asset.url]}))).status, 200);
  assert.deepEqual(await primary.read(), {revision: 2, data: library()});
  assert.equal((await primary.remove(asset.url)).status, 409);
  assert.equal((await primary.route(asset.url)).status, 200);
});

test('a racing restore cannot reattach media between accepted retirement and physical deletion', {timeout: 3000}, async () => {
  const bucket = new DevBucket();
  const originalDelete = bucket.delete.bind(bucket);
  let release, started;
  const waitingForDelete = new Promise(resolve => { started = resolve; });
  const permissionToDelete = new Promise(resolve => { release = resolve; });
  bucket.delete = async key => {
    started();
    await permissionToDelete;
    return originalDelete(key);
  };
  const {primary} = await fixture(bucket);
  const asset = await primary.upload();
  const before = library({lessons: [{id: 'lesson', audio: asset}]});
  assert.equal((await primary.save(0, before)).status, 200);
  assert.equal((await primary.save(1, library({pendingAudioDeletes: [asset.url]}))).status, 200);
  const deleting = primary.remove(asset.url);
  try {
    await waitingForDelete;
    assert.equal((await primary.save(1, before)).status, 409);
    assert.equal((await primary.save(2, before)).status, 422);
    assert.equal((await primary.route(asset.url)).status, 200);
  } finally {
    release();
  }
  assert.equal((await deleting).status, 204);
  assert.equal((await primary.route(asset.url)).status, 404);
});

test('accepted retirement survives a compressed snapshot round-trip after queue cleanup', async () => {
  const {env, primary} = await fixture();
  const asset = await primary.upload();
  const large = library({lessons: [{id: 'another lesson', source: 'Saved caption text. '.repeat(16000)}]});
  assert.equal((await primary.save(0, {...large, pendingAudioDeletes: [asset.url]})).status, 200);
  assert.ok(env.DB.rows.get(a).payload instanceof ArrayBuffer);
  assert.equal((await primary.remove(asset.url)).status, 204);
  assert.equal((await primary.save(1, large)).status, 200);
  assert.deepEqual(await primary.read(), {revision: 2, data: large});
  const stale = library({lessons: [{id: 'media lesson', audio: asset}]});
  assert.equal((await primary.save(2, stale)).status, 422);
  assert.equal((await primary.remove(asset.url)).status, 204);
});
