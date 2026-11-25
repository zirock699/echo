// Native scrolling retains touch, trackpad and keyboard browsing.
export function shelfEdges({scrollLeft,clientWidth,scrollWidth}){
 const end=Math.max(0,scrollWidth-clientWidth),position=Math.max(0,Math.min(end,scrollLeft));
 return {overflow:end>1,atStart:position<=1,atEnd:end-position<=1};
}

export function updateShelfControls(track){
 const controls=track.closest('.home-shelf')?.querySelector('[data-shelf-scroll-controls]');
 if(!controls)return;
 const state=shelfEdges(track);
 controls.hidden=!state.overflow;
 controls.querySelector('[data-direction="left"]').disabled=state.atStart;
 controls.querySelector('[data-direction="right"]').disabled=state.atEnd;
}

export function scrollShelf(track,direction,reduced=false){
 const step=Math.max(1,track.clientWidth*.8);
 track.scrollBy({left:direction==='right'?step:-step,behavior:reduced?'instant':'smooth'});
}
