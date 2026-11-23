import {AudioAdapter} from './audio.mjs';
import {selectedPhrases,speakingPause,addCoverage} from './transcript.mjs';
const YT_STATES={UNSTARTED:-1,ENDED:0,PLAYING:1,PAUSED:2,BUFFERING:3,CUED:5};
let apiPromise;
function loadYouTubeAPI(){
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
   if(window.YT?.Player){resolve(window.YT);return;}
   const old=window.onYouTubeIframeAPIReady;
   window.onYouTubeIframeAPIReady=()=>{old?.();resolve(window.YT);};
   const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>reject(Error('YouTube could not be loaded. Check your connection.'));document.head.append(script);
   setTimeout(()=>{if(!window.YT?.Player)reject(Error('YouTube player timed out. Please retry.'));},18000);
 });return apiPromise.catch(e=>{apiPromise=null;throw e;});
}
export const warmYouTube=()=>loadYouTubeAPI().catch(()=>null);
export const usesUploadedAudio=lesson=>!!(lesson?.audio?.id&&lesson.audio.url==='/api/audio/'+lesson.audio.id&&/^[a-f0-9-]{36}$/.test(lesson.audio.id)&&lesson.mediaSource!=='youtube');
export class PlayerEngine {
 constructor(){
   this.wantsPlayback=false;this.phraseDone=false;this.mediaIdentity='';this.generation=0;this.yt=null;this.ready=false;this.initialising=null;this.error='';this.lesson=null;this.phrase=null;this.mode='manual';this.loop=false;this.playing=false;this.state='idle';
   this.speed=1;this.requestedSpeed=1;this.leadIn=.5;this.config={pauseType:'duration',fixedPause:4,multiplier:1.5};
   this.selection='all';this.range=null;this.speakers=[];this.time=0;this.duration=0;this.timer=null;this.waitTimer=null;this.token=0;this.lastSample=null;
   this.seekTarget=null;this.seekRequestedAt=0;this.onPractised=()=>{};this.activeSeconds=0;this.previewEnd=null;this.session=null;this.onChange=()=>{};this.onTick=()=>{};this.onError=()=>{};this.onSave=()=>{};this.lastSave=0;
 }
 async initialise(){
   if(this.ready&&this.yt)return;
   if(this.initialising)return this.initialising;
   if(!this.lesson)return;
   this.state='loading';this.error='';this.onChange();
   const task=this.createPlayer();this.initialising=task;
   try { await task; } finally { if(this.initialising===task)this.initialising=null; }
 }
 async createPlayer(){
   let readyTimeout;const generation=this.generation;
   try{
     if(usesUploadedAudio(this.lesson)){await this.createAudio(generation);return;}
     const YT=await loadYouTubeAPI();if(generation!==this.generation)return;
     // A valid videoId must be supplied at construction. Undefined aborts the real API.
     const videoId=this.lesson.videoId;
     if(!/^[a-zA-Z0-9_-]{11}$/.test(videoId))throw Error('This lesson has an invalid YouTube video ID.');
     const loaded=await new Promise((resolve,reject)=>{
       const candidate=new YT.Player('yt-player',{width:'100%',height:'100%',videoId,
         playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin,start:Math.floor(this.time),autoplay:0},
         events:{
           onReady:e=>queueMicrotask(()=>{if(generation!==this.generation){candidate.destroy();resolve(null);}else resolve(e?.target||candidate);}),
           onError:e=>{if(generation!==this.generation)return;
             const messages={2:'The video ID is invalid.',5:'YouTube cannot play this video in this browser.',100:'This video is unavailable or private.',101:'The video owner has disabled embedding.',150:'The video owner has disabled embedding.',153:'YouTube could not identify this page. Open Echo Studio in your browser and retry.'};
             const message=messages[e.data]||`YouTube playback failed (code ${e.data}).`;
             this.error=message;this.state='error';this.playing=false;this.onError(message);this.onChange();
             if(!this.ready)reject(Error(message));
           },
           onAutoplayBlocked:()=>{if(generation!==this.generation)return;this.playing=false;this.state='blocked';this.error='Tap Play in the video to enable sound, then use the practice controls.';this.onChange();},
           onStateChange:e=>{if(generation===this.generation)this.handleYTState(e.data);},
           onPlaybackRateChange:e=>{if(generation!==this.generation)return;this.speed=e.data;this.onChange();}
         }});
       const iframe=candidate.getIframe?.();
       if(iframe){iframe.setAttribute('title','YouTube lesson video');iframe.setAttribute('referrerpolicy','strict-origin-when-cross-origin');iframe.setAttribute('allow','accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen');}
       readyTimeout=setTimeout(()=>reject(Error('YouTube did not become ready. Check your connection and retry.')),18000);
     });
     clearTimeout(readyTimeout);if(generation!==this.generation)return;this.yt=loaded;this.ready=true;this.state='ready';this.error='';
     if(this.lesson){this.expectSeek(this.time);this.yt.cueVideoById({videoId:this.lesson.videoId,startSeconds:this.time});}
     this.applySpeed();this.onChange();clearInterval(this.timer);this.timer=setInterval(()=>this.tick(),100);
   }catch(e){clearTimeout(readyTimeout);if(generation!==this.generation)return;this.ready=false;this.state='error';this.error=e.message;this.onError(e.message);this.onChange();}
 }
 async createAudio(generation){
   const adapter=new AudioAdapter(this.lesson.audio,this.lesson.audioOffset||0,{
     onStateChange:e=>{if(generation===this.generation)this.handleYTState(e.data);},
     onPlaybackRateChange:e=>{if(generation===this.generation){this.speed=e.data;this.onChange();}},
     onAutoplayBlocked:()=>{if(generation===this.generation){this.playing=false;this.state='blocked';this.error='Press Play to enable audio playback.';this.onChange();}},
     onError:e=>{if(generation===this.generation){this.playing=false;this.state='error';this.error=e.message;this.onChange();}}
   });
   this.yt=adapter;
   await Promise.race([adapter.ready,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Audio is taking too long to load. Check your connection and retry.')),20000);adapter.ready.finally(()=>clearTimeout(t)).catch(()=>{});})]);
   if(generation!==this.generation){adapter.destroy();return;}
   this.ready=true;this.state='ready';this.error='';adapter.seekTo(this.time);this.applySpeed();
   clearInterval(this.timer);this.timer=setInterval(()=>this.tick(),100);this.onChange();
 }
 resetHost(){
   const dock=document.querySelector('#youtube-dock');
   if(dock){dock.replaceChildren();const mount=document.createElement('div');mount.id='yt-player';dock.append(mount);}
 }
 async retry(){
   if(this.initialising)return this.initialising;
   clearInterval(this.timer);this.cancel();this.yt?.destroy?.();this.yt=null;this.ready=false;
   this.resetHost();return this.initialise();
 }
 applySpeed(){
   const rates=this.yt?.getAvailablePlaybackRates?.()||[1];
   if(rates.includes(this.requestedSpeed))this.yt?.setPlaybackRate(this.requestedSpeed);
 }
 handleYTState(s){
   if(s===YT_STATES.PLAYING){const actual=this.yt?.getCurrentTime?.();if(Number.isFinite(actual)&&this.seekSettled(actual)){if(!this.phrase||actual<this.phrase.start-this.leadIn-.1||actual>this.phrase.end+.25){this.time=actual;this.phrase=this.phraseAtOrNext(actual);this.phraseDone=false;}}this.wantsPlayback=true;this.error='';this.state='playing';this.playing=true;this.lastSample=null;this.startSession();}
   else if(s===YT_STATES.BUFFERING){if(this.wantsPlayback)this.state='buffering';this.playing=false;this.lastSample=null;}
   else if(s===YT_STATES.PAUSED){if(this.state!=='speaking-pause'){this.state='paused';this.playing=false;}this.lastSample=null;}
   else if(s===YT_STATES.ENDED){this.playing=false;this.state='ended';this.lastSample=null;if(this.mode!=='continuous')this.boundary();else this.complete();}
   else if(s===YT_STATES.CUED){this.playing=false;if(this.state!=='loading')this.state='ready';this.applySpeed();}
   this.onChange();
 }
 load(lesson,prefs={}){
   this.wantsPlayback=false;this.yt?.pauseVideo?.();this.cancel();this.error='';this.phraseDone=false;
   const identity=usesUploadedAudio(lesson)?'audio:'+lesson.audio.id+':'+(lesson.audioOffset||0):'youtube:'+lesson.videoId;
   const changed=this.lesson?.videoId!==lesson.videoId;
   if(this.mediaIdentity!==identity&&this.mediaIdentity){this.generation++;this.yt?.destroy?.();this.yt=null;this.ready=false;this.initialising=null;clearInterval(this.timer);this.resetHost();}
   this.mediaIdentity=identity;
   this.lesson=lesson;this.mode=prefs.mode||this.mode;this.speed=prefs.speed||this.speed;this.requestedSpeed=this.speed;this.leadIn=prefs.leadIn??this.leadIn;
   this.config={pauseType:prefs.pauseType||'duration',fixedPause:prefs.fixedPause||4,multiplier:prefs.multiplier||1.5,overrides:lesson.pauseOverrides||{}};
   this.selection='all';this.range=null;this.speakers=[];this.loop=false;
   const saved=lesson.phrases.find(p=>p.id===lesson.progress?.phraseId);
   const position=Number(lesson.progress?.position);
   this.time=Number.isFinite(position)&&position>0?position:saved?.start??lesson.phrases[0]?.start??0;
   this.phrase=saved&&this.mode!=='continuous'&&this.time>=saved.start-this.leadIn&&this.time<=saved.end+.05?saved:this.phraseAtOrNext(this.time);this.phraseDone=!!this.phrase&&this.time>=this.phrase.end-.1;this.duration=lesson.duration||0;
   this.playing=false;this.state=this.ready?'ready':'loading';
   if(this.ready&&this.yt){ this.expectSeek(this.time);if(changed)this.yt.cueVideoById({videoId:lesson.videoId,startSeconds:this.time});else this.yt.seekTo(this.time,true);this.applySpeed(); }
   this.onChange();
 }
 cancel(){this.seekTarget=null;this.previewEnd=null;this.token++;if(this.waitTimer){clearTimeout(this.waitTimer);this.waitTimer=null;}this.lastSample=null;}
 current(){return this.phrase;}
 eligible(){return this.lesson?selectedPhrases(this.lesson.phrases,this.lesson.statuses,this.selection,this.speakers,this.range):[];}
 setMode(mode){if(!['manual','automatic','continuous'].includes(mode))return;const wasPlaying=this.playing;this.cancel();this.mode=mode;this.yt?.pauseVideo();this.playing=false;this.state='paused';if(wasPlaying)this.play();this.onChange();this.onSave();}
 setSelection(selection,range=null,speakers=[]){this.cancel();this.selection=selection;this.range=range;this.speakers=speakers;
   if(this.mode==='continuous' && (selection!=='all'||speakers.length)){this.mode='manual';this.onError('Filtered practice uses Manual or Automatic mode. Continuous always plays the full recording.');}
   const list=this.eligible();if(list.length&&!list.some(p=>p.id===this.phrase?.id))this.seekPhrase(list[0].id,false);
   this.onChange();
 }
 setLoop(enabled){this.loop=!!enabled;this.cancel();this.onChange();}
 seekPhrase(id,continuePlayback=this.playing){
   if(!this.lesson)return;const p=this.lesson.phrases.find(p=>p.id===id);if(!p)return;
   this.cancel();this.wantsPlayback=!!continuePlayback;this.phraseDone=false;this.phrase=p;this.time=Math.max(0,p.start-this.leadIn);
   if(this.yt){this.expectSeek(this.time);this.yt.seekTo(this.time,true);if(continuePlayback)this.yt.playVideo();else this.yt.pauseVideo();}
   this.playing=!!continuePlayback;this.state=continuePlayback?'playing':'paused';this.onChange();this.onTick();this.onSave();
 }
 seekRecording(time,continuePlayback=this.playing){
   if(!this.lesson)return;this.cancel();this.time=Math.max(0,Math.min(time,this.duration||Number.MAX_SAFE_INTEGER));
   this.phrase=this.phraseAtOrNext(this.time);this.phraseDone=false;
   if(this.yt){this.expectSeek(this.time);this.yt.seekTo(this.time,true);if(continuePlayback)this.yt.playVideo();else this.yt.pauseVideo();}
   this.playing=!!continuePlayback;this.state=continuePlayback?'playing':'paused';this.onChange();this.onTick();this.onSave();
 }
 resolvePhrase(t){if(!this.lesson)return null;const p=this.lesson.phrases;let l=0,r=p.length-1,closest=null;
   while(l<=r){const m=(l+r)>>1;if(p[m].start<=t){closest=p[m];l=m+1;}else r=m-1;}
   for(let i=r;i>=0;i--)if(t<p[i].end)return p[i];
   return null;
 }
 expectSeek(time){this.seekTarget=time;this.seekRequestedAt=Date.now();}
 seekSettled(time){if(this.seekTarget===null)return true;if(Math.abs(time-this.seekTarget)<=.5||Date.now()-this.seekRequestedAt>=1500){this.seekTarget=null;return true;}return false;}
 phraseAtOrNext(time){return this.resolvePhrase(time)||this.lesson?.phrases.find(p=>p.start>=time)||this.lesson?.phrases.at(-1)||null;}
 play(){
   if(!this.lesson||!this.ready||!this.yt)return;
   if(this.state==='speaking-pause'){this.cancel();this.playing=false;this.state='paused';this.onChange();return;}
   if(this.mode!=='continuous'&&this.phrase&&this.time>=this.phrase.end-.1)this.seekPhrase(this.phrase.id,false);
   this.phraseDone=false;this.wantsPlayback=true;this.error='';this.state='buffering';this.yt.playVideo();this.onChange();const token=this.token;setTimeout(()=>{if(this.token===token&&this.state==='buffering'&&!this.playing&&this.yt?.getPlayerState?.()!==1){this.state='stalled';this.error='Playback is taking longer to start. Check your connection or retry.';this.onChange();}},8000);
 }
 pause(){this.wantsPlayback=false;const failed=this.state==='error';this.cancel();this.yt?.pauseVideo();this.playing=false;this.state=failed?'error':'paused';if(!failed)this.error='';this.onChange();this.onSave();}
 toggle(){if(this.state==='speaking-pause'){this.pause();return;}if(this.playing||this.state==='buffering')this.pause();else this.play();}
 previewRange(start,end){if(!this.yt||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return;this.cancel();this.previewEnd=end;this.yt.seekTo(start,true);this.yt.playVideo();this.playing=true;this.state='playing';this.onChange();}
 replay(){if(!this.phrase)return;this.seekPhrase(this.phrase.id,false);this.play();}
 next(){if(!this.ready||this.state==='error'||!this.phrase)return;this.startSession();this.onPractised(this.phrase.id);const list=this.eligible(),i=list.findIndex(p=>p.id===this.phrase?.id);const next=list[i+1];if(next){this.seekPhrase(next.id,false);this.play();}else this.complete();}
 previous(){const list=this.eligible(),i=list.findIndex(p=>p.id===this.phrase?.id);const prev=list[i-1]||list[0];if(prev){this.seekPhrase(prev.id,false);this.play();}}
 setSpeed(rate){if(!this.yt)return false;const rates=this.yt.getAvailablePlaybackRates?.()||[1];if(!rates.includes(rate)){this.onError('This video does not support that speed.');return false;}this.requestedSpeed=rate;this.yt.setPlaybackRate(rate);this.onChange();this.onSave();return true;}
 setLeadIn(value){this.leadIn=value;this.onChange();}
 boundary(){
   if(!this.phrase||this.mode==='continuous')return;
   this.cancel();this.wantsPlayback=false;this.phraseDone=true;const token=this.token;
   this.yt?.pauseVideo();this.playing=false;this.time=this.phrase.end;
   this.onTick();this.onSave();
   if(this.loop || this.mode==='automatic'){
     this.state='speaking-pause';this.onChange();
     const duration=speakingPause(this.phrase,this.config);
     this.waitTimer=setTimeout(()=>{
       if(this.token!==token)return;
       if(this.loop){this.seekPhrase(this.phrase.id,false);this.play();return;}
       const list=this.eligible(),i=list.findIndex(p=>p.id===this.phrase?.id),next=list[i+1];
       if(next){this.seekPhrase(next.id,false);this.play();}else this.complete();
     },duration*1000);
   }else {this.state='paused';this.onChange();}
 }
 tick(){
   if(!this.ready||!this.yt||!this.lesson)return;
   try{
     const cur=this.yt.getCurrentTime?.();if(!Number.isFinite(cur)||!this.seekSettled(cur))return;
     if(this.yt.getDuration){const dur=this.yt.getDuration();if(dur>0&&dur!==this.duration){this.duration=dur;if(!this.lesson.duration){this.lesson.duration=dur;this.onSave();}}}
     const prev=this.lastSample;
     if(this.playing && Number.isFinite(prev) && cur>prev && cur-prev<1.0){
       this.lesson.progress.coverage=addCoverage(this.lesson.progress.coverage||[],prev,cur);
       this.activeSeconds+=Math.min(.5,(cur-prev)/Math.max(.25,this.speed));
       if(this.session)this.session.activeSeconds+=Math.min(.5,(cur-prev)/Math.max(.25,this.speed));
     }
     this.lastSample=this.playing?cur:null;this.time=cur;
     if(this.previewEnd!==null && this.playing && cur>=this.previewEnd-.05){this.cancel();this.yt.pauseVideo();this.playing=false;this.state='paused';this.onChange();return;}
     if(this.mode==='continuous'){
       const match=this.resolvePhrase(cur);if(match&&match.id!==this.phrase?.id){this.phrase=match;this.onChange();}
     }else if(this.playing&&this.phrase&&cur>=this.phrase.end-.045){this.boundary();return;}
     if(this.playing&&Date.now()-this.lastSave>5000){this.lastSave=Date.now();this.onSave();}
     this.onTick();
   }catch{}
 }
 startSession(){if(!this.session){this.session={id:crypto.randomUUID(),lessonId:this.lesson.id,startedAt:Date.now(),activeSeconds:0,coveredIds:[],selection:this.selection,mode:this.mode};}}
 complete(){this.wantsPlayback=false;this.cancel();this.yt?.pauseVideo();this.playing=false;this.state='ended';this.onChange();this.onSave();}
 finishSession(){if(!this.session)return null;const session={...this.session,finishedAt:Date.now(),coveredIds:this.lesson.phrases.filter(p=>(this.lesson.progress.coverage||[]).some(([a,b])=>a<p.end&&b>p.start)).map(p=>p.id),practised:this.lesson.phrases.filter(p=>this.lesson.statuses[p.id]?.practised).length,difficult:this.lesson.phrases.filter(p=>this.lesson.statuses[p.id]?.difficult).length};this.session=null;return session;}
 destroy(){clearInterval(this.timer);this.cancel();this.yt?.destroy?.();}
}
