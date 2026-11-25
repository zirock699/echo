import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {appendFile,cp,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createInterface} from 'node:readline';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {MAX_STATE_BYTES} from '../src/sync-limits.mjs';

test('development preview serves only app assets and the fixture API',async t=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const staging=await mkdtemp(path.join(tmpdir(),'echo-dev-preview-'));
 let server;
 let exited;
 t.after(async()=>{
  if(server&&server.exitCode===null&&server.signalCode===null){
   server.kill();
   await exited;
  }
  await rm(staging,{recursive:true,force:true});
 });

 const inputs=[
  'index.html','sw.js','manifest.webmanifest','src','assets','server','scripts/dev.mjs',
  'scripts/dev-state.mjs','scripts/shell-assets.mjs','tests/viewport.html','tests/notices.html',
 ];
 for(const input of inputs){
  const destination=path.join(staging,input);
  await mkdir(path.dirname(destination),{recursive:true});
  await cp(path.join(root,input),destination,{recursive:true});
 }
 await writeFile(path.join(staging,'planning-notes.txt'),'Synthetic note outside the public app.');
 await writeFile(path.join(staging,'assets','draft-notes.txt'),'Synthetic note beside app assets.');

 server=spawn(process.execPath,['scripts/dev.mjs','--port','0'],{
  cwd:staging,stdio:['ignore','pipe','pipe'],
 });
 exited=once(server,'exit');
 let startupError='';
 server.stderr.on('data',data=>{startupError+=data;});
 const lines=createInterface({input:server.stdout});
 const [ready]=await Promise.race([
  once(lines,'line',{signal:AbortSignal.timeout(5000)}),
  exited.then(()=>{throw Error(`Development preview stopped during startup: ${startupError}`);}),
 ]);
 const port=/^Echo Studio preview 127\.0\.0\.1:(\d+)$/.exec(ready)?.[1];
 assert.ok(port,ready);
 const request=(route,init)=>fetch(`http://127.0.0.1:${port}${route}`,{
  ...init,signal:AbortSignal.timeout(5000),
 });

 let response=await request('/');
 assert.equal(response.status,200);
 assert.match(await response.text(),/src="\/src\/app\.mjs"/);
 for(const [route,type] of [
  ['/src/app.mjs',/^text\/javascript/],['/src/style.css',/^text\/css/],
  ['/assets/icon.svg',/^image\/svg\+xml/],['/manifest.webmanifest',/^application\/manifest\+json/],
  ['/sw.js',/^text\/javascript/],['/tests/notices.html',/^text\/html/],['/tests/viewport.html',/^text\/html/],
 ]){
  response=await request(route,{method:'HEAD'});
  assert.equal(response.status,200,route);
  assert.match(response.headers.get('content-type'),type);
  assert.equal(await response.text(),'');
 }

 for(const route of ['/planning-notes.txt','/assets/draft-notes.txt']){
  response=await request(route);
  assert.equal(response.status,404,route);
  assert.equal(await response.text(),'Not found');
 }
 const manifest=async()=>{
  const worker=await request('/sw.js');
  assert.equal(worker.status,200);
  const descriptor=/^const SHELL = (.*);$/m.exec(await worker.text());
  assert.ok(descriptor);
  return JSON.parse(descriptor[1]);
 };
 const initialShell=await manifest();
 assert.ok(initialShell.assets['/src/navigation.mjs']);
 assert.ok(initialShell.assets['/assets/icon-512.png']);
 assert.equal(initialShell.assets['/tests/notices.html'],undefined);
 await appendFile(path.join(staging,'src/style.css'),'\n/* Local edit for the shell version regression. */\n');
 const editedShell=await manifest();
 assert.notEqual(editedShell.cache,initialShell.cache);
 assert.notEqual(editedShell.assets['/src/style.css'],initialShell.assets['/src/style.css']);
 assert.equal(editedShell.assets['/src/app.mjs'],initialShell.assets['/src/app.mjs']);

 response=await request('/api/state');
 assert.equal(response.status,200);
 const state=await response.json();
 assert.equal(state.revision,0);
 assert.equal(state.data,null);

 const owner=response.headers.get('x-echo-owner');
 const headers={'content-type':'application/json','x-echo-owner':owner};
 const data={lessons:[],collections:[],sessions:[],preferences:{}};
 response=await request('/api/state',{method:'PUT',headers,body:JSON.stringify({expectedRevision:0,data})});
 assert.equal(response.status,200);
 assert.equal((await response.json()).revision,1);

 const chunk=new Uint8Array(1_000_000).fill(32);
 let sent=0;
 const body=new ReadableStream({
  pull(controller){
   if(sent>MAX_STATE_BYTES)return new Promise(()=>{}); // Deliberately leave the body open until rejected.
   sent+=chunk.byteLength;
   controller.enqueue(chunk);
  },
 });
 response=await request('/api/state',{method:'PUT',headers,body,duplex:'half'});
 assert.equal(response.status,413);
 assert.equal(response.headers.get('x-echo-owner'),owner);
 assert.equal((await response.json()).code,'state-too-large');
 assert.deepEqual(await (await request('/api/state')).json(),{revision:1,data});
});
