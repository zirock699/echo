const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function lyricTarget(top,height,viewportHeight){return Math.max(0,top+height/2-viewportHeight/2);}
export function lyricDistance(index,current){return Math.min(3,Math.abs(index-current));}

/** Keep the reading surface and its scroll position alive across transport renders. */
export class LyricsScroller{
 constructor(){this.element=null;this.key='';this.currentId=null;this.following=true;this.position=0;this.frame=0;this.initial=true;}
 capture(){if(this.element?.isConnected)this.position=this.element.scrollTop;}
 mount(slot,{lessonId,phrases,currentId,activeHTML}){
  const key=lessonId+'|'+JSON.stringify(phrases.map(p=>[p.id,p.text]));
  const changed=key!==this.key;
  if(!this.element||changed){
   this.element=slot;this.key=key;this.currentId=null;this.following=true;this.position=0;this.initial=true;
   slot.innerHTML=`<div class="lyrics-track" role="list" aria-label="Lesson transcript">${phrases.map(p=>`<div class="lyric-row" role="listitem" data-lyric-id="${esc(p.id)}"><button class="lyric-select" data-action="lyric-select" data-id="${esc(p.id)}" aria-label="Play phrase: ${esc(p.text)}">${esc(p.text)}</button><div class="phrase-text lyric-current" hidden></div></div>`).join('')}</div>`;
   const browse=()=>{this.following=false;this.updateFollow();};
   slot.addEventListener('wheel',browse,{passive:true});slot.addEventListener('touchstart',browse,{passive:true});
   slot.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))browse();});
   slot.addEventListener('scroll',()=>{this.position=slot.scrollTop;this.updateFollow();},{passive:true});
  }else if(slot!==this.element){slot.replaceWith(this.element);this.element.scrollTo({top:this.position,behavior:'instant'});}
  const rows=[...this.element.querySelectorAll('.lyric-row')],index=phrases.findIndex(p=>p.id===currentId);
  for(const [i,row] of rows.entries()){
   const active=i===index,button=row.querySelector('.lyric-select'),text=row.querySelector('.lyric-current');
   row.dataset.distance=lyricDistance(i,index);row.classList.toggle('is-current',active);button.hidden=active;text.hidden=!active;
   if(active){text.id='active-phrase';text.dataset.phrase=currentId;if(this.currentId!==currentId||changed)text.innerHTML=activeHTML;row.setAttribute('aria-current','true');}
   else{text.removeAttribute('id');text.innerHTML='';row.removeAttribute('aria-current');}
  }
  this.currentId=currentId;this.layout();
 }
 layout(){
  if(!this.element?.isConnected)return;
  this.element.style.setProperty('--lyric-space',this.element.clientHeight/2+'px');
  cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>{if(this.following)this.center();else this.updateFollow();});
 }
 target(){const row=this.element?.querySelector('.is-current');return row?lyricTarget(row.offsetTop,row.offsetHeight,this.element.clientHeight):0;}
 center(){if(!this.element?.isConnected)return;this.element.scrollTo({top:this.target(),behavior:this.initial||matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});this.initial=false;this.updateFollow();}
 follow(){this.following=true;this.center();}
 updateFollow(){this.element?.classList?.toggle('is-browsing',!this.following);const button=this.element?.parentElement?.querySelector('.lyrics-follow')||this.element?.querySelector('.lyrics-follow');if(button)button.hidden=this.following||Math.abs(this.element.scrollTop-this.target())<80;}
}
