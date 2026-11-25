import test from 'node:test';
import assert from 'node:assert/strict';
import {Store, initialData} from '../src/store.mjs';
import {cacheKey, draftKey, sameDraftVersion} from '../src/device-cache.mjs';
import {syncIssueKey, syncNoticeHTML, syncProblem, syncSaveMessage} from '../src/sync-notice.mjs';

const identity = {a: 'a'.repeat(64), b: 'b'.repeat(64)};
const library = title => ({...initialData(), lastLessonId:'lesson',
  lessons:[{id:'lesson', title, phrases:[], progress:{position:0, coverage:[]}}]});

function fixture(t) {
  t.mock.timers.enable({apis:['Date', 'setTimeout'], now:1000});
  const rows = new Map();
  const reads = [];
  const cache = {
    async list(owner) {
      reads.push(owner);
      return structuredClone(new Map([...rows].filter(([key]) =>
        key === cacheKey(owner) || key.startsWith(draftKey(owner, '')))));
    },
    async get(key) { return structuredClone(rows.get(key)); },
    async set(key, value) { rows.set(key, structuredClone(value)); },
    async remove(key, reviewed) {
      if (reviewed && !sameDraftVersion(rows.get(key), reviewed)) return false;
      rows.delete(key);
      return true;
    },
  };
  const account = {owner:identity.a, online:true, holdAck:null, rejection:null};
  const remote = new Map([
    [identity.a, {revision:1, data:library('Synthetic A')}],
    [identity.b, {revision:1, data:library('Synthetic B')}],
  ]);
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_path, init) => {
    if (!account.online) throw Error('Fixture disconnected');
    if (!account.owner) return new Response(null, {status:401});
    const owner = account.owner;
    const headers = {'x-echo-owner':owner};
    const server = remote.get(owner);
    if (init.method !== 'PUT') return Response.json(server, {headers});
    assert.equal(init.headers.get('x-echo-owner'), owner);
    const {expectedRevision, data} = JSON.parse(init.body);
    writes.push({owner, expectedRevision, data});
    if (account.rejection) return Response.json({code:account.rejection}, {status:413, headers});
    if (expectedRevision !== server.revision) return Response.json(server, {status:409, headers});
    const accepted = {revision:server.revision+1, data};
    remote.set(owner, accepted);
    if (account.holdAck) await account.holdAck;
    return Response.json({revision:accepted.revision}, {headers});
  });
  return {cache, rows, account, remote, writes, reads};
}

async function open(cache) {
  const store = new Store({cache});
  await store.init();
  return store;
}

async function makeTwoCopies(t) {
  const env = fixture(t);
  const playback = await open(env.cache);
  const settings = await open(env.cache);
  playback.checkpoint(data => { data.lessons[0].progress.position = 8; });
  settings.mutate(data => { data.preferences.theme = 'light'; });
  await Promise.all([playback.saveCache(), settings.saveCache()]);
  return {...env, playback, settings};
}

test('two pending tabs recover independently and an explicit selection preserves the other copy', async t => {
  const {cache, rows, remote, writes} = await makeTwoCopies(t);
  const reopened = await open(cache);
  assert.equal(reopened.deviceReviewRequired, true);
  assert.equal(syncProblem(reopened).action, 'device-drafts');
  assert.match(syncSaveMessage(reopened), /more than one pending/);
  assert.equal(reopened.pending, false);
  assert.equal(reopened.data.lessons[0].progress.position, 0);
  assert.equal(reopened.deviceDrafts.length, 2);
  const progress = reopened.deviceDrafts.find(copy => copy.position === 8);
  const theme = reopened.deviceDrafts.find(copy => copy.theme === 'light');
  assert.ok(progress && theme);
  const backup = JSON.parse(reopened.exportDeviceDraft(theme.id));
  assert.equal(backup.data.preferences.theme, 'light');
  await reopened.flush();
  assert.deepEqual(writes, []);

  assert.equal(await reopened.useDeviceDraft(progress.id), true);
  assert.equal(reopened.deviceReviewRequired, false);
  assert.equal(reopened.data.lessons[0].progress.position, 8);
  await reopened.flush();
  assert.equal(remote.get(identity.a).revision, 2);
  assert.equal(remote.get(identity.a).data.lessons[0].progress.position, 8);
  assert.equal(rows.has(progress.id), false);
  assert.equal(rows.get(theme.id).data.preferences.theme, 'light');

  const later = await open(cache);
  assert.equal(later.mode, 'cloud');
  assert.equal(later.pending, false);
  assert.equal(later.data.lessons[0].progress.position, 8);
  assert.equal(later.deviceDrafts.length, 1);
  assert.equal(syncProblem(later).action, 'device-drafts');
  assert.equal(await later.useDeviceDraft(theme.id), true);
  assert.equal(later.mode, 'conflict');
  assert.equal(later.data.preferences.theme, 'light');
  assert.equal(later.conflict.data.lessons[0].progress.position, 8);
});

test('a dismissed device review reappears on a new alternative or changed content', async t => {
  const {cache, rows} = await makeTwoCopies(t);
  const store = await open(cache);
  const dismissed = syncIssueKey(store);
  assert.match(dismissed, /^device-drafts:\d+$/);
  const copy = store.deviceDrafts[0];
  const record = rows.get(copy.id);
  rows.set(copy.id, {...record, token:'new-cache-write', savedAt:record.savedAt+1});
  await store.refreshDeviceDrafts();
  assert.equal(syncIssueKey(store), dismissed);
  assert.equal(syncNoticeHTML(store, {dismissed}), '');

  const newId = draftKey(identity.a, 'third-copy');
  const alternative = structuredClone(record);
  alternative.data.lessons[0].progress.position = 15;
  rows.set(newId, {...alternative, token:'third-version'});
  await store.refreshDeviceDrafts();
  assert.match(syncNoticeHTML(store, {dismissed}), /more than one pending library copy/);
  const dismissedAgain = syncIssueKey(store);
  alternative.data.lessons[0].progress.position = 20;
  rows.set(newId, {...alternative, token:'changed-third-version'});
  await store.refreshDeviceDrafts();
  assert.notEqual(syncIssueKey(store), dismissedAgain);
});

test('legacy alternatives retain stable dismissal on refresh and distinguish review categories', async t => {
  const {cache, rows} = fixture(t);
  const id = draftKey(identity.a, 'earlier-copy');
  rows.set(id, {owner:identity.a, token:'earlier-version', revision:0, pending:true, data:library('Earlier')});
  const store = await open(cache);
  const earlier = syncIssueKey(store);
  assert.match(earlier, /^device-copy-earlier:\d+$/);
  const legacyId = cacheKey(identity.a);
  rows.set(legacyId, {owner:identity.a, revision:0, pending:true, data:library('Earlier legacy')});
  await store.refreshDeviceDrafts();
  const multiple = syncIssueKey(store);
  assert.match(multiple, /^device-drafts:\d+$/);
  assert.match(syncNoticeHTML(store, {dismissed:earlier}), /more than one pending library copy/);
  await store.refreshDeviceDrafts();
  assert.equal(syncIssueKey(store), multiple);
  rows.delete(id);
  await store.refreshDeviceDrafts();
  const onlyLegacy = syncIssueKey(store);
  assert.match(onlyLegacy, /^device-copy-earlier:\d+$/);
  rows.get(legacyId).data.preferences.theme = 'light';
  await store.refreshDeviceDrafts();
  assert.match(syncNoticeHTML(store, {dismissed:onlyLegacy}), /earlier device copy is available/);
});

test('identical copies made before acknowledgement recover without duplicate conflict', async t => {
  const {cache, rows} = fixture(t);
  const data = library('Same copy');
  for (const writer of ['first', 'second']) {
    rows.set(draftKey(identity.a, writer), {owner:identity.a, token:writer, revision:1, pending:true, data});
  }
  const store = await open(cache);
  assert.equal(store.pending, true);
  assert.equal(store.deviceReviewRequired, false);
  assert.equal(store.data.lessons[0].title, 'Same copy');
  assert.deepEqual(store.deviceDrafts, []);
  await store.flush();
  assert.equal(rows.has(draftKey(identity.a, 'first')), false);
  assert.equal(rows.has(draftKey(identity.a, 'second')), false);
});

test('reopening an unchanged draft during a failed connection does not multiply stored snapshots', async t => {
  const {cache, rows, account} = fixture(t);
  const original = draftKey(identity.a, 'first');
  const data = library('Resume draft');
  data.lessons[0].progress.position = 8;
  rows.set(original, {owner:identity.a, token:'first-version', revision:1, pending:true, data});
  let reopened;
  for (let attempt = 0; attempt < 3; attempt++) {
    account.online = true;
    reopened = await open(cache);
    assert.equal(reopened.pending, true);
    assert.equal(reopened.data.lessons[0].progress.position, 8);
    account.online = false;
    await reopened.flush();
    await reopened.saveCache();
    assert.equal(reopened.cacheStatus, 'saved');
    assert.deepEqual([...rows.keys()], [original]);
  }
  reopened.checkpoint(library => { library.lessons[0].progress.position = 12; });
  await reopened.saveCache();
  assert.deepEqual([...rows.values()].map(row => row.data.lessons[0].progress.position), [8, 12]);
});

test('a rejection on adopted content stays actionable and blocks unchanged future sends', async t => {
  const {cache, account, writes, rows} = fixture(t);
  const first = await open(cache);
  first.checkpoint(data => { data.lessons[0].progress.position = 8; });
  await first.saveCache();
  const reopened = await open(cache);
  account.rejection = 'storage-too-large';
  await reopened.flush();
  await reopened.saveCache();
  assert.equal(reopened.mode, 'rejected');
  assert.equal(reopened.saveError.code, 'storage-too-large');
  const later = await open(cache);
  assert.equal(later.mode, 'rejected');
  assert.equal(later.saveError.code, 'storage-too-large');
  await later.retry();
  assert.equal(writes.length, 1);
  assert.equal(rows.size, 2);
});

test('a stale review cannot replace or discard a newer revision of the same device copy', async t => {
  const {cache, rows} = await makeTwoCopies(t);
  const reopened = await open(cache);
  const copy = reopened.deviceDrafts.find(record => record.position === 8);
  const update = position => {
    const record = structuredClone(rows.get(copy.id));
    record.data.lessons[0].progress.position = position;
    record.token = crypto.randomUUID();
    rows.set(copy.id, record);
  };
  update(9);
  assert.equal(await reopened.useDeviceDraft(copy.id), false);
  assert.equal(reopened.deviceDrafts.find(record => record.id === copy.id).position, 9);
  update(10);
  assert.equal(await reopened.discardDeviceDraft(copy.id), false);
  assert.equal(rows.get(copy.id).data.lessons[0].progress.position, 10);
  assert.equal(await reopened.discardDeviceDraft(copy.id), true);
  assert.equal(rows.has(copy.id), false);
});

test('choosing another copy retains this tab’s pending work and does not bypass cloud CAS', async t => {
  const {cache, rows, remote, playback, settings} = await makeTwoCopies(t);
  await playback.refreshDeviceDrafts();
  assert.equal(playback.deviceReviewRequired, true);
  const settingsCopy = playback.deviceDrafts.find(copy => copy.theme === 'light');
  assert.ok(settingsCopy);
  assert.equal(await playback.useDeviceDraft(settingsCopy.id), true);
  assert.equal(playback.deviceReviewRequired, false);
  assert.equal(playback.data.preferences.theme, 'light');
  assert.ok([...rows.values()].some(copy => copy.pending && copy.data.lessons[0].progress.position === 8));
  await playback.flush();
  await settings.flush();
  assert.equal(settings.mode, 'conflict');
  assert.equal(remote.get(identity.a).revision, 2);
});

test('an acknowledgement preserves a scoped legacy row changed by an older client', async t => {
  const {cache, rows, remote, reads, account} = fixture(t);
  const old = {...library('Original v1 copy')};
  const legacy = {owner:identity.a, data:old, revision:1, pending:true};
  rows.set(cacheKey(identity.a), legacy);
  rows.set('state', {data:library('Unbound legacy'), revision:1, pending:true});
  const store = await open(cache);
  assert.equal(store.data.lessons[0].title, 'Original v1 copy');
  await store.saveCache();
  const hold = Promise.withResolvers();
  account.holdAck = hold.promise;
  const sending = store.flush();
  rows.set(cacheKey(identity.a), {...legacy, data:library('New change from older client')});
  hold.resolve();
  await sending;
  assert.equal(remote.get(identity.a).data.lessons[0].title, 'Original v1 copy');
  assert.equal(rows.get(cacheKey(identity.a)).data.lessons[0].title, 'New change from older client');
  assert.equal(rows.get('state').data.lessons[0].title, 'Unbound legacy');
  assert.deepEqual(reads, [identity.a]);
});

test('a crossed account transition invalidates a recovery choice before it can display old data', async t => {
  const {cache, account} = await makeTwoCopies(t);
  const reopened = await open(cache);
  const copy = reopened.deviceDrafts.find(record => record.position === 8);
  const started = Promise.withResolvers(), release = Promise.withResolvers();
  const get = cache.get;
  cache.get = async key => {
    if (key === copy.id) {
      started.resolve();
      await release.promise;
    }
    return get(key);
  };
  const choice = reopened.useDeviceDraft(copy.id);
  await started.promise;
  account.owner = identity.b;
  await reopened.connect();
  assert.equal(reopened.data.lessons[0].title, 'Synthetic B');
  assert.deepEqual(reopened.deviceDrafts, []);
  assert.equal(reopened.exportDeviceDraft(copy.id), null);
  release.resolve();
  assert.equal(await choice, false);
  assert.equal(reopened.data.lessons[0].title, 'Synthetic B');
  account.owner = identity.a;
  await reopened.connect();
  assert.equal(reopened.deviceDrafts.length, 2);
});

test('storage failure blocks replacing volatile working changes with another device copy', async t => {
  const {cache, playback} = await makeTwoCopies(t);
  await playback.refreshDeviceDrafts();
  const alternative = playback.deviceDrafts.find(record => record.theme === 'light');
  cache.set = async () => { throw Error('Fixture quota exhausted'); };
  playback.checkpoint(data => { data.lessons[0].progress.position = 12; });
  await playback.saveCache();
  assert.equal(playback.cacheStatus, 'unavailable');
  assert.equal(await playback.useDeviceDraft(alternative.id), false);
  assert.equal(playback.data.lessons[0].progress.position, 12);
  assert.equal(playback.deviceReviewRequired, true);
  assert.match(syncSaveMessage(playback), /only in this tab/);
});

test('keeping the working copy cannot retire media referenced by a reviewed alternative', async t => {
  const {playback, settings, writes} = await makeTwoCopies(t);
  const protectedId = '00000000-0000-4000-8000-000000000001';
  const protectedPath = '/api/audio/' + protectedId;
  const unreferencedPath = '/api/audio/00000000-0000-4000-8000-000000000002';
  settings.mutate(data => { data.lessons[0].audio = {id:protectedId, url:protectedPath}; });
  await settings.saveCache();
  await playback.refreshDeviceDrafts();
  assert.deepEqual(playback.deviceDraftMediaReferences(), new Set([protectedPath]));
  playback.mutate(data => { data.pendingAudioDeletes = [protectedPath, unreferencedPath]; });
  assert.equal(playback.deviceReviewRequired, true);
  playback.keepWorkingCopy();
  await playback.flush();
  assert.deepEqual(writes[0].data.pendingAudioDeletes, [unreferencedPath]);
});

test('retirement discovers a late durable draft before it records any server deletion', async t => {
  const {cache, writes} = fixture(t);
  const first = await open(cache), second = await open(cache);
  const protectedId = '00000000-0000-4000-8000-000000000001';
  const path = '/api/audio/' + protectedId;
  assert.deepEqual(first.deviceDrafts, []);
  first.mutate(data => { data.pendingAudioDeletes = [path]; });
  second.mutate(data => { data.lessons[0].audio = {id:protectedId, url:path}; });
  await second.saveCache();
  await first.flush();
  assert.deepEqual(writes, []);
  assert.equal(first.deviceReviewRequired, true);
  assert.deepEqual(first.deviceDraftMediaReferences(), new Set([path]));
  first.keepWorkingCopy();
  await first.flush();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.pendingAudioDeletes, undefined);
});

test('unavailable device enumeration omits retirement markers without blocking the account save', async t => {
  const {cache, writes} = fixture(t);
  const store = await open(cache);
  cache.list = async () => { throw Error('Fixture device reads interrupted'); };
  store.mutate(data => { data.pendingAudioDeletes = ['/api/audio/00000000-0000-4000-8000-000000000001']; });
  await store.flush();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.pendingAudioDeletes, undefined);
  assert.equal(store.pending, false);
});

test('an owner switch while checking device media references cancels the old PUT', async t => {
  const {cache, account, writes} = fixture(t);
  const store = await open(cache);
  store.mutate(data => { data.pendingAudioDeletes = ['/api/audio/00000000-0000-4000-8000-000000000001']; });
  const entered = Promise.withResolvers(), release = Promise.withResolvers();
  const list = cache.list;
  cache.list = async owner => {
    if (owner === identity.a) {
      entered.resolve();
      await release.promise;
    }
    return list(owner);
  };
  const retiring = store.flush();
  await entered.promise;
  account.owner = identity.b;
  await store.connect();
  release.resolve();
  await retiring;
  assert.equal(store.owner, identity.b);
  assert.deepEqual(writes, []);
  assert.equal(store.data.lessons[0].title, 'Synthetic B');
});
