import {parseTranscript,validateSegments,uid} from './transcript.mjs';

/** One-time recovery requested by the user. Preserve an undoable copy; never rewrite edits. */
export function restoreOriginalPlayback(data){
 let changed=false;
 const prefs=data.preferences;
 if(prefs&&prefs.originalPlaybackVersion!==1){
  prefs.previousPlaybackDefaults={mode:prefs.mode,leadIn:prefs.leadIn,grouping:prefs.grouping};
  Object.assign(prefs,{mode:'continuous',leadIn:0,grouping:'original',originalPlaybackVersion:1});changed=true;
 }
 for(const lesson of data.lessons||[]){
  if(lesson.originalPlaybackVersion===1)continue;
  // Ordinary editing/regrouping revisions represent user decisions, not generated imports.
  if(lesson.revisions?.length&&!(lesson.timingRepairVersion===1&&lesson.revisions.length===1)){continue;}
  let segments=lesson.segments||[];
  if(lesson.source){
   try{
    const filename=lesson.format==='JSON'?'transcript.json':lesson.format==='WebVTT'?'transcript.vtt':'';
    const parsed=parseTranscript(lesson.source,filename),checked=validateSegments(parsed.segments,null,Number(lesson.offset)||0);
    if(parsed.problems?.length||checked.errors.length||!checked.segments.length)continue;
    segments=checked.segments;
   }catch{continue;}
  }
  const checked=validateSegments(segments);if(checked.errors.length||!checked.segments.length)continue;
  const old=lesson.phrases||[],same=old.length===checked.segments.length&&old.every((p,i)=>p.start===checked.segments[i].start&&p.end===checked.segments[i].end&&p.text===checked.segments[i].text);
  if(!same){
   const snapshot=structuredClone({phrases:old,segments:lesson.segments||[],statuses:lesson.statuses||{},progress:lesson.progress||{},source:lesson.source,format:lesson.format,offset:lesson.offset,grouping:lesson.grouping,at:Date.now()});
   lesson.playbackRecoveryBackup=snapshot;
   const {progress,...revision}=snapshot;lesson.revisions=[...(lesson.revisions||[]),revision];
   const statuses={},overrides={...lesson.pauseOverrides};
   lesson.phrases=checked.segments.map(s=>{
    const exact=old.find(p=>p.start===s.start&&p.end===s.end&&p.text===s.text),id=exact?.id||uid();
    const parent=exact||old.find(p=>p.start<=s.start&&p.end>=s.end&&p.text.includes(s.text));
    if(parent&&lesson.statuses?.[parent.id])statuses[id]={...lesson.statuses[parent.id]};
    if(parent&&lesson.pauseOverrides?.[parent.id]!=null)overrides[id]=lesson.pauseOverrides[parent.id];
    return {...s,id,segmentIds:[s.id]};
   });
   lesson.segments=checked.segments;lesson.statuses=statuses;lesson.pauseOverrides=overrides;
   if(lesson.progress){const t=Number(lesson.progress.position)||0;lesson.progress.phraseId=(lesson.phrases.find(p=>p.start<=t&&t<p.end)||lesson.phrases.find(p=>p.start>=t)||lesson.phrases.at(-1))?.id;}
  }
  lesson.grouping='original';lesson.originalPlaybackVersion=1;changed=true;
 }
 return changed;
}
