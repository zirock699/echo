/** Native audio presented through the same transport interface as the YouTube adapter. */
export class AudioAdapter {
 constructor(file,offset=0,events={},factory=()=>new Audio()){
  this.audio=factory();this.offset=Number(offset)||0;this.events=events;this.state=5;this.pendingTime=null;this.requestedTime=null;this.destroyed=false;this.listeners=[];this.playRequest=0;
  const on=(type,fn)=>{this.audio.addEventListener(type,fn);this.listeners.push([type,fn]);};
  const emit=state=>{if(this.destroyed||state===1&&this.audio.paused===true)return;this.state=state;events.onStateChange?.({data:state});};
  this.ready=new Promise((resolve,reject)=>{
   on('loadedmetadata',()=>{if(this.pendingTime!==null)this.seekTo(this.pendingTime);events.onReady?.({target:this});resolve(this);});
   on('error',()=>{const message='This audio could not be loaded. Check the file format or try uploading it again.';events.onError?.({message});reject(Error(message));});
  });
  on('playing',()=>emit(1));on('waiting',()=>emit(3));on('pause',()=>emit(2));on('ended',()=>emit(0));
  on('seeked',()=>{if(this.destroyed)return;const programmatic=this.requestedTime!==null&&Math.abs(this.audio.currentTime-this.requestedTime)<=.08;this.requestedTime=null;events.onSeeked?.({programmatic});});
  on('ratechange',()=>events.onPlaybackRateChange?.({data:this.audio.playbackRate}));
  this.audio.preload='auto';this.audio.src=file.url;this.audio.load();
 }
 cueVideoById({startSeconds=0}){this.seekTo(startSeconds);this.pauseVideo();}
 seekTo(seconds){this.pendingTime=seconds;if(this.audio.readyState>0){const target=Math.max(0,seconds+this.offset);this.requestedTime=Math.min(target,Number.isFinite(this.audio.duration)?Math.max(0,this.audio.duration-.001):target);this.audio.currentTime=this.requestedTime;this.pendingTime=null;}}
 playVideo(){const request=++this.playRequest;const result=this.audio.play();result?.catch(e=>{if(this.destroyed||request!==this.playRequest||e.name==='AbortError')return;if(e.name==='NotAllowedError')this.events.onAutoplayBlocked?.();else this.events.onError?.({message:'Audio playback failed. Try replaying the phrase.'});});}
 pauseVideo(){this.playRequest++;this.audio.pause();}
 getCurrentTime(){return Math.max(0,(this.pendingTime??(this.audio.currentTime-this.offset)));}
 isSeeking(){return !!this.audio.seeking;}
 getTimeRange(){return {start:Math.max(0,-this.offset),end:this.getDuration()};}
 getDuration(){return Number.isFinite(this.audio.duration)?Math.max(0,this.audio.duration-this.offset):0;}
 getAvailablePlaybackRates(){return [.5,.75,1,1.25,1.5,1.75,2];}
 getPlaybackRate(){return this.audio.playbackRate;}
 setPlaybackRate(rate){this.audio.playbackRate=rate;}
 getPlayerState(){return this.state;}
 destroy(){this.destroyed=true;for(const [type,fn]of this.listeners)this.audio.removeEventListener(type,fn);this.audio.pause();this.audio.removeAttribute('src');this.audio.load();}
}
