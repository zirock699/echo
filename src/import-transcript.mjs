import {parseTranscript,validateSegments,uid} from './transcript.mjs';
export function decodeCaption(bytes){if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);return new TextDecoder().decode(bytes);}
/** Preserve source verbatim; malformed cues do not invalidate usable neighbours. */
export function parseImportedTranscript(source,filename='transcript.srt'){
 const format=/^\s*\uFEFF?WEBVTT/.test(source)?'transcript.vtt':filename;
 // Some caption exporters omit blank lines between numbered SRT cues.
 const input=source.replace(/\r\n?/g,'\n').replace(/(^|\n)(\d+\n(?=\d{1,2}:\d{2}(?::\d{2})?[,.]\d+\s*-->))/g,'$1\n$2');
 try{const parsed=parseTranscript(input,format),checked=validateSegments(parsed.segments),notes=[...(parsed.problems||[]),...checked.errors,...checked.warnings];const segments=checked.segments;return {segments,phrases:segments.map(s=>({...s,id:uid()})),notes,status:segments.length?'ready':'invalid'};}catch(e){return {segments:[],phrases:[],notes:[e.message],status:'invalid'};}
}
export function repairStoredTranscripts(data){for(const lesson of data.lessons){if(!lesson.importedAt||lesson.phrases?.length||!lesson.source||lesson.transcriptRepairVersion===1)continue;lesson.transcriptRepairVersion=1;const result=parseImportedTranscript(lesson.source,lesson.format==='WebVTT'?'transcript.vtt':'transcript.srt');if(result.phrases.length){lesson.segments=result.segments;lesson.phrases=result.phrases;if(lesson.progress){const position=lesson.progress.position||0;lesson.progress.phraseId=(result.phrases.find(p=>p.start<=position&&p.end>position)||result.phrases.find(p=>p.start>=position)||result.phrases.at(-1))?.id;}lesson.transcriptStatus='ready';lesson.transcriptWarnings=result.notes;}}}
