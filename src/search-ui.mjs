import {uiIcon} from './ui-icons.mjs';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=s=>String(s||'').trim().toLocaleLowerCase();
export function searchLibrary(data,query,kind='all'){
 const q=normal(query);if(!q)return [];
 return [['lesson',data.lessons],['course',data.courses],['collection',data.collections]].flatMap(([type,items])=>kind!=='all'&&kind!==type?[]:(items||[]).filter(item=>normal([item.title||item.name,item.channel,item.speaker,item.category,...(item.tags||[])].filter(Boolean).join(' ')).includes(q)).map(item=>({type,item})));
}
export function rememberSearch(history,term){const value=String(term||'').trim().slice(0,160);return value?[value,...(Array.isArray(history)?history:[]).filter(x=>typeof x==='string'&&normal(x)!==normal(value))].slice(0,20):history||[];}
export class SearchUI{
 constructor(store,render,open){Object.assign(this,{store,render,open,query:'',kind:'all',limit:24});}
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
 bind(root){root.addEventListener('click',e=>{const el=e.target.closest('[data-sx]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();this.action(el.dataset.sx,el.dataset);},true);root.addEventListener('input',e=>{if(e.target.id!=='search-query')return;this.query=e.target.value;this.limit=24;this.render();},true);root.addEventListener('keydown',e=>{if(e.target.id==='search-query'&&e.key==='Enter'){e.preventDefault();this.action('submit');}},true);}
 row({type,item}){const image=item.thumbnail?.url||item.frame?.url||item.cover?.url||(type==='lesson'&&item.videoId?`https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg`:null);return `<article class="search-result"><button data-sx="open" data-kind="${type}" data-id="${esc(item.id)}"><span class="search-art" aria-hidden="true">${image?`<img src="${esc(image)}" alt="" width="48" height="48" loading="lazy">`:uiIcon(type==='collection'?'folder':type==='course'?'library':'play')}</span><span><strong>${esc(item.title||item.name)}</strong><small>${type==='lesson'?esc(item.channel||item.speaker||'Lesson'):type==='course'?`${item.lessonIds?.length||0} lessons`:'Collection'}</small></span>${uiIcon(type==='lesson'?'play':'chevron')}</button></article>`;}
 view(){const results=searchLibrary(this.store.data,this.query,this.kind),history=this.store.data.preferences.searchHistory||[];
 return `<main class="search-screen"><header class="screen-appbar"><h1>Search</h1><button class="icon-btn" data-action="settings-shortcut" aria-label="Settings">${uiIcon('settings')}</button></header><div class="global-search-field">${uiIcon('search')}<label class="sr-only" for="search-query">Search lessons, courses and collections</label><input id="search-query" type="search" autocomplete="off" placeholder="Lessons, courses, collections" value="${esc(this.query)}">${this.query?`<button class="icon-btn" data-sx="clear" aria-label="Clear search">${uiIcon('close')}</button>`:''}<button class="icon-btn" data-sx="submit" aria-label="Run search">${uiIcon('chevron')}</button></div>${this.query.trim()?`<nav class="library-tabs" aria-label="Search types">${[['all','All'],['lesson','Lessons'],['course','Courses'],['collection','Collections']].map(([kind,label])=>`<button data-sx="kind" data-kind="${kind}" aria-pressed="${this.kind===kind}">${label}</button>`).join('')}</nav><p class="search-result-count" role="status">${results.length} result${results.length===1?'':'s'}</p><div>${results.slice(0,this.limit).map(r=>this.row(r)).join('')}</div>${results.length>this.limit?'<div class="load-more" data-load-more="search"><button class="text-link" data-sx="more">Load more results</button></div>':''}${!results.length?'<section class="empty"><h2>No matches</h2><p>Try a title, creator, category or tag.</p></section>':''}`:history.length?`<section class="search-history"><header><h2>Recent searches</h2><button class="text-link" data-sx="clear-history">Clear all</button></header>${history.map(term=>`<div><button class="search-history-term" data-sx="history" data-value="${esc(term)}">${uiIcon('clock')}<span>${esc(term)}</span></button><button class="icon-btn" data-sx="remove-history" data-value="${esc(term)}" aria-label="Remove ${esc(term)} from search history">${uiIcon('close')}</button></div>`).join('')}</section>`:'<section class="search-empty"><h2>Find something to practise</h2><p>Search lesson titles, creators, courses, collections and tags.</p></section>'}</main>`;
 }
}
