import test from 'node:test';import assert from 'node:assert/strict';import worker from '../server/worker.mjs';
import {DevDB} from '../scripts/dev-state.mjs';
class Bucket{
 constructor(){this.data=new Map();}
 async put(key,body,options){this.data.set(key,{bytes:new Uint8Array(body),...options});}
 async head(key){const x=this.data.get(key);return x?{size:x.bytes.byteLength,httpMetadata:x.httpMetadata}:null;}
 async get(key,options){const x=this.data.get(key);if(!x)return null;const range=options?.range;return {body:range?x.bytes.slice(range.offset,range.offset+range.length):x.bytes};}
 async delete(key){this.data.delete(key);}
}
const req=(path,method='GET',owner='a@sample.test',body=null,extra={})=>new Request('https://example.test'+path,{method,headers:{...(owner?{'oai-authenticated-user-email':owner}:{}),...(body?{'content-type':'audio/wav','content-length':String(body.byteLength),'x-file-name':'practice.wav'}:{}),...extra},...(body?{body}:{})});
async function ownerHeaders(env,owner='a@sample.test'){const handshake=await worker.fetch(req('/api/state','GET',owner),env);assert.equal(handshake.status,200);return {'x-echo-owner':handshake.headers.get('x-echo-owner')};}
test('audio uploads persist privately, support seeking ranges and cannot be read by another owner',async()=>{
 const env={BUCKET:new Bucket(),DB:new DevDB()},body=new Uint8Array([1,2,3,4,5]),owner=await ownerHeaders(env);
 let r=await worker.fetch(req('/api/audio','POST','a@sample.test',body,owner),env);assert.equal(r.status,201);const file=await r.json();assert.equal(file.size,5);
 r=await worker.fetch(req(file.url),env);assert.equal(r.status,200);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3,4,5]);
 r=await worker.fetch(req(file.url,'GET','b@sample.test'),env);assert.equal(r.status,404);
 r=await worker.fetch(req(file.url,'GET',null),env);assert.equal(r.status,401);
 r=await worker.fetch(req(file.url,'GET','a@sample.test',null,{range:'bytes=1-3'}),env);assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 1-3/5');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[2,3,4]);
 r=await worker.fetch(req(file.url,'HEAD'),env);assert.equal(r.headers.get('content-length'),'5');assert.equal((await r.arrayBuffer()).byteLength,0);
 r=await worker.fetch(req(file.url,'GET','a@sample.test',null,{range:'bytes=99-100'}),env);assert.equal(r.status,416);
 r=await worker.fetch(req(file.url,'DELETE','b@sample.test',null,await ownerHeaders(env,'b@sample.test')),env);assert.equal(r.status,409);assert.equal((await worker.fetch(req(file.url),env)).status,200);
 const data={lessons:[],collections:[],sessions:[],preferences:{},pendingAudioDeletes:[file.url]};
 r=await worker.fetch(new Request('https://example.test/api/state',{method:'PUT',headers:{'oai-authenticated-user-email':'a@sample.test',...owner},body:JSON.stringify({expectedRevision:0,data})}),env);assert.equal(r.status,200);
 await worker.fetch(req(file.url,'DELETE','a@sample.test',null,owner),env);assert.equal((await worker.fetch(req(file.url),env)).status,404);
});
test('audio API rejects unsupported types and oversized uploads',async()=>{
 const env={BUCKET:new Bucket(),DB:new DevDB()},body=new Uint8Array([1]),owner=await ownerHeaders(env);
 assert.equal((await worker.fetch(req('/api/audio','POST','a@sample.test',body,{...owner,'content-type':'text/html'}),env)).status,415);
 assert.equal((await worker.fetch(req('/api/audio','POST','a@sample.test',body,{...owner,'content-length':String(51*1024*1024)}),env)).status,413);
 assert.equal((await worker.fetch(req('/api/audio','POST','a@sample.test',body,{...owner,'content-length':'5'}),env)).status,413);
});
