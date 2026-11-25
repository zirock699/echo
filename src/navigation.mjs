/** Browser-backed screen history. Playback state is deliberately not serialised or recreated. */
export class ScreenHistory {
 constructor({history=globalThis.history,restore}){this.history=history;this.restore=restore;this.ready=false;this.applying=false;this.pending=false;}
 key(s){return [s.view,s.view==='player'?s.lessonId:'',s.view==='collections'?s.collections?.id:'',s.view==='library'?s.library?.state?.course:'',s.view==='library'&&s.library?.searchOpen?'search':'',s.overlay?(s.nestedOverlay?'nested-sheet':'sheet'):''].join('|');}
 base(s){return this.key({...s,overlay:false});}
 url(s){const id=s.view==='collections'?s.collections?.id:s.view==='library'?s.library?.state?.course:'';return '#'+s.view+(id?'/'+encodeURIComponent(id):'');}
 start(snapshot,resume=true){
  const previous=this.history.state?.echoNavigation;
  const saved=resume&&snapshot.owner!==null&&previous?.snapshot?.owner===snapshot.owner&&!previous?.snapshot?.transient?previous:null;
  this.session=saved?.session||Date.now()+'-'+Math.random().toString(36).slice(2);
  this.current=saved||{session:this.session,index:0,snapshot,prevKey:null};
  this.pending=false;this.ready=true;
  if(saved)this.apply(saved.snapshot);else this.write(false);
 }
 write(push){const state={...(this.history.state||{}),echoNavigation:this.current};this.history[push?'pushState':'replaceState'](state,'',this.url(this.current.snapshot));}
 rememberScroll(y){if(!this.ready||this.pending||this.applying)return;this.current.snapshot.scroll=y;this.write(false);}
 commit(snapshot){if(!this.ready||this.applying||this.pending)return;const current=this.current,key=this.key(snapshot),oldKey=this.key(current.snapshot);if(key===oldKey){this.current={...current,snapshot:{...snapshot,scroll:current.snapshot.scroll||0}};this.write(false);return;}
  if(key===current.prevKey){this.back();return;}
  // Ordinary sheet transitions share an entry. A nested step backs out to its opener sheet.
  const nested=snapshot.overlay&&snapshot.nestedOverlay&&current.snapshot.overlay&&!current.snapshot.nestedOverlay&&this.base(snapshot)===this.base(current.snapshot);
  const replace=current.snapshot.overlay&&!nested;
  this.current={session:this.session,index:current.index+(replace?0:1),prevKey:replace?current.prevKey:oldKey,snapshot:{...snapshot,scroll:0}};this.write(!replace);
 }
 apply(snapshot){this.applying=true;try{this.restore(snapshot);}finally{this.applying=false;}}
 pop(state){const entry=state?.echoNavigation;if(!entry||entry.session!==this.session)return;this.pending=false;this.current=entry;this.apply(entry.snapshot);}
 back(fallback){if(this.ready&&this.current.index>0){if(!this.pending){this.pending=true;this.history.back();}}else if(fallback){this.current={session:this.session,index:0,prevKey:null,snapshot:fallback};this.apply(fallback);this.write(false);}}
}
