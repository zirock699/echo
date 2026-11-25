import {CATEGORY_PRESETS} from './category-rules.mjs';
import {artworkURL} from './ambient.mjs';
import {uiIcon} from './ui-icons.mjs';
import {inspectPackage,audioType,validAudio} from './zip-import.mjs';
import {newCourse,moveLesson,queryLibrary,lessonProgress,progressIndicator,courseProgress,pageItems,categoryValues} from './courses.mjs';
import {createLesson} from './store.mjs';
import {applyLessonAssetChanges,queueUnreferencedMedia,removeLessons} from './library-mutations.mjs';
import {syncSaveMessage} from './sync-notice.mjs';
import {remapStatuses} from './transcript.mjs';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tags=s=>[...new Set(String(s).split(',').map(s=>s.trim()).filter(Boolean))];
const option=(v,t,active)=>`<option value="${esc(v)}" ${v===active?'selected':''}>${esc(t)}</option>`;
const cueKey=phrase=>JSON.stringify([phrase.start,phrase.end,phrase.text,phrase.speaker??'']);

function replaceImportedLesson(data, existing, lesson){
 const prior=existing.phrases||[];
 if(lesson.phrases.length||!prior.length){
  const matchingIds=new Map();
  for(const phrase of prior){
   const key=cueKey(phrase),ids=matchingIds.get(key)||[];
   ids.push(phrase.id);matchingIds.set(key,ids);
  }
  for(const phrase of lesson.phrases)phrase.id=matchingIds.get(cueKey(phrase))?.shift()??phrase.id;
  const {statuses}=remapStatuses(prior,lesson.phrases,existing.statuses);
  for(const phrase of lesson.phrases){
   if(Object.hasOwn(existing.statuses??{},phrase.id))statuses[phrase.id]=existing.statuses[phrase.id];
  }
  for(const key of ['source','format','segments','phrases','grouping','offset','captionSource','captionLanguage','transcriptStatus','transcriptWarnings','transcriptAsset'])existing[key]=lesson[key];
  existing.statuses=statuses;
  const progress=existing.progress;
  if(progress&&!lesson.phrases.some(p=>p.id===progress.phraseId)){
   const position=progress.position||0;
   progress.phraseId=(lesson.phrases.find(p=>p.start<=position&&position<p.end)||lesson.phrases.find(p=>p.start>=position)||lesson.phrases.at(-1))?.id??null;
  }
 }
 existing.mediaSource='audio';
 existing.duration=lesson.duration;
 existing.importedAt??=lesson.importedAt;
 applyLessonAssetChanges(data,existing,lesson);
}

export class LibraryUI{
 constructor(store,render,open){
  Object.assign(this,{store,render,open,ownerVersion:0,urls:[]});
  try{this.layout=localStorage.getItem('echo-library-layout')||'list';}catch{this.layout='list';}
  this.resetOwner();
 }
 resetOwner(){
  this.ownerVersion++;
  clearTimeout(this.hold);
  this.release();
  Object.assign(this,{
   state:{query:'',filter:'all',sort:'recent',category:'',tag:'',course:''},
   searchOpen:false,page:1,previewPage:1,mobileLimit:24,kind:null,
   selected:new Set(),selecting:false,suppressClick:false,browseState:null,browsePage:1,lessonIndex:null,
   dialog:'',draft:{},progress:'',filename:'',destination:null,package:null,packageScope:null,
   busy:false,cancelled:false,summary:null,
  });
 }
 captureOwner(){return {owner:this.store.owner,version:this.ownerVersion};}
 owns(scope){return scope.owner===this.store.owner&&scope.version===this.ownerVersion;}
 bind(root){
  root.addEventListener('click',e=>{const a=e.target.closest('[data-lx]');if(!a)return;e.preventDefault();e.stopImmediatePropagation();this.action(a.dataset.lx,a.dataset);},true);
  root.addEventListener('change',e=>{const el=e.target;if(el.id==='zip-file'){this.inspect(el.files[0]);return;}if(el.id==='course-cover'){this.cover(el.files[0]);return;}if(el.dataset.lfield){this.draft[el.dataset.lfield]=el.type==='checkbox'?el.checked:el.value;if(el.dataset.lfield==='destination')this.render();}if(el.dataset.lfilter){this.state[el.dataset.lfilter]=el.value;this.page=1;this.mobileLimit=24;this.selected.clear();this.render();}},true);
  root.addEventListener('input',e=>{if(e.target.id==='course-search'){const pos=e.target.selectionStart;this.state.query=e.target.value;this.page=1;this.mobileLimit=24;this.render();const el=document.getElementById('course-search');el.focus();el.setSelectionRange(pos,pos);}if(e.target.dataset.lfield)this.draft[e.target.dataset.lfield]=e.target.value;},true);
  root.addEventListener('pointerdown',e=>{const row=e.target.closest('[data-library-key]');if(!row||e.target.closest('button[data-lx=menu]'))return;const scope=this.captureOwner();clearTimeout(this.hold);this.hold=setTimeout(()=>{if(!this.owns(scope))return;this.suppressClick=true;this.selecting=true;this.selected.add(row.dataset.libraryKey);this.render();},550);},{passive:true});for(const type of ['pointerup','pointercancel','pointermove'])root.addEventListener(type,()=>clearTimeout(this.hold),{passive:true});
 }
 release(){for(const u of this.urls)URL.revokeObjectURL(u);this.urls=[];}
 close(){if(this.busy){this.cancelled=true;this.progress='Finishing the current file before cancelling…';this.render();return;}this.dialog='';this.release();this.package=null;this.packageScope=null;this.render();}
 get contentKind(){return this.kind||(this.store.data.courses.length?'courses':'lessons');}
 coverFor(c){const cover=artworkURL(c);if(cover)return cover;const index=this.lessonIndex||new Map(this.store.data.lessons.map(l=>[l.id,l]));for(const id of c.lessonIds){const art=artworkURL(index.get(id));if(art)return art;}}
 artwork(url){return url?`<img src="${esc(url)}" alt="" loading="lazy">`:'<span aria-hidden="true">♫</span>';}
 row(kind,item){const course=kind==='c',key=kind+':'+item.id,courseScore=course?courseProgress(item,this.lessonIndex||this.store.data.lessons):null,progress=course?{value:courseScore,label:`${courseScore}% course progress`}:progressIndicator(item),art=course?this.coverFor(item):artworkURL(item);return `<article class="library-row" data-library-key="${esc(key)}">${this.selecting?`<button class="library-check" data-lx="select" data-key="${esc(key)}" aria-label="Select ${esc(item.title)}" aria-pressed="${this.selected.has(key)}">${this.selected.has(key)?'✓':'○'}</button>`:''}<button class="library-open" data-lx="open" data-kind="${kind}" data-id="${esc(item.id)}"><span class="library-art">${this.artwork(art)}</span><span class="library-copy"><strong>${esc(item.title)}</strong><small>${course?`${item.lessonIds.length} lessons${item.pinned?' · Pinned':''}`:esc(item.channel||item.speaker||'Audio lesson')}${!course&&item.duration?' · '+Math.floor(item.duration/60)+':'+String(Math.floor(item.duration%60)).padStart(2,'0'):''}</small><span class="library-progress">${progress.value===null?'':`<progress max="100" value="${progress.value}" aria-label="${esc(progress.label)}"></progress>`}<small>${esc(progress.label)}${!course&&item.transcriptStatus&&item.transcriptStatus!=='ready'?' · No transcript':''}</small></span></span><span aria-hidden="true">${course?'›':'▷'}</span></button><button class="icon-btn" data-lx="menu" data-kind="${kind}" data-id="${esc(item.id)}" aria-label="Manage ${esc(item.title)}">${uiIcon('more')}</button></article>`;}
 filtered(){return queryLibrary(this.store.data,this.state);}
 currentItems(){const list=this.filtered();if(this.state.query&&!this.state.course)return [...list.courses.map(item=>({kind:'c',item})),...list.lessons.map(item=>({kind:'l',item}))];if(this.state.course)return list.lessons.map(item=>({kind:'l',item}));if(this.contentKind==='all')return [...list.courses.map(item=>({kind:'c',item})),...list.lessons.map(item=>({kind:'l',item}))];if(this.contentKind==='courses')return list.courses.map(item=>({kind:'c',item}));const lessons=this.contentKind==='unassigned'?list.lessons.filter(l=>!l.courseId):list.lessons;return lessons.map(item=>({kind:'l',item}));}
 pager(page,action='page'){return page.pages>1?`<nav class="library-pagination" aria-label="${action==='page'?'Library':'Preview'} pages"><button data-lx="${action}" data-page="${page.page-1}" ${page.page===1?'disabled':''}>Previous</button><span>Page ${page.page} of ${page.pages}</span><button data-lx="${action}" data-page="${page.page+1}" ${page.page===page.pages?'disabled':''}>Next</button></nav>`:'';}

 view(){
 const data=this.store.data,c=data.courses.find(c=>c.id===this.state.course);this.lessonIndex=new Map(data.lessons.map(l=>[l.id,l]));let items=this.currentItems();
 if(c&&this.state.sort==='recent'&&!this.state.query){const positions=new Map(c.lessonIds.map((id,i)=>[id,i]));items.sort((a,b)=>positions.get(a.item.id)-positions.get(b.item.id));}
 const mobile=globalThis.matchMedia?.('(max-width:760px)').matches;const page=pageItems(items,mobile?1:this.page,mobile?this.mobileLimit:24);this.page=page.page;
 const resultLabel=this.state.query?'result':c?'lesson':this.contentKind==='all'?'item':this.contentKind!=='courses'||!data.courses.length?'lesson':'course';
 const categories=categoryValues(data);
 const filtered=!!(this.state.query||this.state.category||this.state.tag||this.state.filter!=='all');
 const hasCourseLessons=c?.lessonIds.some(id=>this.lessonIndex.has(id));
 return `<main class="library-screen"><header class="library-heading">${c?'<button class="icon-btn" data-lx="back" aria-label="Back to library"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>':''}<div class="library-heading-copy ${c?'course-heading-copy':''}"><h1>${esc(c?.title||'Library')}</h1><small class="library-result-count" role="status">${page.total} ${resultLabel}${page.total===1?'':'s'}${filtered?' · filtered':''}</small></div><div class="library-app-actions"><button id="library-search-toggle" class="icon-btn" data-lx="search" aria-label="Search library" aria-expanded="${this.searchOpen||!!this.state.query}"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg></button><button class="icon-btn" data-lx="settings" aria-label="Settings">${uiIcon('settings')}</button></div></header>

 ${this.searchOpen||this.state.query?`<div class="library-search"><label class="sr-only" for="course-search">Search courses, lessons, creators and tags</label><input id="course-search" placeholder="Search your library" value="${esc(this.state.query)}"><button class="text-link" data-lx="close-search">Cancel</button></div>`:''}
 ${!c&&!this.state.query?`<nav class="library-tabs" data-scroll-key="library-types" aria-label="Library content">${[['all','All'],['courses','Courses'],['lessons','Lessons'],['unassigned','Unassigned']].map(([kind,label])=>`<button data-lx="kind" data-kind="${kind}" aria-pressed="${(this.contentKind===kind)}">${label}</button>`).join('')}</nav>`:''}
 <div class="library-toolbar">${c?`<button class="btn course-resume" data-lx="continue" data-id="${esc(c.id)}" ${hasCourseLessons?'':'disabled'}>Continue</button><span class="library-toolbar-spacer"></span>`:''}${!c?`<label class="library-dropdown"><span class="sr-only">Sort library</span><select id="library-sort-inline" data-lfilter="sort">${[['recent','Recently added'],['played','Recently played'],['title','A–Z'],['progress','Progress']].map(([v,t])=>option(v,t,this.state.sort)).join('')}</select></label>`:''}<button class="icon-btn ${filtered?'needs-attention':''}" data-lx="filters" aria-label="Filter library${filtered?', filters applied':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 7h18M3 17h18M8 4v6M16 14v6"/></svg></button><button class="icon-btn" data-lx="layout" aria-label="Switch to ${this.layout==='list'?'grid':'list'} view">${this.layout==='list'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1"/></svg>'}</button>${c?`<button class="icon-btn" data-lx="menu" data-kind="c" data-id="${esc(c.id)}" aria-label="Course options" title="Course options">${uiIcon('more')}</button>`:`<button id="library-options-toggle" class="icon-btn" data-lx="library-menu" aria-label="Library actions" title="Library actions">${uiIcon('more')}</button>`}</div>

 ${this.selecting?`<div class="bulk-bar" role="region" aria-label="Selection actions"><button class="icon-btn" data-lx="selection" aria-label="Cancel selection">${uiIcon('close')}</button><strong>${this.selected.size} selected</strong><button class="text-link" data-lx="all">Select all<span class="sr-only"> ${page.total} results</span></button><button class="selection-apply" data-lx="bulk" ${!this.selected.size?'disabled':''}>Actions</button></div>`:''}
 <div class="library-items library-${esc(this.layout)}">${page.items.map(({kind,item})=>this.row(kind,item)).join('')}</div>
 ${!page.total?`<section class="empty"><h2>${filtered?'No matches':c?'No lessons yet':this.contentKind==='unassigned'?'Everything is organised':'Your library starts here'}</h2><p>${filtered?'Try another search or clear the filters.':'Add a ZIP package or a YouTube lesson.'}</p><button class="btn" data-lx="${filtered?'clear':'add'}">${filtered?'Clear filters':'Add lessons'}</button></section>`:''}
 ${mobile?(page.total>page.items.length?`<div class="load-more" data-load-more="library"><button class="text-link" data-lx="more">Load more</button></div>`:''):this.pager(page)}</main>`;
 }

 overlay(){if(!this.dialog)return '';const field=(label,key,value='',type='input')=>`<label class="form-group">${label}<${type} data-lfield="${key}" ${type==='input'?`value="${esc(value)}"`:''}>${type==='textarea'?esc(value):''}</${type}></label>`;let title='',body='';const data=this.store.data;
 if(this.dialog==='library-menu'){title='Library options';body='<div class="add-methods"><button data-lx="selection">Select items</button><button data-lx="add">Add lessons</button><button data-lx="taxonomy">Categories & tags</button></div>';}
 if(this.dialog==='add'){title='Add lessons';body='<div class="add-methods"><button data-lx="import"><strong>Import ZIP</strong><span>Add a course with audio, captions and artwork.</span></button><button data-lx="legacy"><strong>YouTube lesson</strong><span>Add a video link and paste or upload its transcript.</span></button></div><button class="text-link" data-lx="new">Create an empty course</button>'; }
 if(this.dialog==='import'){title='Import lessons';body=`<button class="btn ghost" data-lx="choose-zip" ${this.busy?'disabled':''}>${this.filename?'Choose another ZIP':'Choose ZIP'}</button><input id="zip-file" type="file" accept=".zip,application/zip" hidden ${this.busy?'disabled':''}>${this.filename?`<p>${esc(this.filename)}</p>`:''}<p role="status">${esc(this.summary?syncSaveMessage(this.store):this.progress)}</p>${this.package&&!this.summary?`<label class="form-group">Destination course<select data-lfield="destination">${option('new','Create a new course',this.draft.destination)}${data.courses.map(c=>option(c.id,c.title,this.draft.destination)).join('')}</select></label>${this.draft.destination==='new'?field('Course title','title',this.draft.title)+'<details><summary>Category and tags (optional)</summary>'+field('Category','category',this.draft.category)+field('Tags, separated by commas','tags',this.draft.tags)+'</details>':''}<details><summary>Existing lessons: repair missing transcripts by default</summary><label class="form-group">Duplicate handling<select data-lfield="duplicates">${[['repair','Repair missing transcripts only'],['skip','Skip existing'],['reuse','Move existing into this course'],['replace','Replace assets, preserve progress']].map(([v,t])=>option(v,t,this.draft.duplicates)).join('')}</select></label></details><ul class="import-preview">${pageItems(this.package.lessons,this.previewPage,8).items.map(l=>`<li>${l.preview?`<img src="${esc(l.preview)}" alt="">`:''}<span><strong>${esc(l.title)}</strong><small>${l.error?'Skipped: '+esc(l.error):(l.duplicate?'Existing · ':'')+(l.phrases.length?l.phrases.length+' phrases':'No usable transcript')}${l.notes.length?' · '+l.notes.length+' warnings':''}</small><details><summary>Details</summary>${[...l.notes,l.error].filter(Boolean).slice(0,5).map(n=>`<p>${esc(n)}</p>`).join('')}</details></span></li>`).join('')}</ul>${this.pager(pageItems(this.package.lessons,this.previewPage,8),'preview-page')}`:''}${this.summary?`<h3>Import ${this.cancelled?'cancelled':'complete'}</h3><p>${this.summary.imported} imported · ${this.summary.repaired||0} repaired · ${this.summary.reused} reused · ${this.summary.skipped} skipped · ${this.summary.noTranscript} without transcript</p><details><summary>Results</summary>${pageItems(this.summary.results,this.previewPage,8).items.map(r=>`<p>${esc(r)}</p>`).join('')}</details>${this.pager(pageItems(this.summary.results,this.previewPage,8),'preview-page')}`:''}`;}
 if(this.dialog==='course'){title=this.draft.id?'Edit course':'New course';const c=data.courses.find(c=>c.id===this.draft.id);body=(c?'<button class="text-link" data-lx="selection">Select lessons</button>':'')+field('Title','title',this.draft.title)+field('Description','description',this.draft.description,'textarea')+field('Category','category',this.draft.category)+field('Tags, separated by commas','tags',this.draft.tags)+`<label class="form-group">Cover image<input id="course-cover" type="file" accept="image/jpeg,image/png,image/webp"></label><p role="status">${esc(this.progress)}</p><button class="btn primary" data-lx="save-course">Save course</button>${c?`<button class="btn ghost" data-lx="pin" data-id="${esc(c.id)}">${c.pinned?'Unpin':'Pin'} course</button><label><input type="checkbox" data-lfield="deleteContents"> Also delete contained lessons and progress</label><button class="btn danger" data-lx="delete-course" data-id="${esc(c.id)}">Delete course</button><h3>Lesson order</h3>${c.lessonIds.map((id,i)=>`<div class="order-row"><span>${esc(data.lessons.find(l=>l.id===id)?.title||'Missing lesson')}</span><button data-lx="reorder" data-id="${esc(id)}" data-direction="-1" ${i===0?'disabled':''} aria-label="Move lesson up">↑</button><button data-lx="reorder" data-id="${esc(id)}" data-direction="1" ${i===c.lessonIds.length-1?'disabled':''} aria-label="Move lesson down">↓</button></div>`).join('')}`:''}`;}
 if(this.dialog==='lesson'){title='Lesson options';body=field('Title','title',this.draft.title)+field('Category','category',this.draft.category)+field('Tags, separated by commas','tags',this.draft.tags)+`<label class="form-group">Course<select data-lfield="courseId">${option('','No course',this.draft.courseId)}${data.courses.map(c=>option(c.id,c.title,this.draft.courseId)).join('')}</select></label><label><input type="checkbox" data-lfield="completed" ${this.draft.completed?'checked':''}> Completed</label><button class="btn primary" data-lx="save-lesson">Save</button><button class="btn danger" data-lx="delete-lesson">Delete lesson</button>`;}
 if(this.dialog==='filters'){title='Filter & sort';body=`<label class="form-group">Status<select data-lfilter="filter">${[['all','All'],['pinned','Pinned'],['progress','In progress'],['new','Not started'],['complete','Completed'],['favourites','Favourites']].map(([v,t])=>option(v,t,this.state.filter)).join('')}</select></label>`+`<label class="form-group">Sort<select data-lfilter="sort">${[['recent','Recently added'],['played','Recently played'],['title','Alphabetical'],['progress','Progress']].map(([v,t])=>option(v,t,this.state.sort)).join('')}</select></label>${['category','tag','course'].map(key=>`<label class="form-group">${key}<select data-lfilter="${key}">${option('','All',this.state[key])}${(key==='course'?data.courses.map(c=>[c.id,c.title]):[...new Set([...(data[key==='tag'?'tags':'categories']||[]),...data.courses.flatMap(c=>key==='tag'?c.tags:[c.category]),...data.lessons.flatMap(l=>key==='tag'?l.tags:[l.category])])].filter(Boolean).map(v=>[v,v])).map(([v,t])=>option(v,t,this.state[key])).join('')}</select></label>`).join('')}`;}
 if(this.dialog==='filters')body+='<button class="text-link" data-lx="taxonomy">Manage categories & tags</button>';
 if(this.dialog==='bulk'){title=`${this.selected.size} selected`;const courses=[...this.selected].every(k=>k.startsWith('c:')),lessons=[...this.selected].every(k=>k.startsWith('l:'));body=field('Category (leave blank to keep)','category',this.draft.category)+field('Tags, separated by commas','tags',this.draft.tags)+`<label class="form-group">Tag action<select data-lfield="tagAction"><option value="add">Add tags</option><option value="remove">Remove tags</option></select></label>${courses?'<label><input type="checkbox" data-lfield="pinned"> Pin courses (unchecked unpins)</label>':''}${lessons?`<label class="form-group">Move to course<select data-lfield="courseId"><option value="keep">Keep current</option>${option('','No course','keep')}${data.courses.map(c=>option(c.id,c.title,'keep')).join('')}</select></label>`:''}<button class="btn primary" data-lx="apply-bulk">Apply</button><button class="btn danger" data-lx="delete-bulk">Delete selected</button>`;}
 if(this.dialog==='taxonomy'){
  title='Categories & tags';const existing=categoryValues(data);
  body=`<h3>Suggested categories</h3><div class="category-presets">${CATEGORY_PRESETS.map((preset,index)=>`<button data-lx="category-preset" data-index="${index}" aria-pressed="${!!data.categoryRules?.[preset.name]}">${data.categoryRules?.[preset.name]?uiIcon('check'):''}${esc(preset.name)}</button>`).join('')}</div><button class="btn" data-lx="new-category-rule">Create category</button><div class="category-rules-list">${existing.length?'<h3>Your categories</h3>':''}${existing.map(name=>`<div class="order-row"><span>${esc(name)}<small>${data.categoryRules?.[name]?'Saved filter':'Assigned to lessons and courses'}</small></span><button data-lx="edit-category-rule" data-value="${esc(name)}" aria-label="Edit ${esc(name)} category">Edit</button><button data-lx="remove-taxonomy" data-kind="categories" data-value="${esc(name)}" aria-label="Remove ${esc(name)} category">Remove</button></div>`).join('')}</div><details><summary>Tags</summary>${field('New tag','tag','')}<button class="btn" data-lx="add-taxonomy">Add tag</button>${[...new Set([...(data.tags||[]),...[...data.courses,...data.lessons].flatMap(x=>x.tags||[])])].map(value=>`<div class="order-row"><span>${esc(value)}</span><button data-lx="rename-taxonomy" data-kind="tags" data-value="${esc(value)}">Rename</button><button data-lx="remove-taxonomy" data-kind="tags" data-value="${esc(value)}">Remove</button></div>`).join('')}</details>`;
 }
 if(this.dialog==='category-rule'){
  title=this.draft.previousName?'Edit category':'Create category';
  body=`${field('Category name','name',this.draft.name)}${field('Match any keyword, separated by commas','keywords',this.draft.keywords)}<p class="field-note">Matches lesson titles, creators and tags. Combine with the filters below, or leave them empty to assign the category manually.</p><label class="form-group">Course<select data-lfield="course">${option('','Any course',this.draft.course)}${data.courses.map(c=>option(c.id,c.title,this.draft.course)).join('')}</select></label><label class="form-group">Tag<select data-lfield="tag">${option('','Any tag',this.draft.tag)}${[...new Set([...(data.tags||[]),...data.lessons.flatMap(l=>l.tags||[])])].map(t=>option(t,t,this.draft.tag)).join('')}</select></label><label class="form-group">Progress<select data-lfield="filter">${[['all','Any progress'],['new','Not started'],['progress','In progress'],['complete','Completed'],['favourites','Favourites']].map(([v,t])=>option(v,t,this.draft.filter)).join('')}</select></label>${this.draft.error?`<p role="alert">${esc(this.draft.error)}</p>`:''}<div class="modal-footer"><button class="btn ghost" data-lx="taxonomy">Cancel</button><button class="btn primary" data-lx="save-category-rule">Save category</button></div>`;
 }

 return `<div class="modal-shade library-overlay"><section class="modal large" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-lx="close" aria-label="Close">×</button></div><div class="library-dialog-body">${body}</div>${this.dialog==='import'?`<footer class="import-footer"><span>${this.summary?`${this.summary.imported} imported · ${this.summary.repaired||0} repaired`:this.package?`${this.package.lessons.length} lessons detected`:'Choose a ZIP to begin'}</span><button class="btn ghost" data-lx="close">${this.busy?'Cancel':'Close'}</button>${this.summary?'<button class="btn primary" data-lx="destination">Open course</button>':this.package?`<button class="btn primary" data-lx="commit" ${this.busy?'disabled':''}>Import lessons</button>`:''}</footer>`:''}</section></div>`;
 }
 async upload(bytes,type,name,scope){
  if(!this.owns(scope))throw Error('The account changed. Start the upload again.');
  const res=await this.store.ownedFetch('/api/audio',{
   method:'POST',headers:{'Content-Type':type,'X-File-Size':String(bytes.byteLength||bytes.size),'X-File-Name':encodeURIComponent(name)},body:bytes,
  },scope.owner);
  const result=await res.json();
  if(!res.ok)throw Error(result.error||'Asset upload failed');
  return result;
 }
 async cover(file){
  if(!file)return;
  if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){this.progress='Choose a JPEG, PNG or WebP smaller than 5 MB.';this.render();return;}
  const scope=this.captureOwner(),draft=this.draft;
  try{
   const cover=await this.upload(file,file.type,file.name,scope);
   if(!this.owns(scope)||this.draft!==draft||this.dialog!=='course')return;
   draft.cover=cover;this.progress='Cover uploaded. Save the course to keep it.';
  }catch(e){
   if(!this.owns(scope)||this.draft!==draft||this.dialog!=='course')return;
   this.progress=e.message;
  }
  this.render();
 }
 async inspect(file){
  if(!file||this.busy)return;
  const scope=this.captureOwner();
  const check=()=>{if(!this.owns(scope)||this.cancelled)throw Error('Inspection cancelled.');};
  this.release();this.cancelled=false;this.busy=true;this.package=null;this.packageScope=null;this.summary=null;
  this.previewPage=1;this.filename=file.name;this.progress='Checking archive…';this.render();
  try{
   const archive=await inspectPackage(file,message=>{check();this.progress=message;this.render();});
   check();
   for(const l of archive.lessons){
    l.duplicate=this.store.data.lessons.some(x=>x.videoId&&x.videoId===l.meta?.video_id);
    const image=l.thumbnail||l.frame;
    if(image&&!l.error&&archive.zip.entries.get(image).length<=1024*1024&&this.urls.length<40){
     const bytes=await archive.zip.read(image);
     check();
     l.preview=URL.createObjectURL(new Blob([bytes],{type:image.endsWith('.png')?'image/png':image.endsWith('.webp')?'image/webp':'image/jpeg'}));
     this.urls.push(l.preview);
    }
   }
   this.package=archive;this.packageScope=scope;
   this.draft={destination:'new',title:archive.title,category:'',tags:'',duplicates:'repair'};
   this.progress=archive.warnings.join(' ')||'Review your lessons before importing.';
  }catch(e){
   if(this.owns(scope)){this.release();this.progress=e.message;}
  }finally{
   if(this.owns(scope)){this.busy=false;this.render();}
  }
 }
 async commit(){
  const archive=this.package,scope=this.captureOwner();
  if(this.busy||!archive||(this.packageScope&&!this.owns(this.packageScope)))return;
  if(this.draft.destination==='new'&&!this.draft.title?.trim()){this.progress='Enter a course title.';this.render();return;}
  this.busy=true;this.cancelled=false;
  const data=this.store.data,duplicates=this.draft.duplicates,creating=this.draft.destination==='new';
  const c=creating?newCourse(this.draft.title,this.draft.category||'',tags(this.draft.tags)):data.courses.find(c=>c.id===this.draft.destination);
  if(!c){this.busy=false;return;}
  const current=()=>{
   if(!this.owns(scope))return false;
   if(this.store.data===data)return true;
   this.busy=false;this.release();this.package=null;this.packageScope=null;
   this.progress='Your library changed. Choose the ZIP again before importing.';this.render();
   return false;
  };
  this.destination=c.id;
  const summary={imported:0,repaired:0,reused:0,skipped:0,noTranscript:0,results:[]};
  for(const [i,l]of archive.lessons.entries()){
   if(!current())return;
   if(this.cancelled)break;this.progress=`Importing ${i+1} of ${archive.lessons.length}: ${l.title}`;this.render();const uploaded=[];
   try{
    if(l.error)throw Error(l.error);const external=String(l.meta.video_id||l.folder.split('/').at(-1));const existing=data.lessons.find(x=>x.videoId===external);
    if(existing&&duplicates==='repair'){
     if(existing.phrases?.length||!l.phrases.length){summary.skipped++;summary.results.push(`${l.title}: ${existing.phrases?.length?'existing transcript retained':'no valid transcript to repair'}`);continue;}
     this.store.mutate(()=>{existing.source=l.source;existing.segments=l.segments;existing.phrases=l.phrases;existing.grouping=l.grouping||'original';if(existing.progress){const position=existing.progress.position||0;existing.progress.phraseId=(l.phrases.find(p=>p.start<=position&&p.end>position)||l.phrases.find(p=>p.start>=position)||l.phrases.at(-1))?.id;}existing.transcriptStatus='ready';existing.transcriptWarnings=l.notes;existing.transcriptAsset={name:l.transcript,sourceField:'source'};existing.updatedAt=Date.now();});this.onAssetsChanged?.(existing.id);summary.repaired++;summary.results.push(`${l.title}: transcript repaired (${l.phrases.length} phrases); audio and progress retained`);continue;
    }
    if(existing&&duplicates==='skip'){summary.skipped++;summary.results.push(`${l.title}: existing lesson skipped`);continue;}
    if(existing&&duplicates==='reuse'){this.store.mutate(d=>{if(!d.courses.some(x=>x.id===c.id))d.courses.push(c);moveLesson(d,existing.id,c.id);});summary.reused++;continue;}
    const bytes=await archive.zip.read(l.audio),type=audioType(l.audio);
    if(!current())return;
    if(!validAudio(bytes,type))throw Error('Audio file header is invalid or unsupported.');
    const measured=await this.duration(bytes,type);
    if(!current())return;
    if(!measured)throw Error('This audio could not be decoded by your browser.');
    const audio=await this.upload(bytes,type,l.audio.split('/').at(-1),scope);
    if(!current())return;
    uploaded.push(audio.url);
    const assets={};
    for(const key of ['thumbnail','frame'])if(l[key]){
     try{
      const b=await archive.zip.read(l[key]);
      if(!current())return;
      const ext=l[key].split('.').at(-1).toLowerCase(),type=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
      if(b.length>5*1024*1024)throw Error('Image exceeds 5 MB');
      assets[key]=await this.upload(b,type,l[key].split('/').at(-1),scope);
      if(!current())return;
      uploaded.push(assets[key].url);
     }catch(e){
      if(!current())return;
      l.notes.push('Artwork skipped: '+e.message);
     }
    }
    let duration=Number(l.meta.duration_seconds);if(!Number.isFinite(duration)||duration<=0)duration=measured;
    const lesson=createLesson(external,l.title,l.source,'SRT',l.segments,l.phrases,l.grouping||'original',0,String(l.meta.channel||''));Object.assign(lesson,{...assets,audio,mediaSource:'audio',importedAt:Date.now(),duration:duration>0?duration:null,youtubeUrl:/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(l.meta.youtube_url||'')?l.meta.youtube_url:null,channel:String(l.meta.channel||''),captionSource:String(l.meta.caption_source||''),captionLanguage:String(l.meta.caption_language||''),transcriptStatus:l.phrases.length?'ready':l.transcript?'invalid':'missing',transcriptAsset:l.transcript?{name:l.transcript,sourceField:'source'}:null,category:c.category,tags:[...(c.tags??[])],courseId:c.id});
    this.store.mutate(d=>{
     if(existing&&!d.lessons.includes(existing))throw Error('The existing lesson was removed during import.');
     if(!creating&&!d.courses.includes(c))throw Error('The destination course was removed during import.');
     if(!d.courses.some(x=>x.id===c.id))d.courses.push(c);
     if(existing)replaceImportedLesson(d,existing,lesson);else d.lessons.push(lesson);
     moveLesson(d,existing?.id??lesson.id,c.id);
    });
    if(existing)this.onAssetsChanged?.(existing.id);
    summary.imported++;
    if(!(existing??lesson).phrases.length)summary.noTranscript++;
    summary.results.push(`${l.title}: imported${l.notes.length?' — '+l.notes.join('; '):''}`);
   }catch(e){
    if(!current())return;
    summary.skipped++;summary.results.push(`${l.title}: ${e.message}`);
    if(uploaded.length)this.store.mutate(d=>queueUnreferencedMedia(d,uploaded));
   }
   await new Promise(r=>setTimeout(r,0));
  }
  if(!current())return;
  await this.store.flush();
  if(!current())return;
  this.previewPage=1;this.progress='';this.summary=summary;this.busy=false;this.render();
 }
 async duration(bytes,type){const url=URL.createObjectURL(new Blob([bytes],{type}));try{return await new Promise(resolve=>{const a=new Audio(),done=value=>{clearTimeout(timer);a.removeAttribute('src');a.load();resolve(value);};const timer=setTimeout(()=>done(null),5000);a.onloadedmetadata=()=>done(Number.isFinite(a.duration)?a.duration:null);a.onerror=()=>done(null);a.src=url;});}finally{URL.revokeObjectURL(url);}}
 remove(keys,deleteContents=false){
  this.store.mutate(d=>{
   const lessons=new Set(),courses=new Set(),covers=[];
   for(const key of keys)(key[0]==='c'?courses:lessons).add(key.slice(2));
   if(courses.size){
    const legacyMembers=new Set();
    d.courses=d.courses.filter(course=>{
     if(!courses.has(course.id))return true;
     covers.push(course.cover?.url);
     if(deleteContents)for(const id of course.lessonIds)legacyMembers.add(id);
     return false;
    });
    for(const lesson of d.lessons){
     if(deleteContents&&(courses.has(lesson.courseId)||(!lesson.courseId&&legacyMembers.has(lesson.id))))lessons.add(lesson.id);
     else if(courses.has(lesson.courseId))lesson.courseId=null;
    }
   }
   removeLessons(d,lessons);
   if(covers.length)queueUnreferencedMedia(d,covers);
  });
 }
 browse({kind='lessons',filter='all',sort='recent',category=''}={}){this.kind=kind;this.mobileLimit=24;Object.assign(this.state,{query:'',filter,sort,category,tag:'',course:''});this.searchOpen=false;this.selecting=false;this.suppressClick=false;this.selected.clear();this.page=1;this.dialog='';this.render();}
 action(action,a={}){const data=this.store.data;if(['kind','clear','filters','back','open','filter','search','close-search'].includes(action))this.mobileLimit=24;if(action==='more')this.mobileLimit+=24;if(this.busy&&!['close'].includes(action))return;
  if(action==='close'){this.close();return;}
  if(action==='search'){this.searchOpen=true;this.render();document.getElementById('course-search')?.focus();return;}
  if(action==='close-search'){this.searchOpen=false;this.state.query='';this.page=1;}
  if(action==='library-menu')this.dialog='library-menu';
  if(action==='settings'){this.dialog='';this.onSettings?.();return;}
  if(action==='choose-zip'){document.getElementById('zip-file')?.click();return;}
  if(action==='add'){this.dialog='add';}
  if(action==='layout'){this.layout=this.layout==='list'?'grid':'list';try{localStorage.setItem('echo-library-layout',this.layout);}catch{}}
  if(action==='page'){this.page=Number(a.page);window.scrollTo(0,0);}
  if(action==='preview-page')this.previewPage=Number(a.page);
  if(action==='kind'){this.kind=a.kind;this.page=1;this.selected.clear();}
  if(action==='import'){this.release();this.package=null;this.packageScope=null;this.filename='';this.summary=null;this.progress='';this.dialog='import';}
  if(action==='commit'){this.commit();return;}
  if(action==='destination'){this.onLibrary?.();this.page=1;this.state.course=data.courses.some(c=>c.id===this.destination)?this.destination:'';this.close();return;}
  if(action==='legacy'){this.dialog='';this.onLegacy?.();return;}
  if(action==='clear'){this.page=1;Object.assign(this.state,{query:'',filter:'all',category:'',tag:'',course:''});}
  if(action==='filter')this.state.filter=a.filter;
  if(action==='back'){if(this.browseState)Object.assign(this.state,this.browseState);else this.state.course='';this.page=this.browsePage||1;}
  if(action==='filters')this.dialog='filters';
  if(action==='category-preset'){
   const preset=CATEGORY_PRESETS[Number(a.index)];if(!preset)return;
   this.store.mutate(d=>{d.categoryRules={...d.categoryRules,[preset.name]:{keywords:preset.keywords,filter:'all'}};d.categories=[...new Set([...d.categories,preset.name])];});
  }
  if(action==='new-category-rule'){this.draft={name:'',keywords:'',course:'',tag:'',filter:'all'};this.dialog='category-rule';}
  if(action==='edit-category-rule'){this.draft={name:a.value,previousName:a.value,keywords:'',course:'',tag:'',filter:'all',...data.categoryRules?.[a.value]};this.dialog='category-rule';}
  if(action==='save-category-rule'){
   const name=this.draft.name?.trim(),old=this.draft.previousName;
   if(!name||name.length>80){this.draft.error='Enter a category name of up to 80 characters.';this.render();return;}
   if(name!==old&&categoryValues(data).includes(name)){this.draft.error='A category with that name already exists.';this.render();return;}
   const rule={keywords:this.draft.keywords?.trim()||'',tag:this.draft.tag||'',course:this.draft.course||'',filter:this.draft.filter||'all'};
   this.dialog='taxonomy';this.store.mutate(d=>{d.categoryRules={...d.categoryRules};if(old&&old!==name){delete d.categoryRules[old];d.categories=d.categories.filter(x=>x!==old);for(const item of [...d.courses,...d.lessons])if(item.category===old)item.category=name;}d.categories=[...new Set([...d.categories,name])];if(rule.keywords||rule.tag||rule.course||rule.filter!=='all')d.categoryRules={...d.categoryRules,[name]:rule};else delete d.categoryRules[name];});
  }
  if(action==='taxonomy'){this.draft={};this.dialog='taxonomy';}
  if(action==='add-taxonomy'){this.store.mutate(d=>{for(const [key,value]of [['categories',this.draft.category],['tags',this.draft.tag]])if(value?.trim())d[key]=[...new Set([...d[key],value.trim()])];});}
  if(['rename-taxonomy','remove-taxonomy'].includes(action)){if(action==='remove-taxonomy'&&!confirm('Remove this value from all courses and lessons?'))return;const value=action==='remove-taxonomy'?'':prompt('New name',a.value);if(value===null)return;this.store.mutate(d=>{if(a.kind==='categories'&&d.categoryRules){const rule=d.categoryRules[a.value];delete d.categoryRules[a.value];if(value.trim()&&rule)d.categoryRules[value.trim()]=rule;}d[a.kind]=[...new Set(d[a.kind].map(v=>v===a.value?value.trim():v).filter(Boolean))];for(const x of [...d.courses,...d.lessons])if(a.kind==='tags')x.tags=[...new Set((x.tags||[]).map(v=>v===a.value?value.trim():v).filter(Boolean))];else if(x.category===a.value)x.category=value.trim();});}
  if(action==='selection'){this.dialog='';this.selecting=!this.selecting;this.selected.clear();}
  if(action==='select'){this.selected.has(a.key)?this.selected.delete(a.key):this.selected.add(a.key);}
  if(action==='all'){for(const {kind,item}of this.currentItems())this.selected.add(kind+':'+item.id);}
  if(action==='open'){if(this.suppressClick){this.suppressClick=false;return;}if(this.selecting){this.action('select',{key:a.kind+':'+a.id});return;}if(a.kind==='c'){this.browseState={...this.state};this.browsePage=this.page;Object.assign(this.state,{course:a.id,query:'',filter:'all',category:'',tag:''});this.page=1;}else{this.open(a.id);return;}}
  if(action==='continue'){
   const course=data.courses.find(c=>c.id===a.id);if(!course)return;
   const index=new Map(data.lessons.map(lesson=>[lesson.id,lesson]));
   const lessons=course.lessonIds.map(id=>index.get(id)).filter(Boolean);
   const next=lessons.find(lesson=>lessonProgress(lesson)<100)??lessons[0];
   if(next)this.open(next.id);
   return;
  }
  if(action==='new'){this.draft={title:'',description:'',category:'',tags:''};this.progress='';this.dialog='course';}
  if(action==='menu'){const x=(a.kind==='c'?data.courses:data.lessons).find(x=>x.id===a.id);this.draft={...x,tags:(x.tags||[]).join(', ')};this.progress='';this.dialog=a.kind==='c'?'course':'lesson';}
  if(action==='save-course'){
   if(!this.draft.title?.trim())return;
   this.store.mutate(d=>{
    const existing=d.courses.find(c=>c.id===this.draft.id);
    const values={title:this.draft.title.trim(),description:this.draft.description||'',category:this.draft.category||'',tags:tags(this.draft.tags),updatedAt:Date.now(),...(this.draft.cover?{cover:this.draft.cover}:{})};
    if(existing){
     const previous=existing.cover?.url;
     Object.assign(existing,values);
     if(previous&&previous!==existing.cover?.url)queueUnreferencedMedia(d,[previous]);
    }else d.courses.push({...newCourse(values.title),...values});
   });
   this.dialog='';
  }
  if(action==='save-lesson'){this.store.mutate(d=>{const l=d.lessons.find(l=>l.id===this.draft.id);Object.assign(l,{title:this.draft.title.trim()||l.title,tags:tags(this.draft.tags),category:this.draft.category||'',completed:!!this.draft.completed});moveLesson(d,l.id,this.draft.courseId);});this.dialog='';}
  if(action==='pin')this.store.mutate(d=>{const c=d.courses.find(c=>c.id===a.id);c.pinned=!c.pinned;});
  if(action==='reorder')this.store.mutate(d=>{const c=d.courses.find(c=>c.id===this.draft.id),i=c.lessonIds.indexOf(a.id),j=i+Number(a.direction);if(j>=0&&j<c.lessonIds.length)[c.lessonIds[i],c.lessonIds[j]]=[c.lessonIds[j],c.lessonIds[i]];});
  if(action==='delete-course'){if(!confirm(this.draft.deleteContents?'Delete this course, all its lessons, media and learning progress?':'Delete this course? Its lessons and learning progress will remain in the library.'))return;this.remove(['c:'+a.id],!!this.draft.deleteContents);this.state.course='';this.dialog='';}
  if(action==='delete-lesson'){if(!confirm('Delete this lesson, its media and progress?'))return;this.remove(['l:'+this.draft.id]);this.dialog='';}
  if(action==='bulk'){this.draft={category:'',tags:'',tagAction:'add',courseId:'keep'};this.dialog='bulk';}
  if(action==='apply-bulk'){this.store.mutate(d=>{for(const key of this.selected){const kind=key[0],id=key.slice(2),x=(kind==='c'?d.courses:d.lessons).find(x=>x.id===id);if(!x)continue;if(this.draft.category)x.category=this.draft.category;const names=tags(this.draft.tags);x.tags=this.draft.tagAction==='remove'?(x.tags||[]).filter(t=>!names.includes(t)):[...new Set([...(x.tags||[]),...names])];if(kind==='c'&&[...this.selected].every(k=>k.startsWith('c:')))x.pinned=!!this.draft.pinned;if(kind==='l'&&this.draft.courseId!=='keep')moveLesson(d,id,this.draft.courseId);}});this.dialog='';}
  if(action==='delete-bulk'){if(!confirm(`Delete ${this.selected.size} selected items? Lessons in selected courses remain unless individually selected.`))return;this.remove([...this.selected]);this.selected.clear();this.dialog='';}
  this.render();
 }
}
