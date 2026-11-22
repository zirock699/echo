import {migrateLibrary} from './courses.mjs';
import {uid} from './transcript.mjs';
export function initialData(){return {schemaVersion:2,courses:[],categories:[],tags:[],lessons:[],collections:[],sessions:[],preferences:{theme:'dark',mode:'manual',speed:1,grouping:'balanced',leadIn:.5,pauseType:'duration',fixedPause:4,multiplier:1.5,showText:true,showIPA:false,wakeLock:false,reduceMotion:false,startupLesson:'recent'},lastLessonId:null};}
const dbName='echo-studio-cache-v1';
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(dbName,1);req.onupgradeneeded=()=>{req.result.createObjectStore('kv');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function cacheGet(key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('kv');const q=tx.objectStore('kv').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);tx.oncomplete=()=>db.close();});}
async function cacheSet(key,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(value,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);});}
export class Store {
 constructor(){this.data=initialData();this.revision=0;this.mode='checking';this.pending=false;this.seq=0;this.conflict=null;this.onChange=()=>{};this.timer=null;this.saving=false;this.retryDelay=2000;}
 async init(){
   try{const saved=await cacheGet('state');if(saved?.data){this.data={...initialData(),...saved.data,preferences:{...initialData().preferences,...saved.data.preferences}};this.revision=saved.revision||0;this.pending=!!saved.pending;}}catch(e){console.warn('IndexedDB unavailable',e);this.mode='storage-error';}
   migrateLibrary(this.data);this.onChange();await this.connect();
 }
 async connect(){
   try{
     const res=await fetch('/api/state',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(5000)});
     if(!res.ok) throw new Error(`API ${res.status}`);
     const response=await res.json();
     if(this.pending && response.revision!==this.revision) {this.conflict=response;this.mode='conflict';}
     else if(!this.pending){this.data={...initialData(),...(response.data || initialData()),preferences:{...initialData().preferences,...response.data?.preferences}};this.revision=response.revision||0;this.mode='cloud';}
     else {this.mode='cloud';this.flush();}
     migrateLibrary(this.data);await this.saveCache();this.onChange();
   }catch(e){if(this.mode!=='storage-error')this.mode='local';this.onChange();}
 }
 async saveCache(){try{await cacheSet('state',{data:this.data,revision:this.revision,pending:this.pending});}catch(e){this.mode='storage-error';this.onChange();}}
 mutate(fn){fn(this.data);migrateLibrary(this.data);this.seq++;this.pending=true;this.onChange();this.saveCache();clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),1000);}
 async flush(){
   if(this.saving||!this.pending||this.mode==='conflict'||this.mode==='local'||this.mode==='storage-error'||this.mode==='checking')return;
   this.saving=true;const sequence=this.seq;const snapshot=JSON.stringify({expectedRevision:this.revision,data:this.data});
   try{
     const res=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot,signal:AbortSignal.timeout(12000)});
     if(res.status===409){this.conflict=await res.json();this.mode='conflict';}
     else if(!res.ok)throw new Error(`Save failed: ${res.status}`);
     else {const json=await res.json();this.revision=json.revision;this.pending=this.seq!==sequence;this.mode='cloud';this.retryDelay=2000;}
   }catch(e){this.mode='offline';}
   finally{this.saving=false;migrateLibrary(this.data);await this.saveCache();this.onChange();if(this.pending&&this.mode==='cloud'){clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),150);}else if(this.pending&&this.mode==='offline'){clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),this.retryDelay);this.retryDelay=Math.min(30000,this.retryDelay*2);}}
 }
 async retry(){if(this.mode==='offline')this.mode='cloud';if(this.mode==='local')return this.connect();return this.flush();}
 resolveConflict(keepLocal){if(!this.conflict)return;
   if(keepLocal){this.revision=this.conflict.revision;this.mode='cloud';this.conflict=null;this.pending=true;this.flush();}
   else {this.data={...initialData(),...this.conflict.data,preferences:{...initialData().preferences,...this.conflict.data?.preferences}};this.revision=this.conflict.revision;this.pending=false;this.mode='cloud';this.conflict=null;migrateLibrary(this.data);this.saveCache();this.onChange();}
 }
 export(){return JSON.stringify({app:'Echo Studio',version:1,exportedAt:new Date().toISOString(),data:this.data},null,2);}
 restore(raw){const v=JSON.parse(raw);if(v.app!=='Echo Studio'||!v.data||!Array.isArray(v.data.lessons)||!Array.isArray(v.data.collections)||!Array.isArray(v.data.sessions)||typeof v.data.preferences!=='object'||!v.data.preferences)throw Error('This is not a valid Echo Studio export.');if(v.data.lessons.length>3000||v.data.collections.length>1000||v.data.sessions.length>20000)throw Error('Backup exceeds supported limits.');this.mutate(d=>Object.assign(d,{...initialData(),...v.data}));}
}
export const createLesson=(videoId,title,source,format,segments,phrases,grouping,offset=0,speaker='')=>({id:uid(),videoId,title,speaker,source,format,segments,phrases,grouping,offset,duration:null,createdAt:Date.now(),updatedAt:Date.now(),favourite:false,statuses:{},progress:{position:0,phraseId:phrases[0]?.id||null,coverage:[],updatedAt:0},revisions:[],ipaOverrides:{}});
