import {decodeCaption,parseImportedTranscript} from './import-transcript.mjs';
/** Bounded ZIP reader: central-directory validation before any decompression. */
import {parseTranscript,validateSegments,uid} from './transcript.mjs';
export const LIMITS={archive:300*1024*1024,total:600*1024*1024,file:50*1024*1024,entries:5000};
const decoder=new TextDecoder();
export function safePath(path){if(!path||path.includes('\\')||path.includes('\0')||path.startsWith('/')||/^[a-z]:/i.test(path)||path.split('/').some(p=>p==='..'||p==='.'))throw Error('Archive contains an unsafe path.');return path;}
async function crc32(bytes){let c=0xffffffff,index=0;for(const b of bytes){if(++index%262144===0)await new Promise(r=>setTimeout(r,0));c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export async function openZip(file){
 if(!file.size||file.size>LIMITS.archive)throw Error('Choose a ZIP smaller than 300 MB.');
 const tail=new Uint8Array(await file.slice(Math.max(0,file.size-65557)).arrayBuffer()),v=new DataView(tail.buffer);let e=-1;
 for(let i=tail.length-22;i>=0;i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===tail.length){e=i;break;}
 if(e<0)throw Error('This is not a supported ZIP archive.');
 const count=v.getUint16(e+10,true),size=v.getUint32(e+12,true),offset=v.getUint32(e+16,true);
 if(v.getUint16(e+4,true)||v.getUint16(e+6,true)||count===65535||count>LIMITS.entries||size>4*1024*1024||offset+size>file.size)throw Error('Split, ZIP64 or oversized archives are unsupported.');
 const central=new Uint8Array(await file.slice(offset,offset+size).arrayBuffer()),d=new DataView(central.buffer),entries=new Map();let at=0,total=0;
 for(let i=0;i<count;i++){
  if(at+46>central.length||d.getUint32(at,true)!==0x02014b50)throw Error('ZIP directory is damaged.');
  const flags=d.getUint16(at+8,true),method=d.getUint16(at+10,true),packed=d.getUint32(at+20,true),length=d.getUint32(at+24,true),n=d.getUint16(at+28,true),extra=d.getUint16(at+30,true),comment=d.getUint16(at+32,true),local=d.getUint32(at+42,true),crc=d.getUint32(at+16,true);
  const name=safePath(decoder.decode(central.slice(at+46,at+46+n)));at+=46+n+extra+comment;
  if(at>central.length||flags&1||![0,8].includes(method)||((d.getUint32(at-(46+n+extra+comment)+38,true)>>>16)&0xf000)===0xa000)throw Error('Encrypted, linked or unsupported ZIP entries are not allowed.');
  total+=length;if(length>LIMITS.file||total>LIMITS.total||(length>1024*1024&&length/Math.max(1,packed)>250))throw Error('ZIP exceeds safe decompression limits (50 MB per file, 600 MB total).');
  if(name.endsWith('/')||name.startsWith('__MACOSX/')||name.split('/').at(-1).startsWith('.'))continue;
  if(!/\.(json|srt|vtt|jpg|jpeg|png|webp|mp3|m4a|aac|wav|ogg|webm|flac)$/i.test(name))throw Error(`Unsupported archive file: ${name}`);
  if(entries.has(name)||local+30+packed>offset)throw Error('Duplicate or damaged ZIP entry.');
  entries.set(name,{name,length,packed,method,local,crc});
 }
 return {entries,async read(name){const entry=entries.get(name);if(!entry)return null;const head=new DataView(await file.slice(entry.local,entry.local+30).arrayBuffer());if(head.getUint32(0,true)!==0x04034b50)throw Error('Invalid ZIP file header.');const start=entry.local+30+head.getUint16(26,true)+head.getUint16(28,true);if(start+entry.packed>offset)throw Error('Invalid ZIP file bounds.');let bytes;
  const blob=file.slice(start,start+entry.packed);
  if(entry.method===0)bytes=new Uint8Array(await blob.arrayBuffer());
  else {const reader=blob.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let got=0;while(true){const {value,done}=await reader.read();if(done)break;got+=value.length;if(got>entry.length){await reader.cancel();throw Error('Unexpected decompression size.');}chunks.push(value);}bytes=new Uint8Array(got);let p=0;for(const c of chunks){bytes.set(c,p);p+=c.length;}}
  if(bytes.length!==entry.length||await crc32(bytes)!==entry.crc)throw Error(`ZIP integrity check failed: ${name}`);return bytes;
 }};
}
export const audioType=name=>({mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm',flac:'audio/flac'})[name?.split('.').at(-1).toLowerCase()];
export function validAudio(bytes,type){const h=decoder.decode(bytes.slice(0,16));return type==='audio/mpeg'?(h.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224)):type==='audio/wav'?h.startsWith('RIFF')&&h.slice(8,12)==='WAVE':type==='audio/mp4'?h.slice(4,8)==='ftyp':type==='audio/ogg'?h.startsWith('OggS'):type==='audio/flac'?h.startsWith('fLaC'):type==='audio/webm'?bytes[0]===26&&bytes[1]===69:type==='audio/aac'?bytes[0]===255&&(bytes[1]&246)===240:false;}
export async function inspectPackage(file,notify=()=>{}){
 const zip=await openZip(file),names=[...zip.entries.keys()],json=async name=>{const entry=zip.entries.get(name);if(entry?.length>2*1024*1024)throw Error('Metadata is too large.');const b=await zip.read(name);return b?JSON.parse(decoder.decode(b)):null;};
 const manifestName=names.find(n=>n.split('/').at(-1)==='manifest.json');let manifest=[],warnings=[];
 if(manifestName){try{manifest=await json(manifestName);if(!Array.isArray(manifest))throw Error();}catch{manifest=[];warnings.push('Manifest is invalid; discovered lesson folders instead.');}}
 const root=manifestName?manifestName.slice(0,-'manifest.json'.length):'';
 const folders=[...new Set(names.filter(n=>/\/(metadata\.json|audio\.[^/]+|transcript\.srt)$/.test('/'+n)).map(n=>n.slice(0,n.lastIndexOf('/'))))];
 const ordered=[];for(const m of manifest){if(!m||typeof m!=='object')continue;const folder=folders.find(f=>f.split('/').at(-1)===m.video_id||f===root+String(m.audio||'').split('/').slice(0,-1).join('/'));if(folder&&!ordered.includes(folder))ordered.push(folder);}for(const f of folders)if(!ordered.includes(f))ordered.push(f);
 const lessons=[];
 for(const [index,folder] of ordered.entries()){
  const notes=[];let meta=manifest.find(m=>m?.video_id===folder.split('/').at(-1))||{};
  try{const local=await json(folder+'/metadata.json');if(local)meta={...meta,...local};else notes.push('Metadata missing; used folder filenames.');}catch{notes.push('Invalid metadata; used available manifest and filenames.');}
  const lookup=name=>names.find(n=>n.toLowerCase()===name.toLowerCase());
  const resolve=(value,conventional)=>{if(typeof value==='string'){safePath(value);for(const candidate of [root+value,value,folder+'/'+value,folder+'/'+value.split('/').at(-1)])if(lookup(candidate))return lookup(candidate);}return conventional.map(lookup).find(Boolean);};
  try{
   const audio=resolve(meta.audio,['mp3','m4a','aac','wav','ogg','webm','flac'].map(e=>folder+'/audio.'+e));
   const thumbnail=resolve(meta.thumbnail,[folder+'/thumbnail.jpg',folder+'/thumbnail.png',folder+'/thumbnail.webp']);const frame=resolve(meta.frame,[folder+'/frame.jpg',folder+'/frame.png']);
   const captionFiles=names.filter(n=>n.startsWith(folder+'/')&&!n.slice(folder.length+1).includes('/')&&/\.(srt|vtt)$/i.test(n));
   const transcript=resolve(meta.transcript,[folder+'/transcript.srt',folder+'/captions.srt',folder+'/transcript.vtt',...(captionFiles.length===1?captionFiles:[])]);let source='',segments=[],phrases=[];
   if(transcript){if(zip.entries.get(transcript).length>2*1024*1024)throw Error('Transcript exceeds 2 MB.');source=decodeCaption(await zip.read(transcript));const parsed=parseImportedTranscript(source,transcript);segments=parsed.segments;phrases=parsed.phrases;notes.push(...parsed.notes);if(!phrases.length)notes.push('Transcript unavailable: no valid timed speech cues.');}
   else notes.push('Transcript unavailable; audio-only playback.');
   const folderTitle=folder.split('/').at(-1).replace(/[_-]+/g,' '),title=String(meta.title||'').trim()||(!/^[a-zA-Z0-9_-]{11}$/.test(folder.split('/').at(-1))?folderTitle:`Lesson ${index+1}`);
   let error=!audio?'Audio file is missing.':!audioType(audio)?'Unsupported audio format.':null;if(audio&&!error&&!validAudio(await zip.read(audio),audioType(audio)))error='Audio file header is invalid or unsupported.';
   lessons.push({folder,title,meta,audio,thumbnail,frame,transcript,source,segments,phrases,grouping:'balanced',notes,error});
  }catch(e){lessons.push({folder,title:folder.split('/').at(-1),meta,notes,error:e.message});}
  notify(`Inspected ${index+1} of ${ordered.length} lessons`);await new Promise(r=>setTimeout(r,0));
 }
 return {zip,lessons,warnings,title:file.name.replace(/\.zip$/i,'').replace(/[_-]+/g,' ').trim()||'Imported course'};
}
