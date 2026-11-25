// Text selection is supported by search inputs too. Restoring focus alone resets the caret.
export function textSelection(element){
 if(!element||!(element.tagName==='TEXTAREA'||element.tagName==='INPUT'&&['text','search','url','tel','password'].includes(element.type)))return null;
 return [element.selectionStart,element.selectionEnd,element.selectionDirection||'none'];
}

const modalSelector='[role="dialog"][aria-modal="true"]';
const controls='button,input,select,textarea,a[href],summary,[tabindex],[contenteditable]';
const fieldKeys=['data-focus-key','data-lfield','data-lfilter','data-pref','data-cx-pick','data-collection-toggle'];
const actionKeys=['data-action','data-lx','data-cx','data-sx'];
const actionDetails=['data-id','data-tab','data-kind','data-key','data-view','data-status','data-value','data-page','data-shelf','data-direction'];
const openSelect='select:open';
const detectsOpenSelect=globalThis.CSS?.supports?.(`selector(${openSelect})`);
const attrSelector=(el,name)=>`[${name}="${CSS.escape(el.getAttribute(name))}"]`;
const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility==='visible';

function focusable(el){
 const closed=el.closest('details:not([open])');
 return visible(el)&&!el.matches(':disabled')&&!el.closest('[inert]')&&
   (!closed||closed.querySelector(':scope > summary')?.contains(el));
}

function bookmark(el){
 if(!el)return null;
 const field=fieldKeys.find(name=>el.hasAttribute(name)),action=actionKeys.find(name=>el.hasAttribute(name));
 let selector;
 if(el.id)selector=`#${CSS.escape(el.id)}`;
 else if(field)selector=attrSelector(el,field);
 else if(action&&el.matches(controls)){
  const details=actionDetails.filter(name=>el.hasAttribute(name)).map(name=>attrSelector(el,name));
  selector=el.localName+attrSelector(el,action)+details.join('');
 }
 else return null;
 const row=el.closest('[data-row-id]'),lyric=el.dataset.action==='word'&&el.closest('[data-lyric-id]');
 const fallback=row?`${attrSelector(row,'data-row-id')} [data-action="queue-menu"]`:lyric?`${attrSelector(lyric,'data-lyric-id')} .lyric-select`:null;
 return {selector,fallback,selection:textSelection(el)};
}

function restoreBookmark(scope,mark){
 if(!mark)return false;
 const target=[...scope.querySelectorAll(mark.selector)].find(focusable);
 if(target){
  target.focus({preventScroll:true});
  if(mark.selection&&textSelection(target))target.setSelectionRange(...mark.selection);
  if(scope.ownerDocument.activeElement===target)return true;
 }
 if(!mark.fallback)return false;
 const fallback=[...scope.querySelectorAll(mark.fallback)].find(focusable);
 if(fallback){
  fallback.focus({preventScroll:true});
  fallback.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
 }
 return !!fallback;
}

function tabStops(dialog){
 return [...dialog.querySelectorAll(controls)].filter(el=>(el.tabIndex>=0||el.matches('summary:not([tabindex])'))&&focusable(el));
}

function focusDialog(dialog,control){
 if(!control)dialog.tabIndex=-1;
 (control||dialog).focus({preventScroll:true});
}

function dialogKey(dialog){
 if(dialog.dataset.focusDialog)return dialog.dataset.focusDialog;
 const region=dialog.closest('.collection-overlay')?'collections':dialog.closest('.library-overlay')?'library':'mirror';
 return region+':'+dialog.getAttribute('aria-label');
}

const panelKey=dialog=>dialog.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab;

export class RenderFocus{
 constructor(root){
  this.root=root;this.frames=[];this.invoker=null;this.composing=null;this.deferredRender=0;
  root.addEventListener('compositionstart',({target})=>{
   if(textSelection(target)||target.isContentEditable)this.composing=target;
  });
  root.addEventListener('compositionend',({target})=>{if(this.composing===target)this.composing=null;});
 }
 dialogs(){return [...this.root.querySelectorAll(modalSelector)].filter(visible);}
 topDialog(){return this.dialogs().at(-1);}
 nativeSelectOpen(){return detectsOpenSelect&&this.root.querySelector(openSelect)!==null;}
 afterEditing(render){
  const composing=this.composing&&this.composing===this.root.ownerDocument.activeElement;
  if(this.invoker||(!composing&&!this.nativeSelectOpen())){render();return;}
  if(this.deferredRender)return;
  // Native select popups do not report a close event when the value stays the same.
  this.deferredRender=setTimeout(()=>{this.deferredRender=0;this.afterEditing(render);},80);
 }
 cancelDeferred(){clearTimeout(this.deferredRender);this.deferredRender=0;}
 reset(){
  this.cancelDeferred();this.frames=[];this.invoker=null;this.composing=null;
  const active=this.root.ownerDocument.activeElement;
  if(this.root.contains(active))active.blur();
 }
 rememberInvoker(element){
  const invoker=element?.matches(controls)?bookmark(element):null;
  this.invoker=invoker;
  // Keep the pointer target through the entire delegated click.
  if(invoker)setTimeout(()=>{if(this.invoker===invoker)this.invoker=null;},0);
 }
 capture(){
  const active=this.root.ownerDocument.activeElement;
  const panels=this.dialogs().map(dialog=>({
   key:panelKey(dialog),scrollTop:dialog.scrollTop,
   details:[...dialog.querySelectorAll('details[id]')].map(detail=>[detail.id,detail.open]),
  }));
  return {active:this.root.contains(active)?bookmark(active):null,invoker:this.invoker,panels};
 }
 restore({active,invoker,panels}){
  const dialogs=this.dialogs(),dialog=dialogs.at(-1),keys=dialogs.map(dialogKey);
  let shared=0;
  while(shared<keys.length&&keys[shared]===this.frames[shared]?.key){
   const retained=dialogs[shared],previous=panels[shared];
   retained.dataset.retained='';
   if(previous&&previous.key===panelKey(retained)){
    for(const [id,open] of previous.details){
     const detail=retained.querySelector(`#${CSS.escape(id)}`);
     if(detail)detail.open=open;
    }
    retained.scrollTop=previous.scrollTop;
   }
   shared++;
  }
  const unchanged=shared===keys.length&&shared===this.frames.length;
  const departing=this.frames[shared];
  this.frames.length=shared;
  for(let i=shared;i<keys.length;i++){
   // A replacement sheet inherits the return target of the sheet it removed.
   const opener=i===shared?(departing?departing.opener:invoker||active):null;
   this.frames.push({key:keys[i],opener,returnFocus:dialogs[i].dataset.focusReturn});
  }
  if(unchanged&&restoreBookmark(dialog||this.root,active))return;
  if(departing&&shared===keys.length){
   if(restoreBookmark(dialog||this.root,departing.opener))return;
   if(!dialog){
    const target=(departing.returnFocus&&this.root.querySelector(departing.returnFocus))||[...this.root.querySelectorAll('.player-back,.page h1')].find(visible);
    if(target&&focusable(target)){if(!target.matches(controls))target.tabIndex=-1;target.focus({preventScroll:true});}
   }
  }
  if(dialog)focusDialog(dialog,tabStops(dialog)[0]);
 }
 trapTab(event,dialog){
  const items=tabStops(dialog),active=this.root.ownerDocument.activeElement;
  const edge=event.shiftKey?items[0]:items.at(-1);
  const direction=event.shiftKey?Node.DOCUMENT_POSITION_PRECEDING:Node.DOCUMENT_POSITION_FOLLOWING;
  if(!edge||!dialog.contains(active)||active===dialog||active===edge||(!items.includes(active)&&(edge.compareDocumentPosition(active)&direction))){
   event.preventDefault();focusDialog(dialog,event.shiftKey?items.at(-1):items[0]);
  }
 }
}
