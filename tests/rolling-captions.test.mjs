import test from 'node:test';import assert from 'node:assert/strict';
import {parseSRT,parseTranscript,validateSegments,groupPhrases} from '../src/transcript.mjs';
import {repairRollingCaptionLessons} from '../src/import-transcript.mjs';
import {Store} from '../src/store.mjs';
const source=`1
00:00:00,160 --> 00:00:02,000
 
First spoken line

2
00:00:02,000 --> 00:00:02,010
First spoken line
 

3
00:00:02,010 --> 00:00:04,000
First spoken line
Second spoken line

4
00:00:04,000 --> 00:00:04,010
Second spoken line
 

5
00:00:04,010 --> 00:00:06,000
Second spoken line
Third spoken line

6
00:00:06,000 --> 00:00:06,010
Third spoken line
 
`;
function damaged(){const segments=parseSRT(source).segments.slice(1);return {source,format:'SRT',offset:0,segments,phrases:groupPhrases(segments,'original'),grouping:'original',revisions:[],statuses:{},audio:{id:'keep'},progress:{position:3,coverage:[[1,2]]}};}
test('blank display lines do not discard spoken captions',()=>{const p=parseSRT(source);assert.equal(p.segments[0].text,'First spoken line');assert.equal(p.segments[0].start,.16);assert.deepEqual(p.problems,[]);});
test('rolling transitions extend speech without repeating display context',()=>{const p=parseTranscript(source);assert.equal(p.rollingCaptions,true);assert.deepEqual(p.segments.map(p=>[p.start,p.end,p.text]),[[.16,2.01,'First spoken line'],[2.01,4.01,'Second spoken line'],[4.01,6.01,'Third spoken line']]);assert.deepEqual(validateSegments(p.segments).errors,[]);});
test('normal repeated speech is retained',()=>{const p=parseTranscript('1\n00:00:00,000 --> 00:00:01,000\nHello\n\n2\n00:00:01,000 --> 00:00:02,000\nHello');assert.equal(p.rollingCaptions,false);assert.equal(p.segments.length,2);});
test('saved generated cues repair once with Undo and preserved source/media/progress',()=>{const l=damaged(),old=structuredClone(l);l.statuses[l.phrases[1].id]={practised:true,difficult:true};assert.equal(repairRollingCaptionLessons({lessons:[l]}),true);assert.equal(l.phrases.length,3);assert.equal(l.source,old.source);assert.deepEqual(l.audio,old.audio);assert.deepEqual(l.progress.coverage,old.progress.coverage);assert.equal(l.progress.position,3);assert.equal(l.progress.phraseId,l.phrases[1].id);assert.deepEqual(l.revisions[0].phrases,old.phrases);assert.equal(repairRollingCaptionLessons({lessons:[l]}),false);});
test('deliberate revisions and edited phrases remain unchanged',()=>{for(const edit of [l=>l.revisions.push({phrases:[]}),l=>l.phrases[0].text='My edit']){const l=damaged();edit(l);const before=structuredClone(l);assert.equal(repairRollingCaptionLessons({lessons:[l]}),false);assert.deepEqual(l,before);}});
test('store schedules repaired data for sync without changing chosen mode',()=>{const store=new Store();store.data.lessons=[{...damaged(),originalPlaybackVersion:1}];store.data.preferences.mode='manual';store.migrate();clearTimeout(store.timer);assert.equal(store.pending,true);assert.equal(store.data.preferences.mode,'manual');const seq=store.seq;store.migrate();clearTimeout(store.timer);assert.equal(store.seq,seq);});
