import {repairStoredTranscripts,repairStoredTiming} from './import-transcript.mjs';
import {uid} from './transcript.mjs';
export function migrateLibrary(data){if(!Array.isArray(data.courses))data.courses=[];if(!Array.isArray(data.categories))data.categories=[];if(!Array.isArray(data.tags))data.tags=[];for(const l of data.lessons){l.tags??=[];l.courseId??=null;l.completed??=false;}repairStoredTranscripts(data);repairStoredTiming(data);data.schemaVersion=2;return data;}
export function newCourse(title,category='',tags=[]){return {id:uid(),title:title.trim(),description:'',cover:null,category,tags,pinned:false,createdAt:Date.now(),updatedAt:Date.now(),lessonIds:[]};}
export function lessonProgress(l){return l.completed?100:l.phrases?.length?Math.round(Object.values(l.statuses||{}).filter(s=>s.practised).length/l.phrases.length*100):l.duration?Math.min(99,Math.round((l.progress?.position||0)/l.duration*100)):0;}
export function courseProgress(c,lessons){const index=lessons instanceof Map?lessons:new Map(lessons.map(l=>[l.id,l]));const list=c.lessonIds.map(id=>index.get(id)).filter(Boolean);return list.length?Math.round(list.reduce((s,l)=>s+lessonProgress(l),0)/list.length):0;}
export function moveLesson(data,id,courseId){const l=data.lessons.find(l=>l.id===id);if(!l)return;for(const c of data.courses)c.lessonIds=c.lessonIds.filter(x=>x!==id);l.courseId=courseId||null;if(courseId){const c=data.courses.find(c=>c.id===courseId);if(c&&!c.lessonIds.includes(id))c.lessonIds.push(id);}l.updatedAt=Date.now();}
export function queryLibrary(data,{query='',filter='all',category='',tag='',course='',sort='recent'}={}){
 const index=new Map(data.lessons.map(l=>[l.id,l]));const progress=new Map(data.courses.map(c=>[c.id,courseProgress(c,index)]));
 const match=(x)=>`${x.title} ${x.channel||x.speaker||''} ${x.category||''} ${(x.tags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase());
 const accept=(x,p)=>match(x)&&(!category||x.category===category)&&(!tag||x.tags?.includes(tag))&&(filter==='all'||filter==='pinned'&&x.pinned||filter==='favourites'&&x.favourite||filter==='progress'&&p>0&&p<100||filter==='new'&&p===0||filter==='complete'&&p===100);
 const order=(a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='played'?(b.progress?.updatedAt||b.lastPlayedAt||0)-(a.progress?.updatedAt||a.lastPlayedAt||0):sort==='progress'?lessonProgress(b)-lessonProgress(a):(b.importedAt||b.createdAt)-(a.importedAt||a.createdAt);
 return {courses:data.courses.filter(c=>!course&&accept(c,progress.get(c.id))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(sort==='title'?a.title.localeCompare(b.title):sort==='progress'?progress.get(b.id)-progress.get(a.id):sort==='played'?(b.lastPlayedAt||0)-(a.lastPlayedAt||0):b.createdAt-a.createdAt)),lessons:data.lessons.filter(l=>(!course||l.courseId===course)&&accept(l,lessonProgress(l))).sort(order)};
}

export function pageItems(items,page=1,size=24){const pages=Math.max(1,Math.ceil(items.length/size)),current=Math.max(1,Math.min(pages,Number(page)||1));return {items:items.slice((current-1)*size,current*size),page:current,pages,total:items.length};}

export function categoryValues(data){return [...new Set([...(data.categories||[]),...(data.courses||[]).map(c=>c.category),...(data.lessons||[]).map(l=>l.category)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
