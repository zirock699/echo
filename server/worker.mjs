import {handleAudio} from './audio.mjs';
/** Authenticated Sites API backed by managed D1 and R2. */
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const MAX_STATE_BYTES=16_000_000,MAX_ROW_BYTES=1_950_000;
async function encodeSnapshot(data){
 const text=JSON.stringify(data);
 if(new TextEncoder().encode(text).length<300_000)return text;
 let prefix='@echo-id:';while(text.includes(prefix))prefix+='@';
 const ids=[],index=new Map();
 const body=text.replace(/"([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})"/gi,(_,id)=>{
  if(!index.has(id)){index.set(id,ids.length);ids.push(id);}
  return JSON.stringify(prefix+index.get(id).toString(36));
 });
 const encoded=JSON.stringify({codec:'echo-snapshot-uuid-v1',prefix,ids,body});
 return new Response(new Blob([encoded]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
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
    if(url.pathname!=='/api/state'&&!url.pathname.startsWith('/api/audio'))return env.ASSETS?.fetch(request) || new Response('Not found',{status:404});
    const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
    // WARNING: trust ONLY in a Sites environment with access restrictions and trusted identity header injection.
    if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send({error:'Sign in with ChatGPT is required.'},401);
    if(url.pathname==='/api/audio'||url.pathname.startsWith('/api/audio/'))return handleAudio(request,env,email);
    if(!env.DB)return send({error:'Database binding DB is not configured.'},503);
    try{
      if(request.method==='GET'){
        const row=await env.DB.prepare('SELECT revision, data, payload FROM user_state WHERE owner = ?').bind(email).first();
        return send(row?{revision:row.revision,data:await decodeSnapshot(row.payload??row.data)}:{revision:0,data:null});
      }
      if(request.method==='PUT'){
        if(Number(request.headers.get('content-length'))>MAX_STATE_BYTES)return send({error:'Backup exceeds size limit.'},413);
        const body=await request.text();if(new TextEncoder().encode(body).length>MAX_STATE_BYTES)return send({error:'State exceeds size limit.'},413);
        let payload;try{payload=JSON.parse(body);}catch{return send({error:'Invalid JSON'},400);}
        const {expectedRevision,data}=payload||{};
        if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!data||!Array.isArray(data.lessons)||!Array.isArray(data.collections)||!Array.isArray(data.sessions)||typeof data.preferences!=='object')return send({error:'Invalid state payload'},400);
        if(data.lessons.length>3000||data.collections.length>1000||data.sessions.length>20000)return send({error:'State limits exceeded'},413);
        const snapshot=await encodeSnapshot(data);
        if((typeof snapshot==='string'?new TextEncoder().encode(snapshot).length:snapshot.byteLength)>MAX_ROW_BYTES)return send({error:'Compressed library exceeds storage limit. Export a backup before reducing the library.'},413);
        const storedText=typeof snapshot==='string'?snapshot:'{"encoding":"gzip-uuid-v1"}',payloadBytes=typeof snapshot==='string'?null:snapshot;
        // CAS prevents overwriting concurrent changes. Client must resolve 409 explicitly.
        let result;
        if(expectedRevision===0){
          result=await env.DB.prepare('INSERT OR IGNORE INTO user_state (owner,revision,data,payload,updated_at) VALUES (?,1,?,?,?)').bind(email,storedText,payloadBytes,Date.now()).run();
        }else{
          result=await env.DB.prepare('UPDATE user_state SET revision = revision + 1, data = ?, payload = ?, updated_at = ? WHERE owner = ? AND revision = ?').bind(storedText,payloadBytes,Date.now(),email,expectedRevision).run();
        }
        if(result.meta?.changes===1)return send({revision:expectedRevision+1});
        const row=await env.DB.prepare('SELECT revision,data,payload FROM user_state WHERE owner = ?').bind(email).first();
        return send({revision:row?.revision||0,data:row?await decodeSnapshot(row.payload??row.data):null,error:'A newer version exists. Choose which copy to keep.'},409);
      }
      return send({error:'Method not allowed'},405);
    }catch(e){return send({error:'Persistence is temporarily unavailable.'},503);}
  }
};
