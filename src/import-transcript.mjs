import {parseTranscript,validateSegments,groupPhrases,speechText,uid} from './transcript.mjs';
export function decodeCaption(bytes){if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);return new TextDecoder().decode(bytes);}
/** Preserve source verbatim; malformed cues do not invalidate usable neighbours. */
export function parseImportedTranscript(source,filename='transcript.srt'){
 const format=/^\s*\uFEFF?WEBVTT/.test(source)?'transcript.vtt':filename;
 try{const parsed=parseTranscript(source,format),checked=validateSegments(parsed.segments),notes=[...(parsed.problems||[]),...checked.errors,...checked.warnings];const segments=checked.segments;return {segments,phrases:segments.map(s=>({...s,id:uid()})),notes,status:segments.length?'ready':'invalid'};}catch(e){return {segments:[],phrases:[],notes:[e.message],status:'invalid'};}
}
export function repairStoredTranscripts(data){for(const lesson of data.lessons){if(!lesson.importedAt||lesson.phrases?.length||!lesson.source||lesson.transcriptRepairVersion===1)continue;lesson.transcriptRepairVersion=1;const result=parseImportedTranscript(lesson.source,lesson.format==='WebVTT'?'transcript.vtt':'transcript.srt');if(result.phrases.length){lesson.segments=result.segments;lesson.phrases=result.phrases;if(lesson.progress){const position=lesson.progress.position||0;lesson.progress.phraseId=(result.phrases.find(p=>p.start<=position&&p.end>position)||result.phrases.find(p=>p.start>=position)||result.phrases.at(-1))?.id;}lesson.transcriptStatus='ready';lesson.transcriptWarnings=result.notes;}}}

const checkedTiming=new WeakMap();
/** Repair only signatures of earlier parser/grouping bugs, never edited lessons. */
export function repairStoredTiming(data){
 const timestamp=/\d{1,2}:\d{2}(?::\d{2})?[,.]\d+\s*-->/;
 for(const lesson of data.lessons){
  if(lesson.timingRepairVersion===1||lesson.revisions?.length||!lesson.phrases?.length||!lesson.segments?.length)continue;
  const checked=checkedTiming.get(lesson);if(checked&&checked.phrases===lesson.phrases&&checked.segments===lesson.segments&&checked.source===lesson.source&&checked.grouping===lesson.grouping)continue;checkedTiming.set(lesson,{phrases:lesson.phrases,segments:lesson.segments,source:lesson.source,grouping:lesson.grouping});
  const contaminated=lesson.segments.some(s=>timestamp.test(s.text))&&lesson.phrases.some(p=>timestamp.test(p.text));
  let segments=lesson.segments,phrases;
  if(contaminated&&lesson.source){
   try{const parsed=parseTranscript(lesson.source,lesson.format==='WebVTT'?'transcript.vtt':lesson.format==='JSON'?'transcript.json':'transcript.srt'),checked=validateSegments(parsed.segments,null,Number(lesson.offset)||0);if(checked.errors.length||checked.segments.length<2)continue;segments=checked.segments;phrases=lesson.grouping==='original'?segments.map(s=>({...s,id:uid()})):groupPhrases(segments,lesson.grouping);if(!phrases.length)continue;}catch{continue;}
   for(const phrase of phrases){const old=lesson.phrases.find(p=>p.start===phrase.start&&p.end===phrase.end);if(old)phrase.id=old.id;}
  }else{
   const index=new Map(segments.map(s=>[s.id,s]));let changed=false;
   phrases=lesson.phrases.map(phrase=>{const source=phrase.segmentIds?.map(id=>index.get(id));if(!source?.length||source.some(s=>!s))return phrase;const end=source.reduce((n,s)=>Math.max(n,s.end),0),text=source.map(s=>speechText(s.text)).join(' ').replace(/\s+/g,' ').trim();if(phrase.start===source[0].start&&phrase.end===source.at(-1).end&&end>phrase.end&&phrase.text===text){changed=true;return {...phrase,end};}return phrase;});
   if(!changed)continue;
  }
  lesson.revisions=[{phrases:structuredClone(lesson.phrases),segments:structuredClone(lesson.segments),statuses:structuredClone(lesson.statuses||{}),source:lesson.source,format:lesson.format,offset:lesson.offset,grouping:lesson.grouping,at:Date.now()}];
  lesson.segments=segments;lesson.phrases=phrases;lesson.timingRepairVersion=1;
  if(lesson.progress){const time=Number(lesson.progress.position)||0;lesson.progress.phraseId=phrases.filter(p=>p.start<=time&&p.end>time).at(-1)?.id||phrases.find(p=>p.start>=time)?.id||phrases.at(-1)?.id;}
 }
}
