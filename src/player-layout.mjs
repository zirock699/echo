export function playbackFeedback(state,audio=false){
 const busy=state==='loading'||state==='buffering';
 const label={loading:'Loading playback',buffering:'Buffering',blocked:audio?'Press Play to enable audio':'Tap Play in the video',stalled:'Playback is taking longer',error:'Playback unavailable'}[state]||'';
 return {busy,label,visible:!!label&&!busy};
}
export function fitTextSize({maximum,minimum,available,measure}){
 const low=Math.min(maximum,minimum);if(measure(maximum)<=available)return maximum;if(measure(low)>available)return low;
 let a=low,b=maximum;while(b-a>.25){const mid=(a+b)/2;if(measure(mid)<=available)a=mid;else b=mid;}return a;
}
