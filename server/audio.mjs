const AUDIO_TYPES=new Set(['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','audio/wave','audio/ogg','audio/webm','audio/flac','audio/x-flac','image/jpeg','image/png','image/webp']);
const MAX_AUDIO=50*1024*1024;
const audioJSON=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
export async function handleAudio(request,env,owner){
 if(!env.BUCKET)return audioJSON({error:'Audio storage is temporarily unavailable.'},503);
 const url=new URL(request.url),id=url.pathname.slice('/api/audio/'.length);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner));
 const prefix='audio/'+[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')+'/';
 try{
  if(url.pathname==='/api/audio'&&request.method==='POST'){
   const type=(request.headers.get('content-type')||'').split(';')[0].toLowerCase();
   if(!AUDIO_TYPES.has(type))return audioJSON({error:'Choose an MP3, M4A, AAC, WAV, OGG, WebM or FLAC audio file.'},415);
   const declared=Number(request.headers.get('content-length')||request.headers.get('x-file-size'));
   if(!Number.isSafeInteger(declared)||declared<1)return audioJSON({error:'The audio file size could not be read. Try selecting the file again.'},411);
   if(declared>MAX_AUDIO)return audioJSON({error:'Choose an audio file smaller than 50 MB.'},413);
   // Bound memory before reading; browser File uploads provide Content-Length.
   const buffer=new Uint8Array(declared);const reader=request.body?.getReader();if(!reader)return audioJSON({error:'The upload was empty.'},400);let received=0;while(true){const {value,done}=await reader.read();if(done)break;if(received+value.byteLength>declared){await reader.cancel();return audioJSON({error:'The upload was too large.'},413);}buffer.set(value,received);received+=value.byteLength;}if(received!==declared)return audioJSON({error:'The upload was incomplete or too large.'},413);
   let name;try{name=decodeURIComponent(request.headers.get('x-file-name')||'audio');}catch{name='audio';}
   name=name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,180);
   const audioId=crypto.randomUUID();
   await env.BUCKET.put(prefix+audioId,buffer,{httpMetadata:{contentType:type},customMetadata:{name}});
   return audioJSON({id:audioId,name,type,size:buffer.byteLength,url:'/api/audio/'+audioId},201);
  }
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))return audioJSON({error:'Audio not found.'},404);
  const key=prefix+id;
  if(request.method==='DELETE'){await env.BUCKET.delete(key);return new Response(null,{status:204});}
  if(!['GET','HEAD'].includes(request.method))return audioJSON({error:'Method not allowed.'},405);
  const meta=await env.BUCKET.head(key);if(!meta)return audioJSON({error:'Audio not found. Upload it again from lesson settings.'},404);
  const headers=new Headers({'content-type':meta.httpMetadata?.contentType||'audio/mpeg','content-length':String(meta.size),'accept-ranges':'bytes','cache-control':'private, no-store','x-content-type-options':'nosniff'});
  let range=null;const requested=request.headers.get('range');
  if(requested){
   const m=requested.match(/^bytes=(\d*)-(\d*)$/);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'content-range':`bytes */${meta.size}`}});
   const start=m[1]?Number(m[1]):Math.max(0,meta.size-Number(m[2]));
   const end=m[1]&&m[2]?Math.min(meta.size-1,Number(m[2])):meta.size-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=meta.size||end<start)return new Response(null,{status:416,headers:{'content-range':`bytes */${meta.size}`}});
   range={offset:start,length:end-start+1};headers.set('content-length',String(range.length));headers.set('content-range',`bytes ${start}-${end}/${meta.size}`);
  }
  const status=range?206:200;if(request.method==='HEAD')return new Response(null,{status,headers});
  const object=await env.BUCKET.get(key,range?{range}:undefined);if(!object)return audioJSON({error:'Audio not found.'},404);
  return new Response(object.body,{status,headers});
 }catch{return audioJSON({error:'The audio file could not be accessed. Please retry.'},503);}
}
