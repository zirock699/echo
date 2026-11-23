import {parseTranscript,validateSegments,groupPhrases,uid} from './transcript.mjs';
export function decodeCaption(bytes){if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);return new TextDecoder().decode(bytes);}
/** Preserve source verbatim; malformed cues do not invalidate usable neighbours. */
export function parseImportedTranscript(source,filename='transcript.srt',grouping='original'){
 const format=/^\s*\uFEFF?WEBVTT/.test(source)?'transcript.vtt':filename;
 try{const parsed=parseTranscript(source,format),checked=validateSegments(parsed.segments),notes=[...(parsed.warnings||[]),...(parsed.problems||[]),...checked.errors,...checked.warnings];const segments=checked.segments;return {segments,phrases:grouping==='original'?segments.map(s=>({...s,id:uid()})):groupPhrases(segments,grouping),grouping,notes,status:segments.length?'ready':'invalid'};}catch(e){return {segments:[],phrases:[],notes:[e.message],status:'invalid'};}
}
export function repairStoredTranscripts(data){for(const lesson of data.lessons){if(!lesson.importedAt||lesson.phrases?.length||!lesson.source||lesson.transcriptRepairVersion===1)continue;lesson.transcriptRepairVersion=1;const result=parseImportedTranscript(lesson.source,lesson.format==='WebVTT'?'transcript.vtt':'transcript.srt',lesson.grouping||'original');if(result.phrases.length){lesson.segments=result.segments;lesson.phrases=result.phrases;if(lesson.progress){const position=lesson.progress.position||0;lesson.progress.phraseId=(result.phrases.find(p=>p.start<=position&&p.end>position)||result.phrases.find(p=>p.start>=position)||result.phrases.at(-1))?.id;}lesson.transcriptStatus='ready';lesson.transcriptWarnings=result.notes;}}}

const sameCues=(a,b)=>a.length===b.length&&a.every((p,i)=>p.start===b[i].start&&p.end===b[i].end&&p.text===b[i].text);
/** Repair only recognisable, unedited rolling-caption imports; retain an Undo revision. */
export function repairRollingCaptionLessons(data){
 let changed=false;
 for(const lesson of data.lessons||[]){
  if(lesson.captionNormalizationVersion===1||!lesson.source||lesson.revisions?.length)continue;
  let parsed;
  try{parsed=parseTranscript(lesson.source,lesson.format==='WebVTT'?'transcript.vtt':lesson.format==='JSON'?'transcript.json':'');}catch{continue;}
  if(!parsed.rollingCaptions||parsed.problems.length)continue;
  const checked=validateSegments(parsed.segments,null,Number(lesson.offset)||0);
  if(checked.errors.length)continue;
  const old=lesson.phrases||[],stored=lesson.segments||[],mode=lesson.grouping||'original';
  if(sameCues(stored,checked.segments)){lesson.captionNormalizationVersion=1;changed=true;continue;}
  const raw=validateSegments(parsed.rawSegments,null,Number(lesson.offset)||0).segments;
  const keys=new Set(raw.map(p=>JSON.stringify([p.start,p.end,p.text])));
  if(!stored.length||!stored.every(p=>keys.has(JSON.stringify([p.start,p.end,p.text])))||!sameCues(old,groupPhrases(stored,mode)))continue;
  const next=groupPhrases(checked.segments,mode);
  lesson.revisions=[{kind:'rolling-caption-repair',at:Date.now(),phrases:old,segments:stored,statuses:lesson.statuses||{},grouping:lesson.grouping,format:lesson.format,offset:lesson.offset}];
  const prior=lesson.statuses||{},statuses={},exactIndex=new Map(old.map(p=>[JSON.stringify([p.start,p.end,p.text]),p]));
  let cursor=0;
  for(const phrase of next){
   const exact=exactIndex.get(JSON.stringify([phrase.start,phrase.end,phrase.text]));
   if(exact){phrase.id=exact.id;if(prior[exact.id])statuses[phrase.id]={...prior[exact.id]};continue;}
   while(cursor<old.length&&old[cursor].end<=phrase.start)cursor++;
   let difficult=false;
   for(let i=cursor;i<old.length&&old[i].start<phrase.end;i++)if(old[i].end>phrase.start&&prior[old[i].id]?.difficult)difficult=true;
   if(difficult)statuses[phrase.id]={practised:false,difficult:true};
  }
  lesson.statuses=statuses;lesson.segments=checked.segments;lesson.phrases=next;
  lesson.captionNormalizationVersion=1;lesson.transcriptStatus='ready';lesson.transcriptWarnings=[...(parsed.warnings||[]),...checked.warnings];
  if(lesson.progress){const position=Number(lesson.progress.position)||0;lesson.progress.phraseId=(next.find(p=>p.start<=position&&position<p.end)||next.find(p=>p.start>=position)||next.at(-1))?.id;}
  changed=true;
 }
 return changed;
}
