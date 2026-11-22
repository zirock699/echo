import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
test('pending cloud saves retry after a temporary failure without losing local edits',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const s=new Store();s.mode='cloud';s.pending=true;s.saveCache=async()=>{};
 let calls=0;
 globalThis.fetch=async()=>{if(++calls===1)throw Error('Network unavailable');return Response.json({revision:1});};
 await s.flush();assert.equal(s.mode,'offline');assert.equal(s.pending,true);
 t.mock.timers.tick(2000);await new Promise(setImmediate);
 assert.equal(calls,2);assert.equal(s.mode,'cloud');assert.equal(s.pending,false);assert.equal(s.revision,1);
});
test('conflicts stop automatic writes until the user chooses which copy to keep',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const s=new Store();s.mode='cloud';s.pending=true;s.saveCache=async()=>{};
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({revision:2,data:s.data},{status:409});};
 await s.flush();t.mock.timers.tick(60000);await new Promise(setImmediate);
 assert.equal(calls,1);assert.equal(s.mode,'conflict');assert.equal(s.pending,true);
});
