import {matchesCategoryRule} from './category-rules.mjs';
import {repairStoredTranscripts} from './import-transcript.mjs';
import {fmtTime,uid} from './transcript.mjs';
export function migrateLibrary(data){if(!Array.isArray(data.courses))data.courses=[];if(!Array.isArray(data.categories))data.categories=[];if(!Array.isArray(data.tags))data.tags=[];for(const l of data.lessons){l.tags??=[];l.courseId??=null;l.completed??=false;}repairStoredTranscripts(data);data.schemaVersion=2;return data;}
export function newCourse(title,category='',tags=[]){return {id:uid(),title:title.trim(),description:'',cover:null,category,tags,pinned:false,createdAt:Date.now(),updatedAt:Date.now(),lessonIds:[]};}
function listenedTime(coverage, duration){
 const intervals=[];
 for(const [from,to] of coverage??[]){
  if(!Number.isFinite(from)||!Number.isFinite(to))continue;
  const start=Math.max(0,from),end=Math.min(duration??Infinity,to);
  if(end>start)intervals.push([start,end]);
 }
 intervals.sort((a,b)=>a[0]-b[0]);
 let covered=0,end=0;
 for(const [start,stop] of intervals){
  if(stop>end){covered+=stop-Math.max(start,end);end=stop;}
 }
 return covered;
}
const incompleteScore=value=>Math.max(1,Math.min(99,Math.round(value)));
const percentLabel=value=>value<1?'<1%':`${value<100?Math.min(99,Math.round(value)):100}%`;

function lessonMeasures(lesson){
 if(lesson.completed)return {score:100,value:100,label:'Completed'};
 const phrases=lesson.phrases??[];
 const statuses=lesson.statuses??{};
 const practised=Object.keys(statuses).length?phrases.reduce((count,phrase)=>count+Number(statuses[phrase.id]?.practised===true),0):0;
 if(practised){
  const value=100*practised/phrases.length;
  return {score:practised===phrases.length?100:incompleteScore(value),value,label:`${percentLabel(value)} practised`};
 }
 // Imports and playback can store duration in different clocks for offset audio.
 const duration=!lesson.audioOffset&&Number.isFinite(lesson.duration)&&lesson.duration>0?lesson.duration:null;
 const progress=lesson.progress;
 const covered=listenedTime(progress?.coverage,duration);
 if(covered){
  const value=duration?Math.min(100,100*covered/duration):null;
  const label=value!==null?`${percentLabel(value)} listened`:covered>=1?`${fmtTime(covered)} listened`:'Listening started';
  return {score:incompleteScore(value??1),value,label};
 }
 if(Number.isFinite(progress?.position)&&progress.position>0){
  const position=duration?Math.min(progress.position,duration):progress.position;
  return {score:0,value:duration?100*position/duration:null,label:`Resume at ${fmtTime(position)}`};
 }
 return {score:0,value:0,label:'Not started'};
}

/** Activity used for sorting, filters and Continue. Seeking alone earns none. */
export function lessonProgress(lesson){return lessonMeasures(lesson).score;}
export function progressIndicator(lesson){
 const {value,label}=lessonMeasures(lesson);
 return {value,label};
}
export function progressLabel(lesson){return lessonMeasures(lesson).label;}

function meanCourseScore(course, scoreFor){
 let total=0,count=0;
 for(const id of course.lessonIds){
  const score=scoreFor(id);
  if(score===undefined)continue;
  total+=score;count++;
 }
 return !count||!total?0:total===100*count?100:incompleteScore(total/count);
}
export function courseProgress(course,lessons){
 const index=lessons instanceof Map?lessons:new Map(lessons.map(lesson=>[lesson.id,lesson]));
 return meanCourseScore(course,id=>index.has(id)?lessonProgress(index.get(id)):undefined);
}
export function moveLesson(data,id,courseId){const l=data.lessons.find(l=>l.id===id);if(!l)return;for(const c of data.courses)c.lessonIds=c.lessonIds.filter(x=>x!==id);l.courseId=courseId||null;if(courseId){const c=data.courses.find(c=>c.id===courseId);if(c&&!c.lessonIds.includes(id))c.lessonIds.push(id);}l.updatedAt=Date.now();}
export function queryLibrary(data,{query='',filter='all',category='',tag='',course='',sort='recent'}={}){
 const lessonScores=new Map(data.lessons.map(l=>[l.id,lessonProgress(l)]));
 const progress=new Map(data.courses.map(c=>[c.id,meanCourseScore(c,id=>lessonScores.get(id))]));
 const match=(x)=>`${x.title} ${x.channel||x.speaker||''} ${x.category||''} ${(x.tags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase());
 const accept=(x,p)=>match(x)&&(!category||x.category===category||matchesCategoryRule(x,data.categoryRules?.[category],p))&&(!tag||x.tags?.includes(tag))&&(filter==='all'||filter==='pinned'&&x.pinned||filter==='favourites'&&x.favourite||filter==='progress'&&p>0&&p<100||filter==='new'&&p===0||filter==='complete'&&p===100);
 const order=(a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='played'?(b.progress?.updatedAt||b.lastPlayedAt||0)-(a.progress?.updatedAt||a.lastPlayedAt||0):sort==='progress'?lessonScores.get(b.id)-lessonScores.get(a.id):(b.importedAt||b.createdAt)-(a.importedAt||a.createdAt);
 return {courses:data.courses.filter(c=>!course&&accept(c,progress.get(c.id))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(sort==='title'?a.title.localeCompare(b.title):sort==='progress'?progress.get(b.id)-progress.get(a.id):sort==='played'?(b.lastPlayedAt||0)-(a.lastPlayedAt||0):b.createdAt-a.createdAt)),lessons:data.lessons.filter(l=>(!course||l.courseId===course)&&accept(l,lessonScores.get(l.id))).sort(order)};
}

export function pageItems(items,page=1,size=24){const pages=Math.max(1,Math.ceil(items.length/size)),current=Math.max(1,Math.min(pages,Number(page)||1));return {items:items.slice((current-1)*size,current*size),page:current,pages,total:items.length};}

export function categoryValues(data){return [...new Set([...(data.categories||[]),...Object.keys(data.categoryRules||{}),...(data.courses||[]).map(c=>c.category),...(data.lessons||[]).map(l=>l.category)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
