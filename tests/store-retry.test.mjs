import test from 'node:test';
import assert from 'node:assert/strict';
import {Store, initialData} from '../src/store.mjs';
const owner='a'.repeat(64),headers={'x-echo-owner':owner};
test('pending cloud saves retry after a temporary failure without losing local edits',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const s=new Store();s.owner=owner;s.authenticated=true;s.mode='cloud';s.pending=true;s.saveCache=async()=>{};
 let calls=0;
 globalThis.fetch=async()=>{if(++calls===1)throw Error('Network unavailable');return Response.json({revision:1},{headers});};
 await s.flush();assert.equal(s.mode,'offline');assert.equal(s.pending,true);
 t.mock.timers.tick(2000);await new Promise(setImmediate);
 assert.equal(calls,2);assert.equal(s.mode,'cloud');assert.equal(s.pending,false);assert.equal(s.revision,1);
});
test('conflicts stop automatic writes until the user chooses which copy to keep',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const s=new Store();s.owner=owner;s.authenticated=true;s.mode='cloud';s.pending=true;s.saveCache=async()=>{};
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({revision:2,data:s.data},{status:409,headers});};
 await s.flush();t.mock.timers.tick(60000);await new Promise(setImmediate);
 assert.equal(calls,1);assert.equal(s.mode,'conflict');assert.equal(s.pending,true);
});


test('source-cue recovery backs up generated cuts and preserves playback position and coverage',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const s=new Store(),phrase={id:'p',start:0,end:1,text:'First. 2 00:00:01,000 --> 00:00:02,000 Second.'};
 s.data.lessons=[{id:'existing',grouping:'original',source:'1\n00:00:00,000 --> 00:00:01,000\nFirst.\n2\n00:00:01,000 --> 00:00:02,000\nSecond.',segments:[phrase],phrases:[phrase],statuses:{p:{practised:true}},progress:{position:.5,phraseId:'p',coverage:[[0,.5]]},tags:[],courseId:null,completed:false}];
 s.migrate();const l=s.data.lessons[0];assert.equal(l.phrases.length,2);assert.equal(l.playbackRecoveryBackup.phrases[0].text,phrase.text);assert.equal(l.progress.position,.5);assert.deepEqual(l.progress.coverage,[[0,.5]]);assert.equal(l.statuses[l.phrases[0].id].practised,true);assert.equal(s.pending,true);
});

async function progressFixture(t, send) {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: 0});
  const records = new Map();
  const cache = {
    get: async key => structuredClone(records.get(key)),
    set: async (key, value) => records.set(key, structuredClone(value)),
  };
  let data = {...initialData(), lessons: [{id: 'lesson', title: 'Practice', phrases: []}]};
  let revision = 1;
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    if (init.method !== 'PUT') return Response.json({revision, data}, {headers});
    const payload = JSON.parse(init.body);
    assert.equal(payload.expectedRevision, revision);
    writes.push(payload);
    const acknowledge = () => {
      data = payload.data;
      return Response.json({revision: ++revision}, {headers});
    };
    return send ? send(writes.length, acknowledge) : acknowledge();
  });
  const store = new Store({cache});
  await store.init();
  await store.saveCache();
  const checkpoint = position => store.checkpoint(data => {
    data.lessons[0].progress.position = position;
    data.lessons[0].progress.coverage = [[0, position]];
  });
  return {store, cache, writes, checkpoint, cached: () => records.get(`state:${owner}`)};
}

test('playback checkpoints immediately persist locally and share one fixed cloud deadline', async t => {
  const {store, writes, checkpoint, cached} = await progressFixture(t);
  checkpoint(.1);
  t.mock.timers.tick(5000);
  checkpoint(5);
  t.mock.timers.tick(5000);
  checkpoint(10);
  await new Promise(setImmediate);
  assert.equal(cached().pending, true);
  assert.equal(cached().data.lessons[0].progress.position, 10);
  assert.deepEqual(cached().data.lessons[0].progress.coverage, [[0, 10]]);
  t.mock.timers.tick(2600);
  await store.connect();
  assert.equal(writes.length, 0);
  t.mock.timers.tick(2399);
  assert.equal(writes.length, 0);
  t.mock.timers.tick(1);
  await store.saving;
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.lessons[0].progress.position, 10);
  assert.equal(store.pending, false);
});

test('a new verified tab recovers the latest local progress before its cloud deadline', async t => {
  const {store, cache, writes, checkpoint} = await progressFixture(t);
  checkpoint(5);
  await new Promise(setImmediate);
  store.resetOwner();
  t.mock.timers.tick(15_000);
  assert.equal(writes.length, 0);
  assert.throws(() => checkpoint(10), /Sign in/);
  const reopened = new Store({cache});
  await reopened.init();
  assert.equal(reopened.pending, true);
  assert.equal(reopened.data.lessons[0].progress.position, 5);
  await reopened.flush();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.lessons[0].progress.position, 5);
});

test('a verified reload accepts the full saved snapshot when its acknowledgement is lost', async t => {
  let release;
  const {store, cache, writes, checkpoint} = await progressFixture(t, (_count, acknowledge) => {
    const response = acknowledge();
    return new Promise(resolve => { release = () => resolve(response); });
  });
  checkpoint(6);
  store.mutate(data => { data.preferences.mode = 'manual'; });
  const saving = store.flush();
  await new Promise(setImmediate);

  const reopened = new Store({cache});
  await reopened.init();
  assert.equal(reopened.mode, 'cloud');
  assert.equal(reopened.revision, 2);
  assert.equal(reopened.pending, false);
  assert.equal(reopened.data.lessons[0].progress.position, 6);
  assert.equal(reopened.data.preferences.mode, 'manual');
  t.mock.timers.tick(15_000);
  assert.equal(writes.length, 1);

  release();
  await saving;
});

test('normal edit debounce precedes the progress deadline and includes current progress', async t => {
  const {store, writes, checkpoint} = await progressFixture(t);
  checkpoint(.1);
  t.mock.timers.tick(5000);
  store.mutate(data => { data.lessons[0].title = 'First edit'; });
  t.mock.timers.tick(500);
  store.mutate(data => { data.lessons[0].title = 'Last edit'; });
  t.mock.timers.tick(500);
  checkpoint(6);
  t.mock.timers.tick(499);
  assert.equal(writes.length, 0);
  t.mock.timers.tick(1);
  await store.saving;
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.lessons[0].title, 'Last edit');
  assert.equal(writes[0].data.lessons[0].progress.position, 6);
});

test('progress queued behind an in-flight snapshot keeps its own deadline', async t => {
  let release;
  const {store, writes, checkpoint} = await progressFixture(t, (count, acknowledge) =>
    count === 1 ? new Promise(resolve => { release = () => resolve(acknowledge()); }) : acknowledge());
  checkpoint(.1);
  const first = store.flush();
  t.mock.timers.tick(1000);
  checkpoint(1);
  release();
  await first;
  assert.equal(store.pending, true);
  t.mock.timers.tick(14999);
  assert.equal(writes.length, 1);
  t.mock.timers.tick(1);
  await store.saving;
  assert.equal(writes.length, 2);
  assert.equal(writes[1].data.lessons[0].progress.position, 1);
  assert.equal(store.pending, false);
});

test('a deliberate flush drains newer progress immediately after an older in-flight save', async t => {
  let release;
  const {store, writes, checkpoint} = await progressFixture(t, (count, acknowledge) =>
    count === 1 ? new Promise(resolve => { release = () => resolve(acknowledge()); }) : acknowledge());
  checkpoint(.1);
  const first = store.flush();
  checkpoint(2);
  const second = store.flush();
  checkpoint(3);
  const sameTransition = store.flush();
  assert.equal(writes.length, 1);
  release();
  await Promise.all([first, second, sameTransition]);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].data.lessons[0].progress.position, 3);
  assert.equal(store.pending, false);
  assert.equal(store.revision, 3);
});

test('new progress and a routine GET leave a transient failure on the existing retry deadline', async t => {
  const {store, writes, checkpoint} = await progressFixture(t, (count, acknowledge) =>
    count === 1 ? new Response(null, {status: 503, headers}) : acknowledge());
  checkpoint(.1);
  await store.flush();
  assert.equal(store.mode, 'offline');
  t.mock.timers.tick(1500);
  checkpoint(1.5);
  store.mutate(data => { data.lessons[0].title = 'Saved alongside progress'; });
  await store.connect();
  t.mock.timers.tick(499);
  assert.equal(writes.length, 1);
  t.mock.timers.tick(1);
  await store.saving;
  assert.equal(writes.length, 2);
  assert.equal(writes[1].data.lessons[0].progress.position, 1.5);
  assert.equal(writes[1].data.lessons[0].title, 'Saved alongside progress');
  assert.equal(store.mode, 'cloud');
});

test('a conflict prevents a deliberate follow-up even after a stale same-owner GET', async t => {
  let release;
  const {store, writes, checkpoint, cached} = await progressFixture(t, () =>
    new Promise(resolve => { release = resolve; }));
  checkpoint(5);
  const first = store.flush();
  checkpoint(6);
  const second = store.flush();
  release(Response.json({revision: 2, data: initialData()}, {status: 409, headers}));
  await Promise.all([first, second]);
  await store.connect();
  t.mock.timers.tick(20_000);
  assert.equal(writes.length, 1);
  assert.equal(store.mode, 'conflict');
  assert.equal(store.conflict.revision, 2);
  assert.equal(cached().data.lessons[0].progress.position, 6);
});

test('progress and a deliberate flush cannot bypass a permanent rejection', async t => {
  const {store, writes, checkpoint, cached} = await progressFixture(t, () =>
    Response.json({code: 'storage-too-large'}, {status: 413, headers}));
  checkpoint(.1);
  await store.flush();
  checkpoint(15);
  await store.flush();
  await new Promise(setImmediate);
  t.mock.timers.tick(60_000);
  assert.equal(writes.length, 1);
  assert.equal(store.mode, 'rejected');
  assert.equal(cached().data.lessons[0].progress.position, 15);
});
