/** Transcript and phrase domain logic. Times are absolute seconds. No inferred word timing. */
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const round = n => Math.round(Number(n) * 1000) / 1000;
export function parseTime(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  const s = String(input ?? '').trim().replace(',', '.');
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return NaN;
  const h = +(m[1] || 0), min = +m[2], sec = +m[3], ms = +(m[4] || 0) / (m[4] ? 10 ** m[4].length : 1);
  if (min > 59 || sec > 59) return NaN;
  return h * 3600 + min * 60 + sec + ms;
}
export function fmtTime(seconds, precise = false) {
  const s = Math.max(0, Number(seconds) || 0), m = Math.floor(s / 60), h = Math.floor(m / 60);
  return `${h ? `${h}:` : ''}${String(m % 60).padStart(h ? 2 : 1, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}${precise ? `.${String(Math.round((s % 1) * 1000)).padStart(3, '0')}` : ''}`;
}
const clean = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
export function parseSRT(text) {
  const body=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim(),lines=body.split('\n').map(x=>x.trim());
  const rows=lines.flatMap((line,index)=>line.includes('-->')?[index]:[]),segments=[],problems=[];
  for(const block of body.split(/\n\s*\n/))if(!block.includes('-->')&&/[a-z]/i.test(block))problems.push('A caption block has no timestamp.');
  for(const [index,row] of rows.entries()){
    const next=rows[index+1]??lines.length;
    let content=lines.slice(row+1,next);const blank=content.indexOf('');if(blank>=0)content=content.slice(0,blank);
    // A numbered cue may follow immediately, without a blank separator.
    if(blank<0&&next<lines.length&&content.length>1&&/^\d+$/.test(lines[row-1]||'')&&/^\d+$/.test(content.at(-1)))content.pop();
    const [from,to]=lines[row].split(/\s*-->\s*/);
    segments.push({id:uid(),start:parseTime(from),end:parseTime(to?.split(/\s/)[0]),text:clean(content.join(' '))});
  }
  return {segments,problems};
}
export function parseVTT(text) {
  let body = String(text).replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
  if (body.startsWith('WEBVTT')) body = body.replace(/^WEBVTT[^\n]*\n/, '');
  body = body.replace(/^NOTE[^\n]*(?:\n(?!\n)[^\n]*)*/gm, '');
  return parseSRT(body);
}
export function parseJSON(text) {
  const json = typeof text === 'string' ? JSON.parse(text) : text;
  const source = Array.isArray(json) ? json : (json?.segments || json?.captions || json?.transcript);
  if (!Array.isArray(source)) throw new Error('JSON needs a segments, captions or transcript array.');
  const segments = source.map(s => ({
    id: String(s.id || uid()),
    start: s.startMs != null ? Number(s.startMs)/1000 : parseTime(s.start ?? s.startTime ?? s.offset),
    end: s.endMs != null ? Number(s.endMs)/1000 : s.durationMs != null ? (s.startMs != null ? Number(s.startMs)/1000 : parseTime(s.start ?? s.startTime ?? s.offset)) + Number(s.durationMs)/1000 : parseTime(s.end ?? s.endTime ?? ((s.start ?? s.startTime ?? s.offset) != null && s.duration != null ? Number(s.start ?? s.startTime ?? s.offset) + Number(s.duration) : NaN)),
    text: clean(s.text ?? s.content), speaker: s.speaker == null ? undefined : String(s.speaker),
    words: Array.isArray(s.words) ? s.words.map(w => ({text: String(w.text || ''), start: w.startMs != null ? Number(w.startMs)/1000 : parseTime(w.start), end: w.endMs != null ? Number(w.endMs)/1000 : parseTime(w.end)})) : undefined
  }));
  return {segments,problems:[]};
}
// Start-only transcript exports preserve caption starts; ends are estimates.
export function parseTimestampedText(text) {
  const segments = [], problems = [];
  const marker = /^\[?((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\]?(?:\s+(.*))?$/;
  for (const [index, raw] of String(text).replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(marker);
    if (match) {
      const start = round(parseTime(match[1]));
      if (!Number.isFinite(start)) { problems.push(`Line ${index+1}: invalid timestamp.`); continue; }
      const previous = segments.at(-1);
      if (previous && start < previous.start) { problems.push(`Line ${index+1}: timestamps must be in chronological order.`); continue; }
      if (previous && start === previous.start) { previous.text = clean(previous.text+' '+(match[2] || '')); continue; }
      segments.push({id:uid(),start,text:clean(match[2] || ''),timingEstimated:true});
    } else if (/^\[?\d+:/.test(line)) {
      problems.push(`Line ${index+1}: invalid timestamp.`);
    } else if (segments.length) {
      segments.at(-1).text = clean(segments.at(-1).text+' '+line);
    }
  }
  for (let i=0;i<segments.length;i++) segments[i].end = segments[i+1]?.start ?? round(segments[i].start+3);
  return {segments,problems,warnings:segments.length?['This transcript contains start times only. Caption ends use the next timestamp and may include pauses. The final caption is estimated at 3 seconds; review its end time.']:[]};
}
export function parseTranscript(text, filename='') {
  const body = String(text || '').trim();
  if (!body) throw new Error('Paste or upload a timestamped transcript.');
  const hint = filename.toLowerCase();
  if (hint.endsWith('.json') || /^[\[{]/.test(body) && !body.startsWith('[Music]')) {
    try { return {...parseJSON(body),format:'JSON'}; } catch(e) { if (hint.endsWith('.json')) throw e; }
  }
  if (hint.endsWith('.vtt') || body.startsWith('WEBVTT')) return {...parseVTT(body),format:'WebVTT'};
  if (!body.includes('-->') && /^(?:\[)?(?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\]?(?:\s|$)/m.test(body)) return {...parseTimestampedText(body),format:'Timestamped text'};
  return {...parseSRT(body),format:'SRT'};
}
export function validateSegments(segments, duration=null, offset=0) {
  const errors=[],warnings=[], valid=[];
  let prior=null, duplicates=0;
  const seen = new Set();
  for (const [i,s] of segments.entries()) {
    const a=Number(s.start)+offset,b=Number(s.end)+offset;
    if (!Number.isFinite(a)||!Number.isFinite(b)) { errors.push(`Segment ${i+1}: missing or invalid time.`);continue; }
    if (a<0 || b<0) { errors.push(`Segment ${i+1}: negative time after offset.`);continue; }
    if (b<=a) { errors.push(`Segment ${i+1}: end must be after start.`);continue; }
    if (!String(s.text || '').trim()) { warnings.push(`Segment ${i+1}: empty text ignored.`);continue; }
    if (duration && b>duration+.5) warnings.push(`Segment ${i+1}: extends beyond video duration.`);
    const key=`${round(a)}|${round(b)}|${clean(s.text).toLowerCase()}`;
    if (seen.has(key)) { duplicates++; continue; } seen.add(key);
    const item = {...s,start:round(a),end:round(b)};
    if (s.words) {
      item.words=s.words.map(w=>({...w,start:round(Number(w.start)+offset),end:round(Number(w.end)+offset)}));
      if (item.words.some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<item.start-.1||w.end>item.end+.1||w.start>=w.end)) {
        warnings.push(`Segment ${i+1}: unusable word timing discarded.`);delete item.words;
      }
    }
    if (prior && a < prior.end-.05) warnings.push(`Segment ${i+1}: overlaps another caption; timings preserved.`);
    valid.push(item);prior=item;
  }
  if (duplicates) warnings.push(`${duplicates} exact duplicate caption(s) removed.`);
  if (!valid.length) errors.push('No usable spoken transcript segments were found.');
  valid.sort((a,b)=>a.start-b.start || a.end-b.end);
  return {segments:valid,errors,warnings};
}
export function isSpeech(text) {
  const x=String(text).trim();
  if (!x) return false;
  return !/^(?:\[[^\]]*\]|\([^)]*\)|♪[^♪]*♪|♫[^♫]*♫)(?:\s+(?:\[[^\]]*\]|\([^)]*\)))*$/i.test(x);
}
export function speechText(text) {
  return clean(String(text).replace(/\[(music|applause|laughter|laughing|cheering|silence|noise|sighs?)\]/gi,'').replace(/\((music|applause|laughter|cheering)\)/gi,''));
}
export const TARGETS = {short:[2,4],balanced:[4,8],long:[8,15]};
export function groupPhrases(segments, mode='balanced') {
  const [min,max]=TARGETS[mode] || TARGETS.balanced;
  const source=segments.filter(s=>isSpeech(s.text) && speechText(s.text));
  const output=[];let group=[],groupEnd=0;
  const flush=()=>{
    if (!group.length) return;
    const first=group[0];
    const words=group.every(s=>Array.isArray(s.words)) ? group.flatMap(s=>s.words) : undefined;
    output.push({id:uid(),start:first.start,end:groupEnd,text:group.map(s=>speechText(s.text)).join(' ').replace(/\s+/g,' ').trim(),speaker:group.every(s=>s.speaker===first.speaker)?first.speaker:undefined,segmentIds:group.map(s=>s.id),...(words?{words}:{})});
    group=[];groupEnd=0;
  };
  for (const seg of source) {
    if (group.length) {
      const prior=group.at(-1),gap=seg.start-groupEnd;
      const elapsed=Math.max(groupEnd,seg.end)-group[0].start;
      const previousEnd=/[.!?]["'”’]?\s*$/.test(prior.text);
      const punctuation=/[,;:]["'”’]?\s*$/.test(prior.text);
      const speakerChange=seg.speaker && prior.speaker && seg.speaker!==prior.speaker;
      if (speakerChange || gap>.7 || (previousEnd && groupEnd-group[0].start>=min*.55) || (punctuation && elapsed>=min && gap>.18) || elapsed>max*1.35) flush();
    }
    group.push(seg);groupEnd=Math.max(groupEnd,seg.end);
    const duration=groupEnd-group[0].start;
    if (duration>=max || (duration>=min && /[.!?]["'”’]?\s*$/.test(seg.text))) flush();
  }
  flush();return output;
}
export function splitPhrase(phrase, splitWordIndex, splitTime) {
  const tokens=phrase.text.trim().split(/\s+/);
  if (splitWordIndex<=0||splitWordIndex>=tokens.length) throw new Error('Choose a word boundary inside the phrase.');
  const wordBoundary=phrase.words?.[splitWordIndex]?.start;
  const time=Number.isFinite(splitTime)?splitTime:wordBoundary;
  if (!Number.isFinite(time)||time<=phrase.start+.05||time>=phrase.end-.05) throw new Error('Choose a valid split time between phrase start and end.');
  return [
    {...phrase,id:uid(),end:round(time),text:tokens.slice(0,splitWordIndex).join(' '),words:phrase.words?.slice(0,splitWordIndex)},
    {...phrase,id:uid(),start:round(time),text:tokens.slice(splitWordIndex).join(' '),words:phrase.words?.slice(splitWordIndex)}
  ];
}
export function mergePhrases(a,b) {
  if (b.start<a.start) throw new Error('Phrases must be in chronological order.');
  return {...a,id:uid(),start:a.start,end:Math.max(a.end,b.end),text:`${a.text} ${b.text}`.trim(),speaker:a.speaker===b.speaker?a.speaker:undefined,segmentIds:[...new Set([...(a.segmentIds||[]),...(b.segmentIds||[])])],words:a.words&&b.words?[...a.words,...b.words]:undefined};
}
const tokens = s => new Set(String(s||'').toLowerCase().replace(/[^a-z0-9' ]/g,'').split(/\s+/).filter(Boolean));
export function remapStatuses(oldPhrases,newPhrases,statuses={}) {
  const mapped={}, uncertain=[];
  for(const n of newPhrases){
    const overlaps=oldPhrases.map(o=>{
      const intersection=Math.max(0,Math.min(o.end,n.end)-Math.max(o.start,n.start));
      const union=Math.max(o.end,n.end)-Math.min(o.start,n.start);
      const ta=tokens(o.text),tb=tokens(n.text);
      const textScore=ta.size&&tb.size?[...ta].filter(w=>tb.has(w)).length / new Set([...ta,...tb]).size:0;
      return {o,score:.65*(intersection/Math.max(.01,union))+.35*textScore,inter:intersection};
    }).filter(x=>x.inter>.1).sort((x,y)=>y.score-x.score);
    const match=overlaps[0];
    const old=match && statuses[match.o.id];
    if(match&&old&&match.score>.86) mapped[n.id]={...old};
    else if(match) {
      const sources=overlaps.filter(x=>x.inter>Math.min(1,(n.end-n.start)*.15));
      mapped[n.id]={practised:sources.length>0 && sources.every(x=>statuses[x.o.id]?.practised && x.inter / Math.max(.01,x.o.end-x.o.start) > .84),difficult:sources.some(x=>statuses[x.o.id]?.difficult)};
      if(sources.some(x=>statuses[x.o.id]?.practised||statuses[x.o.id]?.difficult)) uncertain.push(n.id);
    }
  }
  return {statuses:mapped,uncertain};
}
export function selectedPhrases(phrases,statuses={},selection='all',speakers=[],range=null) {
  return phrases.filter((p,i)=>{
    if(speakers.length&&!speakers.includes(p.speaker)) return false;
    if(selection==='difficult'&&!statuses[p.id]?.difficult) return false;
    if(selection==='practised'&&!statuses[p.id]?.practised) return false;
    if(selection==='range'&&range&&(i+1<range[0]||i+1>range[1])) return false;
    return true;
  });
}
export function speakingPause(phrase,config={}) {
  const p=config.overrides?.[phrase.id];
  if(Number.isFinite(p)) return Math.max(.5,Math.min(60,p));
  const val=config.pauseType==='duration'?(phrase.end-phrase.start)*(config.multiplier||1.5):(config.fixedPause||4);
  return Math.max(.8,Math.min(45,val));
}
export function addCoverage(intervals,a,b){
  const all=[...intervals,[a,b]].filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&y>x).sort((x,y)=>x[0]-y[0]);
  const result=[];for(const cur of all){ const last=result.at(-1);if(last&&cur[0]<=last[1]+.06)last[1]=Math.max(last[1],cur[1]);else result.push([...cur]); }return result;
}
export function urlToVideoId(value) {
  try {
    const u=new URL(String(value).trim());let id='';
    if(['youtu.be','www.youtu.be'].includes(u.hostname)) id=u.pathname.split('/').filter(Boolean)[0];
    else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(u.hostname)) {
      const path=u.pathname.split('/').filter(Boolean);
      id=path[0]==='watch'?u.searchParams.get('v'):['shorts','embed','live','v'].includes(path[0])?path[1]:'';
    }
    if (!/^[\w-]{11}$/.test(id||'')) throw Error();return id;
  } catch { throw new Error('Enter a valid YouTube watch, Shorts, embed or youtu.be link.'); }
}

/** Highlight only real supplied word intervals that map to the displayed text. */
const wordMaps=new WeakMap();
export function activeWordIndices(phrase,time){
  if(!phrase?.words?.length||!Number.isFinite(time))return [];
  let cached=wordMaps.get(phrase);
  if(!cached||cached.text!==phrase.text||cached.words!==phrase.words){
    const normal=t=>t.toLowerCase().replace(/[’‘]/g,"'").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,''),display=phrase.text.trim().split(/\s+/).map(normal),mapping=[];let cursor=0,valid=true;
    for(const word of phrase.words){const tokens=String(word.text||'').trim().split(/\s+/).map(normal),indices=[];for(const token of tokens){if(!token||token!==display[cursor])valid=false;indices.push(cursor++);}if(!Number.isFinite(word.start)||!Number.isFinite(word.end)||word.end<=word.start)valid=false;mapping.push(indices);}
    cached={text:phrase.text,words:phrase.words,mapping:valid&&cursor===display.length?mapping:[]};wordMaps.set(phrase,cached);
  }
  return phrase.words.flatMap((word,index)=>time>=word.start&&time<word.end?cached.mapping[index]||[]:[]);
}
