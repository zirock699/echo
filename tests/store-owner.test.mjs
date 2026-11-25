import test from 'node:test';
import assert from 'node:assert/strict';
import {Store, initialData} from '../src/store.mjs';
import {EchoMirror, savedAttempts, writeAttempt} from '../src/mirror.mjs';
import {DevDB, DevBucket} from '../scripts/dev-state.mjs';
import worker from '../server/worker.mjs';

const owners = {a: 'a'.repeat(64), b: 'b'.repeat(64)};
const header = 'x-echo-owner';
const library = title => ({...initialData(), lessons: [{id: 'same-id', title, phrases: []}]});
const response = (account, revision = 1) => Response.json({revision, data: library(account.toUpperCase())},
  {headers: {[header]: owners[account]}});

function localCache(initial = []) {
  const records = new Map(initial);
  const reads = [];
  return {records, reads, get: async key => { reads.push(key); return structuredClone(records.get(key)); },
    set: async (key, value) => records.set(key, structuredClone(value))};
}

function request(path, email, {method = 'GET', headers = {}, body} = {}) {
  return new Request('https://echo.test'+path, {method, headers: {'oai-authenticated-user-email': email, ...headers}, body});
}

test('Worker requires the currently verified owner for state and media writes', async () => {
  const env = {DB: new DevDB(), BUCKET: new DevBucket()};
  const accountA = 'a@synthetic.test', accountB = 'b@synthetic.test';
  const fetchAs = (account, path = '/api/state', init) => worker.fetch(request(path, account, init), env);
  const a = (await fetchAs(accountA)).headers.get(header);
  const b = (await fetchAs(accountB)).headers.get(header);
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
  assert.equal((await fetchAs(' A@Synthetic.test ')).headers.get(header), a);
  const state = {method: 'PUT', body: JSON.stringify({expectedRevision: 0, data: library('A')})};
  assert.equal((await fetchAs(accountA, '/api/state', state)).status, 428);
  assert.equal((await fetchAs(accountB, '/api/state', {...state, headers: {[header]: a}})).status, 412);
  assert.deepEqual(await (await fetchAs(accountB)).json(), {revision: 0, data: null});
  assert.equal((await fetchAs(accountA, '/api/state', {...state, headers: {[header]: a}})).status, 200);

  const audio = {method: 'POST', headers: {'content-type': 'audio/wav', 'content-length': '2'}, body: new Uint8Array([1, 2])};
  assert.equal((await fetchAs(accountA, '/api/audio', audio)).status, 428);
  assert.equal((await fetchAs(accountB, '/api/audio', {...audio, headers: {...audio.headers, [header]: a}})).status, 412);
  assert.equal(env.BUCKET.files.size, 0);
  const uploaded = await fetchAs(accountA, '/api/audio', {...audio, headers: {...audio.headers, [header]: a}});
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.headers.get(header), a);
  const {url} = await uploaded.json();
  assert.equal((await fetchAs(accountB, url, {method: 'DELETE', headers: {[header]: a}})).status, 412);
  assert.equal((await fetchAs(accountA, url)).status, 200);
});

test('same-revision account switch keeps pending work with its original owner', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let account = 'a';
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    assert.equal(path, '/api/state');
    if (init.method === 'PUT') {
      writes.push({account, owner: init.headers.get(header), ...JSON.parse(init.body)});
      return Response.json({revision: 2}, {headers: {[header]: owners[account]}});
    }
    return response(account);
  });
  const legacy = {data: library('Unknown legacy'), revision: 1, pending: true};
  const cache = localCache([['state', legacy]]);
  const store = new Store({cache});
  await store.init();
  store.mutate(data => { data.lessons[0].title = 'A pending'; });
  account = 'b';
  await store.connect();
  assert.equal(store.owner, owners.b);
  assert.equal(store.data.lessons[0].title, 'B');
  assert.equal(store.pending, false);
  await store.flush();
  assert.deepEqual(writes, []);
  assert.ok(!cache.reads.includes('state'));
  assert.deepEqual(cache.records.get('state'), legacy);

  account = 'a';
  await store.connect();
  assert.equal(store.data.lessons[0].title, 'A pending');
  await store.flush();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].account, 'a');
  assert.equal(writes[0].owner, owners.a);
  assert.equal(writes[0].data.lessons[0].title, 'A pending');
});

test('verified GET keeps divergent content and multiple intervening revisions in conflict', async t => {
  const ownedState = `state:${owners.a}`;
  const remote = library('Cloud copy');
  const retirement = '/api/audio/00000000-0000-4000-8000-000000000049';
  for (const {data, revision} of [
    {data: library('Modified device copy'), revision: 2},
    {data: {...remote, pendingAudioDeletes: [retirement]}, revision: 2},
    {data: remote, revision: 3},
  ]) {
    const cache = localCache([[ownedState, {owner: owners.a, data, revision: 1, pending: true}]]);
    const fetch = t.mock.method(globalThis, 'fetch', async (_url, init) => {
      assert.notEqual(init.method, 'PUT');
      return Response.json({revision, data: remote}, {headers: {[header]: owners.a}});
    });
    const store = new Store({cache});
    await store.init();
    await store.flush();
    assert.equal(store.mode, 'conflict');
    assert.equal(store.pending, true);
    assert.equal(store.revision, 1);
    assert.equal(store.conflict.revision, revision);
    assert.equal(store.data.lessons[0].title, data.lessons[0].title);
    assert.deepEqual(store.data.pendingAudioDeletes, data.pendingAudioDeletes);
    fetch.mock.restore();
  }
});

test('a matching snapshot from another verified owner leaves the old pending record intact', async t => {
  const data = library('Matching visible content');
  const ownedState = `state:${owners.a}`;
  const pending = {owner: owners.a, data, revision: 1, pending: true};
  const cache = localCache([[ownedState, pending]]);
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.notEqual(init.method, 'PUT');
    return Response.json({revision: 2, data}, {headers: {[header]: owners.b}});
  });
  const store = new Store({cache});
  await store.init();
  assert.equal(store.owner, owners.b);
  assert.equal(store.mode, 'cloud');
  assert.deepEqual(cache.reads, [`state:${owners.b}`]);
  assert.deepEqual(cache.records.get(ownedState), pending);
});

test('a warm tab keeps offline work but cold, unsigned and redirect loads cannot read private cache', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let mode = 'online';
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    assert.equal(init.redirect, 'manual');
    if (mode === 'offline') throw Error('Network unavailable');
    if (mode === 'redirect') return Response.redirect('https://echo.test/sign-in');
    if (mode === 'signed-out') return new Response(null, {status: 401});
    return response('a');
  });
  const cache = localCache();
  const store = new Store({cache});
  await store.init();
  store.mutate(data => { data.lessons[0].title = 'Pending A'; });
  mode = 'offline';
  await store.connect();
  assert.equal(store.mode, 'local');
  assert.equal(store.data.lessons[0].title, 'Pending A');
  const reopened = new Store({cache});
  const previousReads = cache.reads.length;
  await reopened.init();
  assert.equal(reopened.owner, null);
  assert.equal(reopened.mode, 'locked');
  assert.deepEqual(reopened.data.lessons, []);
  assert.equal(cache.reads.length, previousReads);
  assert.throws(() => reopened.mutate(() => {}), /Sign in/);

  mode = 'online';
  await reopened.retry();
  assert.equal(reopened.data.lessons[0].title, 'Pending A');
  mode = 'redirect';
  await reopened.connect();
  assert.equal(reopened.owner, null);
  assert.equal(reopened.mode, 'locked');
  assert.deepEqual(reopened.data.lessons, []);
  mode = 'signed-out';
  await store.connect();
  assert.equal(store.owner, null);
  assert.deepEqual(store.data.lessons, []);
});

test('a save completing after an account change cannot update the new displayed state', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let account = 'a', finish;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method === 'PUT') return new Promise(resolve => { finish = resolve; });
    return response(account);
  });
  const store = new Store({cache: localCache()});
  await store.init();
  store.mutate(data => { data.lessons[0].title = 'A revised'; });
  const saving = store.flush();
  assert.ok(finish);
  account = 'b';
  await store.connect();
  finish(Response.json({revision: 99}, {headers: {[header]: owners.a}}));
  await saving;
  assert.equal(store.owner, owners.b);
  assert.equal(store.revision, 1);
  assert.equal(store.pending, false);
  assert.equal(store.data.lessons[0].title, 'B');
});

test('a previous state response cannot reopen a library after sign-out', async t => {
  let phase = 'initial', finish;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method === 'DELETE') return new Response(null, {status: 401});
    if (phase === 'pending') return new Promise(resolve => { finish = resolve; });
    return response('a');
  });
  const store = new Store({cache: localCache()});
  await store.init();
  phase = 'pending';
  const checking = store.connect();
  assert.ok(finish);
  await assert.rejects(store.ownedFetch('/api/audio/synthetic-id', {method: 'DELETE'}), /account changed/);
  finish(response('a'));
  await checking;
  assert.equal(store.owner, null);
  assert.equal(store.mode, 'locked');
  assert.deepEqual(store.data.lessons, []);
});

test('legacy load and restore populate missing view fields without losing present values', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const sparse = {
    lessons: [{id: 'lesson only'}, {id: 'progress already saved', title: 'Present', progress: {position: 7}}],
    collections: [], sessions: [{id: 'minimal'}, {id: 'full', coveredIds: ['one'], activeSeconds: 3}],
    preferences: {originalPlaybackVersion: 1},
  };
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({revision: 1, data: sparse}, {headers: {[header]: owners.a}}));
  const store = new Store({cache: localCache()});
  const check = () => {
    const [minimal, present] = store.data.lessons;
    assert.equal(minimal.title, 'Untitled lesson');
    assert.deepEqual(minimal.phrases, []);
    assert.deepEqual(minimal.statuses, {});
    assert.deepEqual(minimal.progress, {position: 0, coverage: []});
    assert.equal(present.title, 'Present');
    assert.deepEqual(present.progress, {position: 7, coverage: []});
    assert.deepEqual(store.data.sessions, [
      {id: 'minimal', coveredIds: [], activeSeconds: 0}, {id: 'full', coveredIds: ['one'], activeSeconds: 3},
    ]);
  };
  await store.init();
  check();
  store.mutate(data => { data.lessons[0].title = 'Replaced'; });
  store.restore(JSON.stringify({app: 'Echo Studio', version: 1, data: sparse}));
  check();
});

test('portable restore replaces metadata without replaying cleanup from either copy', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  t.mock.method(globalThis, 'fetch', async () => response('a'));
  const store = new Store({cache: localCache()});
  await store.init();
  store.mutate(data => {
    data.pendingAudioDeletes = ['/api/audio/local-file'];
    data.oldLocalExtra = 'belongs only to the previous library';
  });
  assert.equal(Object.hasOwn(JSON.parse(store.export()).data, 'pendingAudioDeletes'), false);
  store.restore(JSON.stringify({app: 'Echo Studio', data: {
    ...library('Recovered'), pendingAudioDeletes: ['/api/audio/previously-queued'], _retiredMedia: ['legacy'],
  }}));
  assert.equal(store.data.lessons[0].title, 'Recovered');
  for (const key of ['pendingAudioDeletes', '_retiredMedia', 'oldLocalExtra']) {
    assert.equal(Object.hasOwn(store.data, key), false, key);
  }
});

test('a retired media save failure is retained for recovery without automatic retries', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method !== 'PUT') return response('a');
    writes++;
    return Response.json({code: 'media-retired', error: 'Reattach the missing file'}, {status: 422, headers: {[header]: owners.a}});
  });
  const store = new Store({cache: localCache()});
  await store.init();
  store.mutate(data => { data.lessons[0].title = 'Recovered metadata'; });
  await store.flush();
  await store.connect();
  t.mock.timers.tick(90_000);
  assert.equal(store.mode, 'rejected');
  assert.equal(store.pending, true);
  assert.equal(store.revision, 1);
  assert.equal(store.data.lessons[0].title, 'Recovered metadata');
  assert.equal(writes, 1);
});

test('a rejected older upload of state does not block a newer corrected snapshot', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let completeOld;
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method !== 'PUT') return response('a');
    writes.push(JSON.parse(init.body).data);
    if (writes.length === 1) return new Promise(resolve => { completeOld = resolve; });
    return Response.json({revision: 2}, {headers: {[header]: owners.a}});
  });
  const store = new Store({cache: localCache()});
  await store.init();
  store.mutate(data => { data.lessons[0].audio = {id: 'old-asset', url: '/api/audio/old-asset'}; });
  const saving = store.flush();
  store.mutate(data => { data.lessons[0].audio = null; });
  completeOld(Response.json({code: 'media-retired'}, {status: 422, headers: {[header]: owners.a}}));
  await saving;
  assert.equal(store.mode, 'cloud');
  t.mock.timers.tick(150);
  await store.saving;
  assert.equal(writes.length, 2);
  assert.equal(writes[1].lessons[0].audio, null);
  assert.equal(store.pending, false);
});

test('invalid pending cache remains preserved even when a recovery copy cannot be written', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method === 'PUT') {
      writes++;
      return Response.json({revision: 2}, {headers: {[header]: owners.a}});
    }
    return response('a');
  });
  const key = `state:${owners.a}`;
  const broken = {owner: owners.a, pending: true, revision: 1, data: {lessons: 'unreadable'}};
  for (const archiveFailure of [false, true]) {
    const cache = localCache([[key, broken]]);
    if (archiveFailure) {
      const persist = cache.set;
      cache.set = async (destination, value) => {
        if (destination.includes(':unreadable:')) throw Error('Device storage unavailable');
        return persist(destination, value);
      };
    }
    const store = new Store({cache});
    await store.init();
    assert.equal(store.data.lessons[0].title, 'A');
    if (archiveFailure) assert.deepEqual(cache.records.get(key), broken);
    else assert.ok([...cache.records].some(([destination, value]) =>
      destination.startsWith(`${key}:unreadable:`) && value.data.lessons === broken.data.lessons));
    store.mutate(data => { data.lessons[0].title = 'A revised'; });
    await store.flush();
    if (archiveFailure) assert.deepEqual(cache.records.get(key), broken);
  }
  assert.equal(writes, 2);
});

function fakeIndexedDB() {
  const partitions = new Map();
  return {partitions, open(name) {
    const query = {};
    const records = partitions.get(name) || new Map();
    partitions.set(name, records);
    queueMicrotask(() => {
      query.result = {close(){}, transaction() {
        const tx = {objectStore() { return {
          getAll() {
            const event = {};
            queueMicrotask(() => { event.result = [...records.values()]; event.onsuccess(); });
            return event;
          },
          put(attempt) { records.set(attempt.id, structuredClone(attempt)); queueMicrotask(() => tx.oncomplete()); },
          delete(id) { records.delete(id); queueMicrotask(() => tx.oncomplete()); },
        }; }};
        return tx;
      }};
      query.onsuccess();
    });
    return query;
  }};
}

test('Mirror uses separate owner stores even when lesson and attempt IDs are equal', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor); else delete globalThis.indexedDB; });
  const indexedDB = fakeIndexedDB();
  Object.defineProperty(globalThis, 'indexedDB', {configurable: true, value: indexedDB});
  indexedDB.partitions.set('echo-mirror-local', new Map([['id', {id: 'id', lessonId: 'lesson', text: 'Legacy'}]]));
  await writeAttempt(owners.a, {id: 'id', lessonId: 'lesson', text: 'A'});
  await writeAttempt(owners.b, {id: 'id', lessonId: 'lesson', text: 'B'});
  assert.deepEqual(await savedAttempts(null, 'lesson'), []);
  assert.equal((await savedAttempts(owners.a, 'lesson'))[0].text, 'A');
  assert.equal((await savedAttempts(owners.b, 'lesson'))[0].text, 'B');
  await writeAttempt(owners.b, {id: 'id'}, true);
  assert.deepEqual(await savedAttempts(owners.b, 'lesson'), []);
  assert.equal((await savedAttempts(owners.a, 'lesson'))[0].text, 'A');
  assert.equal(indexedDB.partitions.get('echo-mirror-local').get('id').text, 'Legacy');

  const mirror = new EchoMirror({notify(){}, tick(){}, pause(){}, restore(){}});
  mirror.setOwner(owners.a);
  mirror.saved = await savedAttempts(owners.a, 'lesson');
  mirror.setOwner(owners.b);
  assert.deepEqual(mirror.saved, []);
  assert.equal(mirror.lesson, null);
});

test('verified cloud writes and reload work when IndexedDB reads fail', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let remote = library('Original'), revision = 1;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method === 'PUT') {
      const request = JSON.parse(init.body);
      assert.equal(request.expectedRevision, revision);
      assert.equal(init.headers.get(header), owners.a);
      remote = request.data;
      return Response.json({revision: ++revision}, {headers: {[header]: owners.a}});
    }
    return Response.json({revision, data: remote}, {headers: {[header]: owners.a}});
  });
  const cache = {get: async () => { throw Error('IndexedDB blocked'); },
    set: async () => { assert.fail('An unreadable cache must not be overwritten'); }};
  const store = new Store({cache});
  await store.init();
  assert.equal(store.mode, 'cloud');
  assert.equal(store.cacheStatus, 'unavailable');
  store.mutate(data => { data.lessons[0].title = 'Cloud-only change'; });
  await store.flush();
  assert.equal(store.mode, 'cloud');
  assert.equal(store.pending, false);
  assert.equal(store.revision, 2);
  const reloaded = new Store({cache});
  await reloaded.init();
  assert.equal(reloaded.data.lessons[0].title, 'Cloud-only change');
  assert.equal(reloaded.cacheStatus, 'unavailable');
});

test('a hung cache transaction does not block cloud acknowledgement', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  t.mock.method(globalThis, 'fetch', async (_path, init) => init.method === 'PUT'
    ? Response.json({revision: 2}, {headers: {[header]: owners.a}}) : response('a'));
  const store = new Store({cache: {get: async () => undefined, set: () => new Promise(() => {})}});
  await store.init();
  assert.equal(store.cacheStatus, 'pending');
  store.mutate(data => { data.lessons[0].title = 'Server acknowledgement'; });
  await store.flush();
  assert.equal(store.pending, false);
  assert.equal(store.revision, 2);
  assert.equal(store.mode, 'cloud');
  t.mock.timers.tick(2500);
  await new Promise(setImmediate);
  assert.equal(store.cacheStatus, 'unavailable');
  assert.equal(store.mode, 'cloud');
});

test('simultaneous storage and network failures keep unsent work in memory and preserve remote retry', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method !== 'PUT') return response('a');
    if (++writes === 1) return new Response(null, {status: 503});
    return Response.json({revision: 2}, {headers: {[header]: owners.a}});
  });
  const cache = {get: async () => undefined, set: async () => { throw Error('Device quota'); }};
  const store = new Store({cache});
  await store.init();
  store.mutate(data => { data.lessons[0].title = 'Waiting for the server'; });
  await store.flush();
  await new Promise(setImmediate);
  assert.equal(store.mode, 'offline');
  assert.equal(store.cacheStatus, 'unavailable');
  assert.equal(store.pending, true);
  assert.equal(store.data.lessons[0].title, 'Waiting for the server');
  t.mock.timers.tick(2000);
  await store.saving;
  assert.equal(writes, 2);
  assert.equal(store.mode, 'cloud');
  assert.equal(store.pending, false);
});

test('a retained capacity rejection only retries when an explicit corrected snapshot is submitted', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method !== 'PUT') return response('a');
    writes.push(JSON.parse(init.body));
    if (writes.length === 1) return Response.json({code: 'storage-too-large'}, {status: 413, headers: {[header]: owners.a}});
    return Response.json({revision: 2}, {headers: {[header]: owners.a}});
  });
  const cache = localCache();
  const store = new Store({cache});
  await store.init();
  store.mutate(data => { data.lessons[0].source = 'Large import'; });
  await store.flush();
  await store.saveCache();
  assert.equal(store.mode, 'rejected');
  assert.equal(store.saveError.code, 'storage-too-large');
  assert.equal(store.cacheStatus, 'saved');
  assert.equal(store.pending, true);
  assert.equal(store.revision, 1);
  await store.connect();
  await store.retry();
  assert.equal(writes.length, 1);

  const reloaded = new Store({cache});
  await reloaded.init();
  assert.equal(reloaded.data.lessons[0].source, 'Large import');
  await reloaded.retry();
  assert.equal(reloaded.saveError.code, 'storage-too-large');
  assert.equal(writes.length, 1);
  reloaded.mutate(data => { data.lessons[0].progress.position = 1; });
  t.mock.timers.tick(90_000);
  await reloaded.flush();
  assert.equal(writes.length, 1);
  reloaded.mutate(data => { data.lessons[0].source = ''; });
  await reloaded.retry();
  assert.equal(writes.length, 2);
  assert.equal(writes[1].data.lessons[0].source, '');
  assert.equal(reloaded.mode, 'cloud');
  assert.equal(reloaded.pending, false);
  assert.equal(reloaded.saveError, null);
});

test('an ingress 413 without an owner header remains actionable and does not unlock private data', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method !== 'PUT') return response('a');
    if (++writes === 1) return new Response('<html>Request too large</html>', {status: 413});
    return new Response(null, {status: 401});
  });
  const store = new Store({cache: localCache()});
  await store.init();
  store.mutate(data => { data.lessons[0].source = 'Pending changes'; });
  await store.flush();
  assert.equal(store.owner, owners.a);
  assert.equal(store.mode, 'rejected');
  assert.equal(store.saveError.code, 'state-too-large');
  assert.equal(store.data.lessons[0].source, 'Pending changes');
  store.mutate(data => { data.lessons[0].source = ''; });
  await store.retry();
  assert.equal(store.mode, 'locked');
  assert.equal(store.owner, null);
  assert.deepEqual(store.data.lessons, []);
});

test('oversized multibyte state is refused before starting a network write', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method === 'PUT') writes++;
    return response('a');
  });
  const store = new Store({cache: {get: async () => undefined, set: async () => {}}});
  await store.init();
  store.mutate(data => { data.lessons[0].source = 'é'.repeat(8_000_000); });
  await store.flush();
  assert.equal(store.mode, 'rejected');
  assert.equal(store.saveError.code, 'state-too-large');
  assert.equal(store.pending, true);
  assert.equal(writes, 0);
});

test('an older 413 does not stamp a corrected cached snapshot with its rejection across reload', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let finishOld, writes = 0;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method !== 'PUT') return response('a');
    if (++writes === 1) return new Promise(resolve => { finishOld = resolve; });
    assert.equal(JSON.parse(init.body).data.lessons[0].source, 'reduced');
    return Response.json({revision: 2}, {headers: {[header]: owners.a}});
  });
  const cache = localCache();
  const store = new Store({cache});
  await store.init();
  store.mutate(data => { data.lessons[0].source = 'original larger body'; });
  const saving = store.flush();
  assert.ok(finishOld);
  store.mutate(data => { data.lessons[0].source = 'reduced'; });
  finishOld(Response.json({code: 'storage-too-large'}, {status: 413, headers: {[header]: owners.a}}));
  await saving;
  await store.saveCache();
  assert.equal(cache.records.get(`state:${owners.a}`).saveError, null);
  const reloaded = new Store({cache});
  await reloaded.init();
  assert.equal(reloaded.mode, 'cloud');
  assert.equal(reloaded.saveError, null);
  await reloaded.flush();
  assert.equal(writes, 2);
  assert.equal(reloaded.pending, false);
});

test('an older cache transaction holds a coherent snapshot when a later write fails', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  t.mock.method(globalThis, 'fetch', async () => response('a'));
  let finishOld, accepted, count = 0;
  const cache = {get: async () => undefined, set: async (_key, snapshot) => {
    if (++count > 1) throw Error('Device quota');
    await new Promise(resolve => { finishOld = resolve; });
    accepted = structuredClone(snapshot);
  }};
  const store = new Store({cache});
  await store.init();
  await new Promise(setImmediate);
  store.mutate(data => { data.tags.push('unsent edit'); });
  finishOld();
  await store.saveCache();
  assert.equal(accepted.pending, false);
  assert.deepEqual(accepted.data.tags, []);
  assert.equal(store.cacheStatus, 'unavailable');
  assert.equal(store.pending, true);
  assert.deepEqual(store.data.tags, ['unsent edit']);
});

test('returning to an owner preserves cache write order without inheriting an old timeout', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let account = 'a', finishOld, aWrites = 0;
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method === 'PUT') throw Error('Synthetic outage');
    return response(account);
  });
  const cache = localCache(), persist = cache.set;
  cache.set = async (key, snapshot) => {
    if (key.endsWith(owners.a) && ++aWrites === 1) await new Promise(resolve => { finishOld = resolve; });
    return persist(key, snapshot);
  };
  const store = new Store({cache});
  await store.init();
  await new Promise(setImmediate);
  const oldGeneration = store.generation;
  account = 'b';
  await store.connect();
  await store.saveCache();
  account = 'a';
  await store.connect();
  assert.notEqual(store.generation, oldGeneration);
  store.mutate(data => { data.tags.push('new owner session'); });
  t.mock.timers.tick(2500);
  await new Promise(setImmediate);
  assert.equal(store.cacheStatus, 'pending');
  assert.equal(aWrites, 1);
  finishOld();
  await store.saveCache();
  assert.equal(aWrites, 2);
  assert.equal(store.cacheStatus, 'saved');
  assert.equal(cache.records.get(`state:${owners.a}`).pending, true);
  assert.deepEqual(cache.records.get(`state:${owners.a}`).data.tags, ['new owner session']);
});

test('a timed-out cache write remains unavailable through edits and a failed cloud save', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (init.method === 'PUT') throw Error('Synthetic outage');
    return response('a');
  });
  let finish, latest, deviceWrites = 0;
  const store = new Store({cache: {get: async () => undefined, set: async (_key, snapshot) => {
    if (++deviceWrites === 1) await new Promise(resolve => { finish = resolve; });
    latest = snapshot;
  }}});
  await store.init();
  await new Promise(setImmediate);
  t.mock.timers.tick(2500);
  await new Promise(setImmediate);
  assert.equal(store.cacheStatus, 'unavailable');
  store.mutate(data => { data.tags.push('new pending work'); });
  assert.equal(store.cacheStatus, 'unavailable');
  await store.flush();
  assert.equal(store.mode, 'offline');
  assert.equal(store.pending, true);
  assert.equal(store.cacheStatus, 'unavailable');
  assert.equal(deviceWrites, 1);
  finish();
  await store.saveCache();
  assert.equal(store.cacheStatus, 'saved');
  assert.equal(latest.pending, true);
  assert.deepEqual(latest.data.tags, ['new pending work']);
});
