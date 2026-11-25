import {uiIcon} from './ui-icons.mjs';
import {artworkURL} from './ambient.mjs';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=s=>String(s||'').trim().toLocaleLowerCase();
export function searchLibrary(data,query,kind='all'){
 const q=normal(query);if(!q)return [];
 return [['lesson',data.lessons],['course',data.courses],['collection',data.collections]].flatMap(([type,items])=>kind!=='all'&&kind!==type?[]:(items||[]).filter(item=>normal([item.title||item.name,item.channel,item.speaker,item.category,...(item.tags||[])].filter(Boolean).join(' ')).includes(q)).map(item=>({type,item})));
}
export function rememberSearch(history,term){const value=String(term||'').trim().slice(0,160);return value?[value,...(Array.isArray(history)?history:[]).filter(x=>typeof x==='string'&&normal(x)!==normal(value))].slice(0,20):history||[];}
export class SearchUI{
 constructor(store,render,open){Object.assign(this,{store,render,open});this.resetOwner();}
 resetOwner(){Object.assign(this,{query:'',kind:'all',limit:24,composing:false});}
 remember(){if(this.query.trim())this.store.mutate(d=>{d.preferences.searchHistory=rememberSearch(d.preferences.searchHistory,this.query);});}
 action(action,a={}){
  if(action==='clear'){this.query='';this.limit=24;}
  if(action==='kind'){this.kind=a.kind;this.limit=24;}
  if(action==='history'){this.query=a.value;this.limit=24;}
  if(action==='remove-history')this.store.mutate(d=>{d.preferences.searchHistory=(d.preferences.searchHistory||[]).filter(x=>x!==a.value);});
  if(action==='clear-history')this.store.mutate(d=>{d.preferences.searchHistory=[];});
  if(action==='submit')this.remember();
  if(action==='more')this.limit+=24;
  if(action==='open'){this.remember();this.open[a.kind]?.(a.id);return;}
  this.render();
 }
 bind(root){root.addEventListener('compositionstart',e=>{if(e.target.id==='search-query')this.composing=true;},true);root.addEventListener('compositionend',e=>{if(e.target.id==='search-query'){this.composing=false;this.query=e.target.value;this.limit=24;this.updateResults(root);}},true);root.addEventListener('click',e=>{const el=e.target.closest('[data-sx]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();this.action(el.dataset.sx,el.dataset);},true);root.addEventListener('input',e=>{if(e.target.id!=='search-query')return;this.query=e.target.value;this.limit=24;if(!this.composing&&!e.isComposing)this.updateResults(root);},true);root.addEventListener('keydown',e=>{if(e.target.id==='search-query'&&e.key==='Enter'&&!e.isComposing&&!this.composing){e.preventDefault();this.action('submit');}},true);}
 row({type,item}){
  const image=artworkURL(item),id=esc(item.id),title=esc(item.title||item.name);
  const favourite=type==='lesson'?`<button class="icon-btn search-result-favourite" type="button" id="search-favourite-${id}" data-action="favourite" data-id="${id}" aria-label="Favourite ${title}" aria-pressed="${!!item.favourite}">${uiIcon('heart')}</button>`:'';
  return `<article class="search-result"><button class="search-result-open" type="button" data-sx="open" data-kind="${type}" data-id="${id}"><span class="search-art" aria-hidden="true">${image?`<img src="${esc(image)}" alt="" width="48" height="48" loading="lazy">`:uiIcon(type==='collection'?'folder':type==='course'?'library':'play')}</span><span><strong>${title}</strong><small>${type==='lesson'?esc(item.channel||item.speaker||'Lesson'):type==='course'?`${item.lessonIds?.length||0} lessons`:'Collection'}</small></span>${uiIcon(type==='lesson'?'play':'chevron')}</button>${favourite}</article>`;
 }
 updateResults(root){
  const target=root.querySelector?.('#search-results');
  if(!target){this.render();return;}
  target.innerHTML=this.results();
  const clear=root.querySelector('[data-sx="clear"]');if(clear)clear.hidden=!this.query;
  this.onResults?.();
 }
 results(){const results=searchLibrary(this.store.data,this.query,this.kind),history=this.store.data.preferences.searchHistory||[];
 return this.query.trim()?`<nav class="library-tabs" aria-label="Search types">${[['all','All'],['lesson','Lessons'],['course','Courses'],['collection','Collections']].map(([kind,label])=>`<button data-sx="kind" data-kind="${kind}" aria-pressed="${this.kind===kind}">${label}</button>`).join('')}</nav><p class="search-result-count" role="status">${results.length} result${results.length===1?'':'s'}</p><div>${results.slice(0,this.limit).map(r=>this.row(r)).join('')}</div>${results.length>this.limit?'<div class="load-more" data-load-more="search"><button class="text-link" data-sx="more">Load more results</button></div>':''}${!results.length?'<section class="empty"><h2>No matches</h2><p>Try a title, creator, category or tag.</p></section>':''}`:history.length?`<section class="search-history"><header><h2>Recent searches</h2><button class="text-link" data-sx="clear-history">Clear all</button></header>${history.map(term=>`<div><button class="search-history-term" data-sx="history" data-value="${esc(term)}">${uiIcon('clock')}<span>${esc(term)}</span></button><button class="icon-btn" data-sx="remove-history" data-value="${esc(term)}" aria-label="Remove ${esc(term)} from search history">${uiIcon('close')}</button></div>`).join('')}</section>`:'<section class="search-empty"><h2>Find something to practise</h2><p>Search lesson titles, creators, courses, collections and tags.</p></section>';
 }
 view(){return `<main class="search-screen"><header class="screen-appbar"><h1>Search</h1></header><div class="global-search-field">${uiIcon('search')}<label class="sr-only" for="search-query">Search lessons, courses and collections</label><input id="search-query" name="query" type="search" dir="ltr" autocomplete="off" placeholder="Lessons, courses, collections" value="${esc(this.query)}"><button class="icon-btn" data-sx="clear" aria-label="Clear search" ${this.query?'':'hidden'}>${uiIcon('close')}</button><button class="icon-btn" data-sx="submit" aria-label="Run search">${uiIcon('chevron')}</button></div><div id="search-results">${this.results()}</div></main>`;}
}
