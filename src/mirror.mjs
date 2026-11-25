import {microphoneBlock,microphoneError,recordingOptions} from './microphone.mjs';
/** Echo Mirror: local-only phrase practice. No scoring, trimming or alignment. */
const MAX_BYTES=50*1024*1024;
const SOURCE_EDGE_MARGIN=.05;
const END_CLOCK_PRECISION=.005;
const ORIGINAL_WAIT_MS=15000;
const MAX_MISSING_FRACTION=.05;
const escape=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function peaks(samples,start=0,end=samples.length,bins=180){const result=[];for(let i=0;i<bins;i++){let peak=0;const a=Math.floor(start+(end-start)*i/bins),b=Math.min(samples.length,Math.max(a+1,Math.floor(start+(end-start)*(i+1)/bins)));for(let j=Math.max(0,a);j<b;j++)peak=Math.max(peak,Math.abs(samples[j]));result.push(peak);}const maximum=Math.max(...result,0.001);return result.map(p=>p/maximum);}
export function rotateAttempts(old,attempt){return [attempt,...old].slice(0,2);}
export function sameSegment(attempt,lesson,phrase){return attempt.lessonId===lesson.id&&attempt.phraseId===phrase.id&&attempt.start===phrase.start&&attempt.end===phrase.end&&attempt.audioId===lesson.audio.id&&attempt.offset===(lesson.audioOffset||0);}
function database(owner){
 if(!/^[a-f0-9]{64}$/.test(owner||''))throw Error('Sign in before saving practice recordings.');
 // Leave the old unbound database intact. There is no safe way to identify its owner.
 return new Promise((resolve,reject)=>{const r=indexedDB.open(`echo-mirror-local:${owner}`,1);r.onupgradeneeded=()=>r.result.createObjectStore('attempts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export async function savedAttempts(owner,lessonId){if(!owner)return [];const db=await database(owner);try{return await new Promise((resolve,reject)=>{const r=db.transaction('attempts').objectStore('attempts').getAll();r.onsuccess=()=>resolve(r.result.filter(a=>a.lessonId===lessonId));r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function writeAttempt(owner,attempt,remove=false){const db=await database(owner);try{await new Promise((resolve,reject)=>{const tx=db.transaction('attempts','readwrite');if(remove)tx.objectStore('attempts').delete(attempt.id);else tx.objectStore('attempts').put(attempt);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage write interrupted'));});}finally{db.close();}}
export class EchoMirror{
 constructor({notify,tick,pause,restore}){Object.assign(this,{notify,tick,pause,restore});this.owner=null;this.ownerGeneration=0;this.active=false;this.comparison=null;this.phase='idle';this.error='';this.message='';this.attempts=new Map();this.saved=[];this.token=0;this.clock=null;this.original=null;this.voice=null;this.stream=null;this.recorder=null;this.waveCache=new Map();this.context=null;this.originalBuffer=null;this.bufferIdentity='';this.savedURLs=new Map();this.playing=null;this.permissionOpen=false;this.permissionKind='';}
 setOwner(owner){
  if(this.owner===owner)return;
  this.owner=owner;this.ownerGeneration++;
  this.interrupt('',false);
  for(const list of this.attempts.values())for(const attempt of list)URL.revokeObjectURL(attempt.url);
  for(const url of this.savedURLs.values())URL.revokeObjectURL(url);
  this.context?.close().catch(()=>{});
  this.attempts.clear();this.savedURLs.clear();this.waveCache.clear();this.saved=[];
  this.active=false;this.comparison=null;this.lesson=null;this.phrase=null;
  this.original=null;this.voice=null;this.recorder=null;this.context=null;this.originalBuffer=null;
  this.bufferIdentity='';this.originalPeaks=null;this.waveError='';this.error='';
 }
 get key(){return this.lesson&&this.phrase?this.lesson.id+':'+this.phrase.id:'';}
 get list(){return this.attempts.get(this.key)||[];}
 get panelOpen(){return this.comparison!==null;}
 get busy(){return ['permission','original','recording','finishing','awaiting-play'].includes(this.phase);}
 enter(lesson,phrase,position,speed=1){if(!lesson?.audio||!phrase||!Number.isFinite(phrase.start)||!(phrase.end>phrase.start))throw Error('Mirror needs an audio lesson and a timed phrase.');if(this.active&&this.key===lesson.id+':'+phrase.id){this.speed=speed;return;}if(this.active)this.exit();if(this.lesson?.id!==lesson.id){this.saved=[];this.originalBuffer=null;for(const url of this.savedURLs.values())URL.revokeObjectURL(url);this.savedURLs.clear();}this.originalPeaks=null;this.lesson=lesson;this.phrase={...phrase};this.position=position;this.speed=speed;this.active=true;this.error='';this.message='Listen, record, then compare when you choose.';this.pause();this.notify();}
 releaseStream(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;}
 stopPlayback(){this.cancelOriginal?.();this.cancelOriginal=null;clearInterval(this.playTimer);this.original?.pause();this.voice?.pause();this.playing=null;}
 interrupt(message='Recording cancelled. Previous attempts are unchanged.',notify=true){this.token++;clearInterval(this.clock);this.stopPlayback();if(this.recorder?.state==='recording')this.recorder.stop();this.releaseStream();this.phase='idle';this.permissionOpen=false;this.message=message;if(notify){this.tick();this.notify();}}
 exit(){if(!this.active)return;this.interrupt('',false);this.active=false;this.comparison=null;this.restore(this.position);this.notify();}
 async record(){
  if(this.phase==='recording'){
   this.phase='finishing';this.message='Preparing your take…';clearInterval(this.clock);
   if(this.recorder.state!=='inactive')this.recorder.stop();
   this.notify();return;
  }
  if(this.busy){this.interrupt();return;}
  const blocked=microphoneBlock();if(blocked){this.error=blocked.message;this.permissionKind=blocked.kind;this.permissionOpen=true;this.notify();return;}
  const token=++this.token;this.stopPlayback();this.pause();this.error='';this.phase='permission';this.permissionOpen=true;this.permissionKind='prompt';this.message='Choose Allow in your browser’s microphone request. If it does not appear, check site permissions.';this.notify();
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(token!==this.token||!this.active){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
   const track=stream.getAudioTracks()[0];track.onended=()=>{if(token===this.token&&this.phase==='recording')this.interrupt('Microphone disconnected. Please try again.');};
   this.permissionOpen=false;this.permissionKind='granted';this.phase='original';this.message='Listen first. Recording starts when the phrase finishes.';this.notify();await this.originalSegment(token);
   if(token!==this.token||!this.active)return;this.playing=null;this.capture(token);
  }catch(e){if(token!==this.token)return;this.stopPlayback();this.message='';if(this.stream&&e.name==='NotAllowedError'){this.phase='awaiting-play';this.permissionKind='playback';this.permissionOpen=true;this.error='Microphone access is ready, but the browser needs another tap to play the original. Tap Continue to listen first, then record.';}else{const denied=this.phase==='permission';this.releaseStream();this.phase='idle';this.permissionKind=denied?'denied':'recording';this.permissionOpen=true;this.error=denied?microphoneError(e):e.message||'Recording could not start.';}this.notify();}
 }
 async continueRecording(){if(this.phase!=='awaiting-play'||!this.stream)return;const token=++this.token;this.error='';this.permissionOpen=false;this.phase='original';this.message='Listen first. Recording starts when the phrase finishes.';this.notify();try{await this.originalSegment(token);if(token===this.token&&this.active)this.capture(token);}catch(e){if(token!==this.token)return;this.releaseStream();this.stopPlayback();this.phase='idle';this.permissionKind='playback';this.permissionOpen=true;this.error=e.name==='NotAllowedError'?'The original audio could not play. Check browser audio permissions and try again.':e.message||'The original audio could not finish. Please try again.';this.notify();}}
 closePermission(){this.interrupt();this.permissionOpen=false;this.notify();}
 permissionPanel(){return `<div class="modal-shade mirror-shade"><section class="modal mirror-permission" role="dialog" aria-modal="true" aria-label="Microphone access"><header class="modal-head"><h2>Microphone access</h2><button id="mirror-permission-close" class="icon-btn" data-action="mirror-permission-close" aria-label="Cancel microphone request">×</button></header><p role="${this.error?'alert':'status'}">${escape(this.error||this.message)}</p><p class="mirror-help">Your microphone starts recording only after the original phrase finishes. Nothing is uploaded.</p>${this.phase==='permission'?'<p class="mirror-help">The permission prompt belongs to your browser. You can cancel here while it is open.</p>':this.phase==='awaiting-play'?'<button class="btn primary" data-action="mirror-continue">Continue</button>':['secure','policy','unsupported'].includes(this.permissionKind)?'<p class="mirror-help">If you are using an embedded preview or in-app browser, open Echo Studio directly in a supported browser.</p>':'<button class="btn primary" data-action="mirror-record">Try again</button>'}<button class="btn ghost" data-action="mirror-permission-close">Cancel</button></section></div>`;}
 waitForOriginalMetadata(audio){
  if(audio.error)return Promise.reject(Error('The original audio could not be loaded.'));
  if(audio.readyState>=1)return null;
  return new Promise((resolve,reject)=>{
   const finish=error=>{
    clearTimeout(timeout);
    audio.removeEventListener('loadedmetadata',ready);
    audio.removeEventListener('error',fail);
    if(this.cancelOriginal===cancel)this.cancelOriginal=null;
    if(error)reject(error);else resolve();
   };
   const ready=()=>finish();
   const fail=()=>finish(Error('The original audio could not be loaded.'));
   const cancel=()=>finish(Error('Cancelled'));
   const timeout=setTimeout(()=>finish(Error('The original audio did not load. Please retry.')),ORIGINAL_WAIT_MS);
   this.cancelOriginal=cancel;
   audio.addEventListener('loadedmetadata',ready);
   audio.addEventListener('error',fail);
  });
 }
 async originalSegment(token){
  this.voice?.pause();
  if(!this.original||this.original.src!==new URL(this.lesson.audio.url,location.href).href){
   this.original?.pause();this.original=new Audio(this.lesson.audio.url);this.original.preload='metadata';
  }
  const audio=this.original;
  audio.playbackRate=this.speed;audio.preservesPitch=true;
  const metadata=this.waitForOriginalMetadata(audio);
  if(metadata)await metadata;
  if(token!==this.token)throw Error('Cancelled');
  const offset=this.lesson.audioOffset||0;
  const cueStart=this.phrase.start+offset,cueEnd=this.phrase.end+offset;
  const duration=audio.duration;
  const start=Math.max(0,cueStart),end=Math.min(duration,cueEnd);
  // Decoder rounding shares one allowance across both edges, the settled
  // seek and an imprecise EOF. It must also stay small for short cues.
  const missingBudget=Math.min(SOURCE_EDGE_MARGIN,(cueEnd-cueStart)*MAX_MISSING_FRACTION);
  const missingWithinBudget=(heardStart,heardEnd)=>
   Math.max(0,heardStart-cueStart)+Math.max(0,cueEnd-heardEnd)<=missingBudget+1e-9;
  if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(duration)||end<=start||
     !missingWithinBudget(start,end)){
   throw Error('This phrase falls outside the available audio. Check the lesson timing offset.');
  }
  this.playing='original';this.elapsed=0;this.notify();
  if(token!==this.token)throw Error('Cancelled');
  return new Promise((resolve,reject)=>{
   const seekLimit=Math.min(SOURCE_EDGE_MARGIN,(end-start)/4);
   let sought=false,played=false,advanced=false,settled=false;
   let heardStart=start,lastTime=start,lastProgress=Date.now();
   const finish=error=>{
    if(settled)return;
    settled=true;
    clearInterval(timer);
    audio.removeEventListener('seeked',verifySeek);
    audio.removeEventListener('error',fail);
    audio.removeEventListener('ended',inspect);
    if(this.cancelOriginal===cancel)this.cancelOriginal=null;
    audio.pause();
    if(token===this.token){this.playing=null;this.tick();}
    if(error)reject(error);else resolve();
   };
   const cancel=()=>finish(Error('Cancelled'));
   const fail=()=>finish(Error('Original audio playback failed. Please try again.'));
   const seekFailed=()=>finish(Error('The original audio did not reach the phrase start. Check the timing offset and try again.'));
   const interrupted=()=>finish(Error('The original audio ended before the phrase finished. Check the timing offset and try again.'));
   const verifySeek=()=>{
    if(settled||sought||audio.seeking)return;
    const time=audio.currentTime;
    if(!Number.isFinite(time)||Math.abs(time-start)>seekLimit||!missingWithinBudget(time,end)){seekFailed();return;}
    sought=true;heardStart=time;lastTime=time;lastProgress=Date.now();
   };
   const inspect=()=>{
    if(settled)return;
    if(token!==this.token){cancel();return;}
    if(audio.error){fail();return;}
    const now=Date.now();
    if(!sought){if(now-lastProgress>=ORIGINAL_WAIT_MS)seekFailed();return;}
    if(!played){if(now-lastProgress>=ORIGINAL_WAIT_MS)fail();return;}
    if(audio.seeking){interrupted();return;}
    const time=audio.currentTime;
    if(!Number.isFinite(time)||time+END_CLOCK_PRECISION<lastTime){interrupted();return;}
    if(time>lastTime){advanced=true;lastTime=time;lastProgress=now;}
    this.elapsed=Math.max(0,(time-start)/this.speed);this.tick();
    const roundedEOF=audio.ended&&end===duration&&time>=end-END_CLOCK_PRECISION;
    if(advanced&&(time>=end||roundedEOF)&&missingWithinBudget(heardStart,Math.min(time,end))){finish();return;}
    if(audio.ended||audio.paused){interrupted();return;}
    if(now-lastProgress>=ORIGINAL_WAIT_MS)fail();
   };
   const timer=setInterval(inspect,20);
   this.cancelOriginal=cancel;
   audio.addEventListener('seeked',verifySeek);
   audio.addEventListener('error',fail);
   audio.addEventListener('ended',inspect);
   try{
    if(audio.currentTime!==start||audio.ended)audio.currentTime=start;
    verifySeek();
   }catch{seekFailed();return;}
   if(settled)return;
   // Invoke play in this gesture when metadata is ready. Recording still
   // waits for both a confirmed seek and actual media-clock advancement.
   try{Promise.resolve(audio.play()).then(()=>{played=true;inspect();},finish);}
   catch(e){finish(e);}
  });
 }
 capture(token){
  const chunks=[];let bytes=0;const stream=this.stream;const release=()=>{stream.getTracks().forEach(t=>t.stop());if(this.stream===stream)this.stream=null;};const recorder=new MediaRecorder(stream,recordingOptions());this.recorder=recorder;this.started=performance.now();this.phase='recording';this.message='Recording — tap Stop when you finish.';this.elapsed=0;
  recorder.ondataavailable=e=>{if(token!==this.token)return;bytes+=e.data.size;if(bytes+this.memoryBytes()>MAX_BYTES){this.interrupt('Recording memory is full. Delete an attempt before recording again.');return;}if(e.data.size)chunks.push(e.data);};
  recorder.onerror=()=>{if(token===this.token)this.interrupt('Recording was interrupted. Your previous attempts are still available.');};
  recorder.onstop=()=>{
   release();if(token!==this.token||!this.active)return;
   clearInterval(this.clock);
   const fromRecord=this.phase==='finishing';
   const blob=new Blob(chunks,{type:recorder.mimeType}),duration=(performance.now()-this.started)/1000;
   this.phase='idle';this.message='';
   if(!blob.size||duration<.15){this.error='No usable recording was captured. Please try again.';this.notify();return;}
   const attempt={id:crypto.randomUUID(),lessonId:this.lesson.id,phraseId:this.phrase.id,start:this.phrase.start,end:this.phrase.end,
    text:this.phrase.text,audioId:this.lesson.audio.id,offset:this.lesson.audioOffset||0,createdAt:Date.now(),duration,blob};
   attempt.url=URL.createObjectURL(blob);
   const old=this.list,keep=rotateAttempts(old,attempt);
   for(const a of old)if(!keep.includes(a)){URL.revokeObjectURL(a.url);this.waveCache.delete(a.id);}
   this.attempts.set(this.key,keep);this.comparison=null;this.error='';
   if(fromRecord)void this.togglePanel({fromRecord});
   else{this.message='Recording ready. Open Compare to listen back.';this.notify();}
  };
  recorder.start(1000);this.clock=setInterval(()=>{this.elapsed=(performance.now()-this.started)/1000;this.tick();},100);this.notify();
 }
 memoryBytes(){return [...this.attempts.values()].flat().reduce((sum,a)=>sum+a.blob.size,0);}
 async play(track){if(this.busy)return;if(this.playing===track){this.token++;this.stopPlayback();this.notify();return;}const token=++this.token;this.stopPlayback();this.pause();this.error='';try{if(track==='original'){this.notify();await this.originalSegment(token);}else{const a=[...this.list,...this.saved].find(a=>a.id===track);if(!a)return;const url=a.url||this.savedURL(a);const voice=new Audio(url);this.voice=voice;voice.playbackRate=1;this.playing=track;this.elapsed=0;voice.onended=()=>{if(token===this.token){this.stopPlayback();this.notify();}};voice.onerror=()=>{if(token===this.token){this.error='This attempt could not be played.';this.stopPlayback();this.notify();}};await voice.play();if(token!==this.token){voice.pause();return;}this.playTimer=setInterval(()=>{this.elapsed=voice.currentTime;this.tick();},100);this.notify();return;}if(token===this.token){this.playing=null;this.notify();}}catch(e){if(token===this.token){this.stopPlayback();this.error=e.message;this.notify();}}}
 savedURL(a){if(!this.savedURLs.has(a.id))this.savedURLs.set(a.id,URL.createObjectURL(a.blob));return this.savedURLs.get(a.id);}
 async togglePanel({fromRecord=false}={}){
  if(this.busy||!this.lesson)return;
  if(this.comparison){this.comparison=null;this.token++;this.stopPlayback();this.notify();return;}
  const {owner,lesson}=this,comparison={fromRecord};
  this.comparison=comparison;
  this.notify();
  try{const attempts=await savedAttempts(owner,lesson.id);if(this.comparison!==comparison)return;this.saved=attempts;}
  catch{if(this.comparison!==comparison)return;this.error='Saved attempts could not be read on this device. Temporary practice still works.';}
  this.notify();this.loadWaves();
 }
 async save(id){
  const a=this.list.find(a=>a.id===id);if(!a)return;
  const {owner,ownerGeneration}=this;
  try{
   const {url,...stored}=a;await writeAttempt(owner,stored);
   if(ownerGeneration!==this.ownerGeneration)return;
   if(this.lesson?.id===stored.lessonId)this.saved=this.saved.filter(x=>x.id!==id).concat(stored);
   this.message='Saved on this device only.';
  }catch{if(ownerGeneration!==this.ownerGeneration)return;this.error='Could not save this attempt. Device storage may be full or unavailable.';}
  this.notify();
 }
 async remove(id,saved=false){
  const {owner,ownerGeneration}=this;
  if(this.playing===id){this.token++;this.stopPlayback();}
  try{
   if(saved){
    await writeAttempt(owner,{id},true);if(ownerGeneration!==this.ownerGeneration)return;
    this.saved=this.saved.filter(a=>a.id!==id);
    if(this.savedURLs.has(id)){URL.revokeObjectURL(this.savedURLs.get(id));this.savedURLs.delete(id);}
   }else{const a=this.list.find(a=>a.id===id);if(a)URL.revokeObjectURL(a.url);this.attempts.set(this.key,this.list.filter(a=>a.id!==id));}
   this.waveCache.delete(id);
  }catch{if(ownerGeneration!==this.ownerGeneration)return;this.error='Could not delete the saved attempt. Please try again.';}
  this.notify();
 }
 async loadWaves(){
  const {comparison,lesson,phrase}=this;
  if(!comparison||comparison.loadingWaves||!lesson)return;
  const isCurrent=()=>comparison===this.comparison&&lesson===this.lesson&&phrase===this.phrase;
  comparison.loadingWaves=true;this.waveError='';this.notify();
  try{
   const context=this.context||=new (globalThis.AudioContext||globalThis.webkitAudioContext)();
   try{
    const identity=lesson.audio.id;
    if(this.bufferIdentity!==identity){this.originalBuffer=null;this.bufferIdentity=identity;}
    if(!this.originalBuffer){
     if(lesson.duration>600)throw Error('Original waveform unavailable for audio longer than 10 minutes on this device. Playback still works.');
     const response=await fetch(lesson.audio.url);
     if(!response.ok)throw Error('Original waveform audio could not be loaded.');
     const bytes=await response.arrayBuffer();
     if(!isCurrent())return;
     if(bytes.byteLength>MAX_BYTES)throw Error('This file is too large to visualise.');
     const decoded=await context.decodeAudioData(bytes);
     if(!isCurrent())return;
     if(decoded.duration>600)throw Error('This recording is too long to visualise safely. Playback still works.');
     this.originalBuffer=decoded;
    }
    const buffer=this.originalBuffer;
    const start=Math.max(0,phrase.start+(lesson.audioOffset||0))*buffer.sampleRate;
    const end=Math.min(buffer.length,(phrase.end+(lesson.audioOffset||0))*buffer.sampleRate);
    this.originalPeaks=peaks(buffer.getChannelData(0),start,end);
   }catch(e){if(!isCurrent())return;this.waveError=e.message||'Original waveform unavailable. Playback still works.';}
   for(const attempt of [...this.list,...this.saved]){
    if(this.waveCache.has(attempt.id))continue;
    try{
     const decoded=await context.decodeAudioData(await attempt.blob.arrayBuffer());
     if(!isCurrent())return;
     this.waveCache.set(attempt.id,{peaks:peaks(decoded.getChannelData(0)),duration:decoded.duration});
    }catch{if(!isCurrent())return;this.waveCache.set(attempt.id,{error:true});}
   }
  }catch(e){if(isCurrent())this.waveError=e.message||'Waveforms are unavailable in this browser. Listening and recording still work.';}
  finally{if(isCurrent()){comparison.loadingWaves=false;this.notify();}}
 }
 waveform(values,duration,total){if(!values)return '<p class="mirror-wave-empty">Waveform unavailable</p>';const width=360*duration/total;return `<svg class="mirror-wave" viewBox="0 0 360 48" preserveAspectRatio="none" role="img" aria-label="Waveform, ${duration.toFixed(1)} seconds"><path d="${values.map((p,i)=>{const x=(i+.5)*width/values.length;return `M${x.toFixed(1)},${(24-p*21).toFixed(1)}v${Math.max(1,p*42).toFixed(1)}`;}).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;}
 panel(){
  if(this.permissionOpen&&this.active)return this.permissionPanel();
  if(!this.comparison||!this.active)return '';
  const [latest,previous]=this.list;
  const duration=(this.phrase.end-this.phrase.start)/this.speed;
  const total=Math.max(duration,...[...this.list,...this.saved.filter(a=>sameSegment(a,this.lesson,this.phrase))].map(a=>this.waveCache.get(a.id)?.duration||a.duration));
  const track=(attempt,label,saved=false)=>{
   const wave=this.waveCache.get(attempt.id),length=wave?.duration||attempt.duration;
   const playing=this.playing===attempt.id,keep=this.saved.some(a=>a.id===attempt.id);
   const id=escape(attempt.id),verb=playing?'Pause':'Play';
   return `<section class="mirror-track mirror-track-take${playing?' is-playing':''}">
    <div class="mirror-track-head"><strong>${label}</strong><span>${length.toFixed(1)}s</span><button data-action="mirror-play" data-id="${id}" aria-label="${verb} ${label.toLowerCase()}">${verb}</button></div>
    ${this.waveform(wave?.peaks,length,total)}
    ${sameSegment(attempt,this.lesson,this.phrase)?'':'<p>Recorded against an earlier or different phrase. Original timing was retained.</p>'}
    <div class="mirror-track-actions">${saved?`<small>${escape(new Date(attempt.createdAt).toLocaleDateString())} · Saved on this device</small>`:`<button data-action="mirror-save" data-id="${id}" ${keep?'disabled':''}>${keep?'Saved':'Save attempt'}</button>`}<button data-action="mirror-delete" data-id="${id}" data-saved="${saved}">Delete</button></div>
   </section>`;
  };
  const playingReference=this.playing==='original';
  const returnFocus=this.comparison.fromRecord?'#mirror-main-record':'#mirror-compare';
  return `<div class="modal-shade mirror-shade"><section class="modal mirror-panel" role="dialog" aria-modal="true" aria-labelledby="mirror-comparison-title" data-focus-dialog="mirror:comparison" data-focus-return="${returnFocus}">
   <header class="modal-head"><h2 id="mirror-comparison-title" tabindex="-1" data-focus-initial>Listen back</h2><button id="mirror-close-panel" class="icon-btn" data-action="mirror-panel" aria-label="Close comparison">×</button></header>
   <p class="mirror-sentence">${escape(this.phrase.text)}</p>
   ${latest?'<p class="mirror-listen-tip">Listen for where you paused and which words stood out.</p>':''}
   <div class="mirror-pair">
    <section class="mirror-track mirror-track-reference${playingReference?' is-playing':''}">
     <div class="mirror-track-head"><strong>Reference</strong><span>${duration.toFixed(1)}s${this.speed!==1?' at '+this.speed+'×':''}</span><button data-action="mirror-play" data-id="original">${playingReference?'Pause':'Play'} reference</button></div>
     ${this.waveform(this.originalPeaks,duration,total)}
    </section>
    ${latest?track(latest,'Your take'):''}
   </div>
   ${latest?'<p class="mirror-help">Both waveforms share a time scale. Heights show relative volume within each track.</p>':'<p>Use Record in the player to listen first, then record your voice.</p>'}
   ${previous?`<details id="mirror-previous"><summary>Previous attempt</summary>${track(previous,'Previous attempt')}</details>`:''}
   ${this.saved.length?`<details id="mirror-saved"><summary>Saved attempts (${this.saved.length})</summary>${this.saved.map(a=>track(a,'Saved attempt',true)).join('')}</details>`:''}
   <p id="mirror-track-status" aria-live="off">${escape(this.playing?'Playing '+(playingReference?'reference':'your take'):this.message)}</p>
   ${this.comparison.loadingWaves?'<p role="status">Loading waveforms…</p>':''}${this.waveError?`<p>${escape(this.waveError)}</p>`:''}${this.error?`<p role="alert">${escape(this.error)}</p>`:''}
   <button class="btn ghost" data-action="mirror-exit">Back to reference</button><p class="mirror-help">Saved recordings stay on this device.</p>
  </section></div>`;
 }
 dispose(){this.comparison=null;this.interrupt('');for(const list of this.attempts.values())for(const a of list)URL.revokeObjectURL(a.url);for(const url of this.savedURLs.values())URL.revokeObjectURL(url);this.context?.close().catch(()=>{});this.originalBuffer=null;this.attempts.clear();}
}
