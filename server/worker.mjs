import {handleAudio} from './audio.mjs';
import {validateSnapshot} from '../src/snapshot.mjs';
import {isManagedMediaPath,mediaReferences} from '../src/library-mutations.mjs';
import {MAX_STATE_BYTES,MAX_ROW_BYTES} from '../src/sync-limits.mjs';
/** Authenticated Sites API backed by managed D1 and R2. */
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const CAPACITY_MESSAGES={
 'state-too-large':'This library is too large to send. Export a backup before reducing the library.',
 'storage-too-large':'This library is too large to store even after compression. Export a backup before reducing the library.',
 'state-count-limit':'This library has too many lessons, collections or sessions. Export a backup before reducing it.',
};
const OWNER_HEADER='x-echo-owner';
const MEDIA_LEDGER_FORMAT='echo-accepted-media-v1';
class CapacityError extends Error {
 constructor(code){super(CAPACITY_MESSAGES[code]);this.code=code;}
}
function boundedBytes(stream,limit,code){
 let total=0;
 return stream.pipeThrough(new TransformStream({
  transform(chunk,controller){
   total+=chunk.byteLength;
   if(total>limit)throw new CapacityError(code);
   controller.enqueue(chunk);
  },
 }));
}
async function ownerKey(email){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('echo-state-owner-v1\0'+email));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function ownerResponse(response,owner){
 const headers=new Headers(response.headers);
 headers.set(OWNER_HEADER,owner);
 headers.set('cache-control',response.headers.get('cache-control')||'no-store');
 return new Response(response.body,{status:response.status,headers});
}
async function readRecord(row){
 if(!row)return {data:null,retired:new Set()};
 const stored=await decodeSnapshot(row.payload??row.data);
 // Valid legacy client snapshots always have a top-level lessons array.
 // Only this server envelope can confer retirement authority.
 const encoded=stored?.format===MEDIA_LEDGER_FORMAT&&!Object.hasOwn(stored,'lessons');
 const data=encoded?stored.snapshot:stored;
 const ledger=encoded?stored._retiredMedia:[];
 if(!Array.isArray(ledger)||!ledger.every(isManagedMediaPath))throw Error('Invalid media retirement record');
 const retired=new Set(ledger);
 return {data,retired};
}
async function readLibrary(row){
 const {data,retired}=await readRecord(row);
 if(!row)return {data,retired};
 if(data&&typeof data==='object')delete data._retiredMedia;
 validateSnapshot(data);
 if(data.pendingAudioDeletes){
  const references=mediaReferences(data);
  const pending=[...new Set(data.pendingAudioDeletes)].filter(path=>retired.has(path)&&!references.has(path));
  if(pending.length)data.pendingAudioDeletes=pending;
  else delete data.pendingAudioDeletes;
 }
 return {data,retired};
}
async function encodeSnapshot(data){
 const text=JSON.stringify(data);
 if(text.length<300_000&&new TextEncoder().encode(text).length<300_000)return text;
 let prefix='@echo-id:';while(text.includes(prefix))prefix+='@';
 const ids=[],index=new Map();
 const body=text.replace(/"([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})"/gi,(_,id)=>{
  if(!index.has(id)){index.set(id,ids.length);ids.push(id);}
  return JSON.stringify(prefix+index.get(id).toString(36));
 });
 const encoded=JSON.stringify({codec:'echo-snapshot-uuid-v1',prefix,ids,body});
 const compressed=new Blob([encoded]).stream().pipeThrough(new CompressionStream('gzip'));
 return new Response(boundedBytes(compressed,MAX_ROW_BYTES,'storage-too-large')).arrayBuffer();
}
async function decodeSnapshot(stored){
 if(typeof stored==='string')return JSON.parse(stored);
 const decoded=JSON.parse(await new Response(new Blob([new Uint8Array(stored)]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
 if(decoded.codec!=='echo-snapshot-uuid-v1'||!/^@echo-id:@*$/.test(decoded.prefix)||!Array.isArray(decoded.ids)||typeof decoded.body!=='string')throw Error('Invalid snapshot encoding');
 return JSON.parse(decoded.body.replace(new RegExp('"'+decoded.prefix+'([0-9a-z]+)"','g'),(_,key)=>{
  const id=decoded.ids[parseInt(key,36)];if(typeof id!=='string')throw Error('Invalid snapshot ID');return JSON.stringify(id);
 }));
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const audioRoute=url.pathname==='/api/audio'||url.pathname.startsWith('/api/audio/');
    if(url.pathname!=='/api/state'&&!audioRoute)return env.ASSETS?.fetch(request) || new Response('Not found',{status:404});
    const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
    // WARNING: trust ONLY in a Sites environment with access restrictions and trusted identity header injection.
    if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send({error:'Sign in with ChatGPT is required.'},401);
    const isWrite=(audioRoute&&['POST','DELETE'].includes(request.method))||(!audioRoute&&request.method==='PUT');
    // Media elements cannot attach a header. Reads still use the authenticated owner namespace.
    const expectedOwner=request.headers.get(OWNER_HEADER);
    if(audioRoute&&!isWrite&&!expectedOwner)return handleAudio(request,env,email);
    const owner=await ownerKey(email);
    if(isWrite&&!expectedOwner)return send({error:'Confirm the current account before saving.'},428);
    if(expectedOwner&&expectedOwner!==owner)return send({error:'The signed-in account has changed.'},412);
    const reply=(data,status)=>ownerResponse(send(data,status),owner);
    const capacity=code=>reply({code,error:CAPACITY_MESSAGES[code]},413);
    if(audioRoute&&request.method!=='DELETE')return ownerResponse(await handleAudio(request,env,email),owner);
    if(!env.DB)return reply({error:'Database binding DB is not configured.'},503);
    try{
      const currentRow=()=>env.DB.prepare('SELECT revision, data, payload FROM user_state WHERE owner = ?').bind(email).first();
      if(audioRoute){
        if(!isManagedMediaPath(url.pathname))return reply({error:'Audio not found.'},404);
        const {data,retired}=await readLibrary(await currentRow());
        if(!retired.has(url.pathname)||mediaReferences(data).has(url.pathname)){
          return reply({code:'media-not-retired',error:'Save the library without this media before deleting it.'},409);
        }
        // The ledger is monotonic. A racing revision cannot reintroduce
        // this reference while the bucket deletion is in progress.
        return ownerResponse(await handleAudio(request,env,email),owner);
      }
      if(request.method==='GET'){
        const row=await currentRow();
        return reply({revision:row?.revision||0,data:(await readLibrary(row)).data});
      }
      if(request.method==='PUT'){
        if(Number(request.headers.get('content-length'))>MAX_STATE_BYTES)return capacity('state-too-large');
        const stream=request.body;
        const body=stream?await new Response(boundedBytes(stream,MAX_STATE_BYTES,'state-too-large')).text():'';
        let payload;try{payload=JSON.parse(body);}catch{return reply({error:'Invalid JSON'},400);}
        const {expectedRevision,data}=payload||{};
        if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return reply({error:'Invalid state revision.'},400);
        if(data&&typeof data==='object')delete data._retiredMedia;
        try{validateSnapshot(data);}catch(e){return e instanceof RangeError?capacity('state-count-limit'):reply({error:e.message},400);}
        const conflict=async row=>reply({revision:row?.revision||0,data:(await readLibrary(row)).data,error:'A newer version exists. Choose which copy to keep.'},409);
        const previous=await currentRow();
        if((previous?.revision||0)!==expectedRevision)return await conflict(previous);
        const {retired}=await readRecord(previous);
        const references=mediaReferences(data);
        for(const path of references){
          if(retired.has(path))return reply({code:'media-retired',error:'That library refers to a retired file. Re-upload the media or use a newer backup before saving.'},422);
        }
        const hasQueue=Object.hasOwn(data,'pendingAudioDeletes');
        const pending=[...new Set(data.pendingAudioDeletes||[])].filter(path=>isManagedMediaPath(path)&&!references.has(path));
        if(pending.length)data.pendingAudioDeletes=pending;
        else delete data.pendingAudioDeletes;
        for(const path of pending)retired.add(path);
        const accepted=retired.size?{format:MEDIA_LEDGER_FORMAT,snapshot:data,_retiredMedia:[...retired]}:data;
        const snapshot=await encodeSnapshot(accepted);
        const storedText=typeof snapshot==='string'?snapshot:'{"encoding":"gzip-uuid-v1"}',payloadBytes=typeof snapshot==='string'?null:snapshot;
        // CAS prevents overwriting concurrent changes. Client must resolve 409 explicitly.
        let result;
        if(expectedRevision===0){
          result=await env.DB.prepare('INSERT OR IGNORE INTO user_state (owner,revision,data,payload,updated_at) VALUES (?,1,?,?,?)').bind(email,storedText,payloadBytes,Date.now()).run();
        }else{
          result=await env.DB.prepare('UPDATE user_state SET revision = revision + 1, data = ?, payload = ?, updated_at = ? WHERE owner = ? AND revision = ?').bind(storedText,payloadBytes,Date.now(),email,expectedRevision).run();
        }
        if(result.meta?.changes===1)return reply({revision:expectedRevision+1,...(hasQueue||pending.length?{pendingAudioDeletes:pending}:{})});
        return await conflict(await currentRow());
      }
      return reply({error:'Method not allowed'},405);
    }catch(e){return e instanceof CapacityError?capacity(e.code):reply({error:'Persistence is temporarily unavailable.'},503);}
  }
};
