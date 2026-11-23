/** Shared decisions for the compact practice transport and dedicated mobile gesture area. */
export function transportState(player){
 if(player.playing||['speaking-pause','buffering'].includes(player.state))return {label:'Pause',icon:'pause',action:'toggle'};
 if(player.phraseDone)return {label:'Replay',icon:'replay',action:'replay'};
 return {label:'Play',icon:'play',action:'toggle'};
}
export function swipeDirection(start,end,width){
 if(width>760||!start||!end)return null;
 const dx=end.x-start.x,dy=end.y-start.y;
 if(Math.abs(dx)<64||Math.abs(dx)<Math.abs(dy)*1.5)return null;
 return dx<0?'next':'previous';
}
/** Dismiss a mini player only for a deliberate horizontal swipe. */
export function dismissCompactSwipe(start,end){if(!start||!end)return false;const dx=end.x-start.x,dy=end.y-start.y;return Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.8;}
