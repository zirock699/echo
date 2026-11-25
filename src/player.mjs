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
   this.wantsPlayback=false;this.phraseDone=false;this.mediaIdentity='';this.generation=0;this.yt=null;this.ready=false;this.initialising=null;this.error='';this.lesson=null;this.phrase=null;this.mode='continuous';this.loop=false;this.playing=false;this.state='idle';
   this.speed=1;this.requestedSpeed=1;this.leadIn=0;this.config={pauseType:'duration',fixedPause:4,multiplier:1.5};
   this.selection='all';this.range=null;this.speakers=[];this.time=0;this.duration=0;this.timer=null;this.waitTimer=null;this.token=0;this.lastSample=null;
   this.pendingSeek=null;this.failedSeek=null;this.lastClock=null;this.promptPause=null;
   this.onPractised=()=>{};this.previewEnd=null;this.session=null;this.onChange=()=>{};this.onTick=()=>{};this.onError=()=>{};this.onSave=()=>{};this.lastSave=0;
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
           onAutoplayBlocked:()=>{if(generation!==this.generation||this.promptPause&&!this.wantsPlayback)return;this.playing=false;this.state='blocked';this.error='Tap Play in the video to enable sound, then use the practice controls.';this.onChange();},
           onStateChange:e=>{if(generation===this.generation)this.handleYTState(e.data);},
           onPlaybackRateChange:e=>{if(generation!==this.generation)return;this.speed=e.data;this.onChange();}
         }});
       const iframe=candidate.getIframe?.();
       if(iframe){iframe.setAttribute('title','YouTube lesson video');iframe.setAttribute('referrerpolicy','strict-origin-when-cross-origin');iframe.setAttribute('allow','accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen');}
       readyTimeout=setTimeout(()=>reject(Error('YouTube did not become ready. Check your connection and retry.')),18000);
     });
     clearTimeout(readyTimeout);if(generation!==this.generation)return;this.yt=loaded;this.ready=true;this.state='ready';this.error='';
     if(this.lesson)this.yt.cueVideoById({videoId:this.lesson.videoId,startSeconds:this.time});
     this.beginSeek(this.time);this.applySpeed();this.armClock();this.onChange();
   }catch(e){clearTimeout(readyTimeout);if(generation!==this.generation)return;this.ready=false;this.state='error';this.error=e.message;this.onError(e.message);this.onChange();}
 }
 async createAudio(generation){
   const adapter=new AudioAdapter(this.lesson.audio,this.lesson.audioOffset||0,{
     onStateChange:e=>{if(generation===this.generation)this.handleYTState(e.data);},
     onTimeUpdate:()=>{if(generation===this.generation)this.tick();},
     onSeeked:event=>{if(generation===this.generation){if(!this.pendingSeek&&!event.application)this.reconcileClock(adapter.getCurrentTime());this.tick();}},
     onPlaybackRateChange:e=>{if(generation===this.generation){this.speed=e.data;this.onChange();}},
     onAutoplayBlocked:()=>{if(generation===this.generation){this.playing=false;this.state='blocked';this.error='Press Play to enable audio playback.';this.onChange();}},
     onError:e=>{if(generation===this.generation){this.playing=false;this.state='error';this.error=e.message;this.onChange();}}
   });
   this.yt=adapter;
   await Promise.race([adapter.ready,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Audio is taking too long to load. Check your connection and retry.')),20000);adapter.ready.finally(()=>clearTimeout(t)).catch(()=>{});})]);
   if(generation!==this.generation){adapter.destroy();return;}
   this.ready=true;this.state='ready';this.error='';this.beginSeek(this.time);this.applySpeed();
   // A paused no-op seek may not emit a time or seek event. Read duration once.
   this.tick();this.onChange();
 }
 needsClock(){
   return !this.promptPause?.open&&this.ready&&this.yt&&this.lesson&&(!(this.yt instanceof AudioAdapter)||this.playing||this.pendingSeek!==null);
 }
 armClock(){
   if(this.timer!==null||!this.needsClock())return;
   this.timer=setInterval(()=>{
     if(this.needsClock())this.tick();
     else this.stopClock();
   },20);
 }
 wakeNativeClock(){if(this.yt instanceof AudioAdapter)this.armClock();}
 stopClock(){clearInterval(this.timer);this.timer=null;}
 resetHost(){
   const dock=document.querySelector('#youtube-dock');
   if(dock){dock.replaceChildren();const mount=document.createElement('div');mount.id='yt-player';dock.append(mount);}
 }
 async retry(){
   if(this.initialising)return this.initialising;
   this.generation++;this.resetPromptSource();this.stopClock();this.cancel();this.yt?.destroy?.();this.yt=null;this.ready=false;
   this.resetHost();return this.initialise();
 }
 applySpeed(){
   const rates=this.yt?.getAvailablePlaybackRates?.()||[1];
   if(rates.includes(this.requestedSpeed))this.yt?.setPlaybackRate(this.requestedSpeed);
 }
 handleYTState(s){
   const prompt=this.promptPause;
   if(prompt){
     const currentState=this.yt?.getPlayerState?.()??s;
     if(s===YT_STATES.PAUSED||s===YT_STATES.CUED||s===YT_STATES.UNSTARTED){
       if(currentState!==YT_STATES.PLAYING&&currentState!==YT_STATES.BUFFERING)prompt.confirmed=true;
       return;
     }
     if(s===YT_STATES.ENDED){prompt.freezeClock=true;return;}
     if(s!==YT_STATES.PLAYING&&s!==YT_STATES.BUFFERING)return;
     if(!this.canPlayAfterPrompt(prompt)){
       if(currentState===s){
         prompt.confirmed=false;
         if(s===YT_STATES.PLAYING){prompt.requirePlay=true;prompt.freezeClock=true;}
       }
       if(s===YT_STATES.PLAYING||currentState===s)this.yt?.pauseVideo();
       return;
     }
     if(s!==YT_STATES.PLAYING||currentState!==s)return;
     this.promptPause=null;this.wantsPlayback=true;
     if(this.pendingSeek)this.pendingSeek.started=Date.now();
   }
   // Completion from the old location must never finish the newly requested phrase.
   if((this.pendingSeek||this.failedSeek!==null)&&s===YT_STATES.ENDED)return;
   if(this.failedSeek!==null&&s===YT_STATES.PLAYING){this.yt?.pauseVideo();return;}
   if(this.pendingSeek&&s===YT_STATES.PLAYING&&!this.wantsPlayback){this.yt?.pauseVideo();return;}
   if(this.pendingSeek&&s===YT_STATES.PAUSED&&this.wantsPlayback)return;
   if(!this.pendingSeek&&s===YT_STATES.PLAYING&&this.previewEnd===null){const cur=this.yt?.getCurrentTime?.();if(Number.isFinite(cur)&&Math.abs(cur-this.time)>.1&&(this.mode==='continuous'||!this.inPhraseContext(cur)))this.reconcileClock(cur);}
   if(s===YT_STATES.PLAYING){this.wantsPlayback=true;this.error='';this.state='playing';this.playing=true;this.lastSample=null;if(this.previewEnd===null)this.startSession();}
   else if(s===YT_STATES.BUFFERING){if(this.wantsPlayback)this.state='buffering';this.playing=false;this.lastSample=null;}
   else if(s===YT_STATES.PAUSED){if(this.state!=='speaking-pause'){this.state='paused';this.playing=false;}this.lastSample=null;}
   else if(s===YT_STATES.ENDED){this.playing=false;this.state='ended';this.lastSample=null;if(this.mode!=='continuous')this.boundary();else this.complete();}
   else if(s===YT_STATES.CUED){this.playing=false;if(this.state!=='loading')this.state='ready';this.applySpeed();}
   this.wakeNativeClock();
   this.onChange();
 }
 load(lesson,prefs={}){
   this.pendingSeek=null;this.failedSeek=null;this.lastClock=null;
   this.wantsPlayback=false;this.yt?.pauseVideo?.();this.cancel();this.error='';this.phraseDone=false;
   const identity=usesUploadedAudio(lesson)?'audio:'+lesson.audio.id+':'+(lesson.audioOffset||0):'youtube:'+lesson.videoId;
   const changed=this.lesson?.videoId!==lesson.videoId;
   if(this.mediaIdentity!==identity)this.resetPromptSource();
   if(this.mediaIdentity!==identity&&this.mediaIdentity){this.generation++;this.yt?.destroy?.();this.yt=null;this.ready=false;this.initialising=null;this.stopClock();this.resetHost();}
   this.mediaIdentity=identity;
   if(this.session?.lessonId!==lesson.id)this.session=null;
   this.lesson=lesson;this.mode=prefs.mode||this.mode;this.speed=prefs.speed||this.speed;this.requestedSpeed=this.speed;this.leadIn=prefs.leadIn??this.leadIn;
   this.config={pauseType:prefs.pauseType||'duration',fixedPause:prefs.fixedPause||4,multiplier:prefs.multiplier||1.5,overrides:lesson.pauseOverrides||{}};
   this.selection='all';this.range=null;this.speakers=[];this.loop=false;
   const saved=lesson.phrases.find(p=>p.id===lesson.progress?.phraseId);
   const first=lesson.phrases[0];
   this.time=Number.isFinite(lesson.progress?.position)?lesson.progress.position:(saved?.start??first?.start??0);
   this.phrase=this.mode==='continuous'?(this.resolvePhrase(this.time)||saved||first):(saved&&this.time>=saved.start-this.leadIn&&this.time<=saved.end+.05?saved:this.phraseAtOrNext(this.time));
   // Skip the introduction for shadowing, but preserve a saved position between cues.
   if(this.mode!=='continuous'&&first&&this.time<first.start-this.leadIn)this.time=Math.max(0,first.start-this.leadIn);
   this.phraseDone=this.mode!=='continuous'&&!!this.phrase&&this.time>=this.phrase.end;this.duration=lesson.duration||0;this.lastClock=this.time;
   this.playing=false;this.state=this.ready?'ready':'loading';
   if(this.ready&&this.yt){ if(changed)this.yt.cueVideoById({videoId:lesson.videoId,startSeconds:this.time});this.beginSeek(this.time);this.applySpeed(); }
   this.onChange();
 }
 cancel(){this.previewEnd=null;this.token++;if(this.waitTimer){clearTimeout(this.waitTimer);this.waitTimer=null;}this.lastSample=null;}
 current(){return this.phrase;}
 beginSeek(target){
   if(this.promptPause&&!this.promptPause.open)this.promptPause.freezeClock=false;
   target=this.sourceTarget(target)??target;this.time=target;
   const origin=this.yt?.getCurrentTime?.();
   this.pendingSeek={target,origin,started:Date.now()};this.failedSeek=null;this.lastSample=null;
   this.yt?.seekTo(target,true);
   if(!this.yt?.isSeeking?.()&&Math.abs((this.yt?.getCurrentTime?.()??NaN)-target)<.005){this.pendingSeek=null;this.lastClock=target;}
   this.wakeNativeClock();
 }
 // A requested shadowing phrase remains selected while its lead-in plays.
 inPhraseContext(cur){return !!this.phrase&&cur>=Math.max(0,this.phrase.start-this.leadIn)-.04&&cur<this.phrase.end;}
 reconcileClock(cur){
   const playing=this.yt?.getPlayerState?.()===YT_STATES.PLAYING;
   if(!Number.isFinite(cur)||this.promptPause&&(this.promptPause.open||this.promptPause.freezeClock||playing))return;
   const match=this.mode==='continuous'?this.resolvePhrase(cur):this.phraseAtOrNext(cur);
   this.cancel();this.phraseDone=false;this.time=cur;this.lastClock=cur;if(match)this.phrase=match;
   this.playing=playing;this.wantsPlayback=playing;this.state=playing?'playing':'paused';this.wakeNativeClock();this.onChange();
 }
 acceptClock(cur){
   const seek=this.pendingSeek;if(!seek)return true;
   const moved=!Number.isFinite(seek.origin)||Math.abs(seek.origin-seek.target)<.01||Math.abs(cur-seek.origin)>Math.min(.02,Math.abs(seek.origin-seek.target)/2);
   // Allow decoder/keyframe preroll to PLAY towards the target, without treating it
   // as the requested phrase or stopping against an unrelated old cue.
   if(Number.isFinite(cur)&&!this.yt?.isSeeking?.()&&moved&&cur>=seek.target-.04&&cur<=seek.target+Math.max(.35,this.speed*.15)){
     this.pendingSeek=null;this.lastClock=cur;this.lastSample=null;return true;
   }
   if(Date.now()-seek.started>=8000){
     this.pendingSeek=null;this.failedSeek=seek.target;this.wantsPlayback=false;this.playing=false;this.state='error';
     this.error='The recording did not reach this phrase. Press Play to retry, or check the audio offset in lesson settings.';
     this.yt?.pauseVideo();this.state='error';this.onChange();
   }
   return false;
 }
 sourceTarget(time,phrase=null){
   const bounds=this.yt?.getTimeBounds?.();if(!bounds)return time;
   if(phrase&&(phrase.start<bounds.start-.05||phrase.end>bounds.end+.05)){
     this.pendingSeek=null;this.failedSeek=null;
     this.pause();this.state='error';this.error='This phrase is outside the uploaded audio. Check the audio offset or use the matching recording.';this.onChange();return null;
   }
   return Math.max(bounds.start,Math.min(time,bounds.end));
 }
 eligible(){
   if(!this.lesson)return [];
   const {phrases,statuses}=this.lesson;
   return this.mode==='continuous'?phrases:selectedPhrases(phrases,statuses,this.selection,this.speakers,this.range);
 }
 setMode(mode){
   if(!['manual','automatic','continuous'].includes(mode))return;
   const wasPlaying=this.playing;
   this.cancel();this.mode=mode;this.yt?.pauseVideo();this.playing=false;this.state='paused';
   if(mode==='continuous')this.phraseDone=false;
   else{
     const list=this.eligible();
     if(list.length&&!list.some(p=>p.id===this.phrase?.id))this.seekPhrase(list[0].id,false);
   }
   if(wasPlaying)this.play();
   this.onChange();this.onSave();
 }
 setSelection(selection,range=null,speakers=[]){
   const filtered=selection!=='all'||speakers.length>0;
   const list=selectedPhrases(this.lesson?.phrases||[],this.lesson?.statuses,selection,speakers,range);
   if(filtered&&!list.length)return false;
   this.cancel();this.selection=selection;this.range=range;this.speakers=speakers;
   if(this.mode==='continuous'&&filtered){this.mode='manual';this.onError('Filtered practice uses Manual or Automatic mode. Continuous always plays the full recording.');}
   if(list.length&&!list.some(p=>p.id===this.phrase?.id))this.seekPhrase(list[0].id,false);
   this.onChange();
   return true;
 }
 setLoop(enabled){this.loop=!!enabled;this.cancel();this.onChange();}
 seekPhrase(id,continuePlayback=this.playing,saveReason){
   if(!this.lesson||this.promptPause?.open)return;const p=this.lesson.phrases.find(p=>p.id===id);if(!p)return;
   this.cancel();this.wantsPlayback=!!continuePlayback;this.phraseDone=false;this.phrase=p;this.time=Math.max(0,p.start-(this.mode==='continuous'?0:this.leadIn));
   const target=this.sourceTarget(this.time,p);if(target===null)return;this.time=target;
   if(this.yt){this.beginSeek(this.time);if(continuePlayback)this.yt.playVideo();else this.yt.pauseVideo();}
   this.playing=!!continuePlayback;this.state=continuePlayback?'playing':'paused';this.wakeNativeClock();this.onChange();this.onTick();this.onSave(saveReason);
 }
 seekRecording(time,continuePlayback=this.playing){
   if(!this.lesson||this.promptPause?.open||!Number.isFinite(time))return;
   this.cancel();this.wantsPlayback=!!continuePlayback;this.phraseDone=false;
   const target=Math.max(0,Math.min(time,this.duration||Number.MAX_SAFE_INTEGER));
   this.time=this.sourceTarget(target)??target;
   const phrases=this.lesson.phrases;
   // Keep the visible cue in ordinary gaps, but use only the current array after an edit or Undo.
   this.phrase=this.mode==='continuous'?(this.resolvePhrase(this.time)??phrases.find(p=>p.id===this.phrase?.id)??
     phrases.findLast(p=>p.start<=this.time)??phrases[0]??null):this.phraseAtOrNext(this.time);
   if(this.yt){this.beginSeek(this.time);if(continuePlayback)this.yt.playVideo();else this.yt.pauseVideo();}
   this.playing=!!continuePlayback;this.state=continuePlayback?'playing':'paused';this.wakeNativeClock();this.onChange();this.onTick();this.onSave();
 }
 resolvePhrase(t){return this.lesson?.phrases.find(p=>p.start<=t&&t<p.end)||null;}
 phraseAtOrNext(time){return this.resolvePhrase(time)||this.lesson?.phrases.find(p=>p.start>=time)||this.lesson?.phrases.at(-1)||null;}
 play(){
   if(!this.lesson||!this.ready||!this.yt||this.promptPause?.open)return;
   if(this.state==='speaking-pause'){this.cancel();this.playing=false;this.state='paused';this.onChange();return;}
   if(this.failedSeek!==null){this.beginSeek(this.failedSeek);}
   if(this.mode!=='continuous'&&this.phrase&&(this.phraseDone||this.time>=this.phrase.end))this.seekPhrase(this.phrase.id,false);
   if(this.sourceTarget(this.time,this.phrase)===null)return;
   if(this.promptPause?.freezeClock&&(this.pendingSeek||Math.abs(this.yt.getCurrentTime()-this.time)>.04))this.beginSeek(this.time);
   this.phraseDone=false;this.wantsPlayback=true;this.error='';this.state='buffering';this.yt.playVideo();this.onChange();const token=this.token;setTimeout(()=>{if(this.token===token&&this.state==='buffering'&&!this.playing&&this.yt?.getPlayerState?.()!==1){this.state='stalled';this.error='Playback is taking longer to start. Check your connection or retry.';this.onChange();}},8000);
 }
 pause({save=true}={}){this.wantsPlayback=false;const failed=this.state==='error';this.cancel();this.yt?.pauseVideo();this.playing=false;this.state=failed?'error':'paused';if(!failed)this.error='';this.onChange();if(save)this.onSave();}
 pauseForPrompt({save=false}={}){
   if(this.promptPause?.open)return;
   const state=this.yt?.getPlayerState?.();
   const outstanding=this.playing||this.wantsPlayback||state===YT_STATES.PLAYING||state===YT_STATES.BUFFERING;
   const interrupted=outstanding||this.state==='speaking-pause';
   const previous=this.promptPause;
   this.promptPause={open:true,confirmed:!outstanding&&(previous?.confirmed??true),
     requirePlay:interrupted||!!previous?.requirePlay,freezeClock:interrupted||!!previous?.freezeClock};
   this.stopClock();
   if(this.lesson&&interrupted)this.pause({save});
 }
 releasePrompt(){
   const prompt=this.promptPause;
   if(!prompt?.open)return;
   if(!this.lesson){this.promptPause=null;return;}
   prompt.open=false;
   if(this.pendingSeek)this.pendingSeek.started=Date.now();
   // An idle native source may have become ready while the clock was held.
   queueMicrotask(()=>{
     if(this.promptPause!==prompt||prompt.open)return;
     this.tick();this.armClock();
   });
 }
 resetPromptSource(){
   if(this.promptPause)this.promptPause=this.promptPause.open?{open:true,confirmed:true,requirePlay:false,freezeClock:false}:null;
 }
 canPlayAfterPrompt(prompt){
   // The adapter cannot distinguish a cancelled start from an iframe gesture.
   return !prompt.open&&(this.wantsPlayback||(!prompt.requirePlay&&prompt.confirmed));
 }
 toggle(){if(this.state==='speaking-pause'){this.pause();return;}if(this.playing||this.state==='buffering')this.pause();else this.play();}
 previewRange(start,end){if(!this.yt||this.promptPause?.open||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return;this.cancel();this.wantsPlayback=true;this.previewEnd=end;this.time=start;this.beginSeek(start);this.yt.playVideo();this.playing=true;this.state='playing';this.wakeNativeClock();this.onChange();}
 replay(){if(!this.phrase)return;this.seekPhrase(this.phrase.id,false);this.play();}
 next(){if(!this.ready||this.state==='error'||!this.phrase||this.promptPause?.open)return;const id=this.phrase.id;this.recordMark(id,'practised');this.onPractised(id);const list=this.eligible(),i=list.findIndex(p=>p.id===id);const next=list[i+1];if(next){this.seekPhrase(next.id,false);this.play();}else this.complete();}
 previous(){const list=this.eligible(),i=list.findIndex(p=>p.id===this.phrase?.id);const prev=list[i-1]||list[0];if(prev){this.seekPhrase(prev.id,false);this.play();}}
 setSpeed(rate){if(!this.yt)return false;const rates=this.yt.getAvailablePlaybackRates?.()||[1];if(!rates.includes(rate)){this.onError('This video does not support that speed.');return false;}this.requestedSpeed=rate;this.yt.setPlaybackRate(rate);this.onChange();this.onSave();return true;}
 setLeadIn(value){this.leadIn=value;this.onChange();}
 boundary(){
   if(!this.phrase||this.mode==='continuous')return;
   this.cancel();this.wantsPlayback=false;this.phraseDone=true;const token=this.token;
   this.yt?.pauseVideo();this.playing=false;this.time=this.phrase.end;
   this.onTick();this.onSave('checkpoint');
   if(this.loop || this.mode==='automatic'){
     this.state='speaking-pause';this.onChange();
     const duration=speakingPause(this.phrase,this.config);
     this.waitTimer=setTimeout(()=>{
       if(this.token!==token)return;
       if(this.loop){this.seekPhrase(this.phrase.id,false,'checkpoint');this.play();return;}
       const list=this.eligible(),i=list.findIndex(p=>p.id===this.phrase?.id),next=list[i+1];
       if(next){this.seekPhrase(next.id,false,'checkpoint');this.play();}else this.complete();
     },duration*1000);
   }else {this.state='paused';this.onChange();}
 }
 tick(){
   if(!this.ready||!this.yt||!this.lesson)return;
   try{
     const prompt=this.promptPause;
     if(prompt?.open)return;
     if(prompt&&this.yt.getPlayerState?.()===YT_STATES.PLAYING){
       if(!this.canPlayAfterPrompt(prompt))return;
       // The iframe's readable state can update after its notification.
       this.handleYTState(YT_STATES.PLAYING);
     }
     const cur=this.yt.getCurrentTime?.();
     if(!this.acceptClock(cur)||this.failedSeek!==null||!Number.isFinite(cur))return;
     if(this.promptPause?.freezeClock){
       if(!this.promptPause.confirmed||cur!==this.time)return;
       this.promptPause.freezeClock=false;
     }
     if(this.yt.getDuration){const dur=this.yt.getDuration();if(dur>0&&dur!==this.duration){this.duration=dur;if(!this.lesson.duration){this.lesson.duration=dur;this.onSave('checkpoint');}}}
     const jump=Number.isFinite(this.lastClock)&&Math.abs(cur-this.lastClock)>Math.max(.35,this.speed*.3);
     const external=this.yt?.isSeeking?.();if(external){this.lastSample=null;return;}
     if(this.previewEnd===null&&this.mode!=='continuous'&&!this.playing&&!this.phraseDone&&cur!==this.lastClock&&!this.inPhraseContext(cur)){
       const match=this.phraseAtOrNext(cur);if(match&&match.id!==this.phrase?.id){this.phrase=match;this.phraseDone=false;this.cancel();this.onChange();}
     }
     this.lastClock=cur;const prev=jump?null:this.lastSample;
     if(this.playing && Number.isFinite(prev) && cur>prev && cur-prev<1.0){
       this.lesson.progress.coverage=addCoverage(this.lesson.progress.coverage||[],prev,cur);
       if(this.session&&this.previewEnd===null){
         this.session.activeSeconds+=Math.min(.5,(cur-prev)/Math.max(.25,this.speed));
         // Only join intervals that were actually sampled, never a skipped gap.
         const last=this.session.coverage.at(-1);
         if(last&&prev>=last[0]&&prev<=last[1])last[1]=Math.max(last[1],cur);
         else this.session.coverage.push([prev,cur]);
       }
     }
     this.lastSample=this.playing?cur:null;this.time=cur;
     if(this.previewEnd!==null){const match=this.phraseAtOrNext(cur);if(match&&match.id!==this.phrase?.id){this.phrase=match;this.onChange();}if(this.playing&&cur>=this.previewEnd-.05){this.cancel();this.yt.pauseVideo();this.playing=false;this.state='paused';this.onChange();}this.onTick();return;}
     if(this.mode==='continuous'){
       const match=this.resolvePhrase(cur);if(match&&match.id!==this.phrase?.id){this.phrase=match;this.onChange();}
     }else if(this.playing&&this.phrase&&cur>=this.phrase.end){this.boundary();return;}
     if(this.playing&&Date.now()-this.lastSave>5000){this.lastSave=Date.now();this.onSave('checkpoint');}
     this.onTick();
   }catch{}
 }
 startSession(){
   if(!this.lesson||this.session)return;
   this.session={id:crypto.randomUUID(),lessonId:this.lesson.id,startedAt:Date.now(),activeSeconds:0,
     selection:this.mode==='continuous'?'all':this.selection,mode:this.mode,coverage:[],
     marks:{practised:new Set(),difficult:new Set()}};
 }
 recordMark(id,status,enabled=true){
   if(status!=='practised'&&status!=='difficult')return;
   if(!this.lesson?.phrases.some(phrase=>phrase.id===id))return;
   if(enabled){this.startSession();this.session.marks[status].add(id);}
   else this.session?.marks[status].delete(id);
 }
 complete(){this.wantsPlayback=false;this.cancel();this.yt?.pauseVideo();this.playing=false;this.state='ended';this.onChange();this.onSave();}
 finishSession(){
   if(!this.session)return null;
   const {coverage,marks,...session}=this.session;
   this.session=null;
   return {...session,metricsVersion:1,finishedAt:Date.now(),
     coveredIds:this.lesson.phrases.filter(p=>coverage.some(([a,b])=>a<p.end&&b>p.start)).map(p=>p.id),
     practised:marks.practised.size,difficult:marks.difficult.size};
 }
 destroy(){this.generation++;this.pendingSeek=null;this.promptPause=null;this.stopClock();this.cancel();this.yt?.destroy?.();}
}
