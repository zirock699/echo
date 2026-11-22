import {handleAudio} from './audio.mjs';
/** Authenticated Sites API backed by managed D1 and R2. */
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
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
        const row=await env.DB.prepare('SELECT revision, data FROM user_state WHERE owner = ?').bind(email).first();
        return send(row?{revision:row.revision,data:JSON.parse(row.data)}:{revision:0,data:null});
      }
      if(request.method==='PUT'){
        if(Number(request.headers.get('content-length'))>3_000_000)return send({error:'Backup exceeds size limit.'},413);
        const body=await request.text();if(body.length>3_000_000)return send({error:'State exceeds size limit.'},413);
        let payload;try{payload=JSON.parse(body);}catch{return send({error:'Invalid JSON'},400);}
        const {expectedRevision,data}=payload||{};
        if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!data||!Array.isArray(data.lessons)||!Array.isArray(data.collections)||!Array.isArray(data.sessions)||typeof data.preferences!=='object')return send({error:'Invalid state payload'},400);
        if(data.lessons.length>3000||data.collections.length>1000||data.sessions.length>20000)return send({error:'State limits exceeded'},413);
        // CAS prevents overwriting concurrent changes. Client must resolve 409 explicitly.
        let result;
        if(expectedRevision===0){
          result=await env.DB.prepare('INSERT OR IGNORE INTO user_state (owner,revision,data,updated_at) VALUES (?,1,?,?)').bind(email,JSON.stringify(data),Date.now()).run();
        }else{
          result=await env.DB.prepare('UPDATE user_state SET revision = revision + 1, data = ?, updated_at = ? WHERE owner = ? AND revision = ?').bind(JSON.stringify(data),Date.now(),email,expectedRevision).run();
        }
        if(result.meta?.changes===1)return send({revision:expectedRevision+1});
        const row=await env.DB.prepare('SELECT revision,data FROM user_state WHERE owner = ?').bind(email).first();
        return send({revision:row?.revision||0,data:row?JSON.parse(row.data):null,error:'A newer version exists. Choose which copy to keep.'},409);
      }
      return send({error:'Method not allowed'},405);
    }catch(e){return send({error:'Persistence is temporarily unavailable.'},503);}
  }
};
