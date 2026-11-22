import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTranscript,validateSegments,groupPhrases} from '../src/transcript.mjs';

test('Tactiq headers, start times and non-speech boundaries',()=>{
 const result=parseTranscript('# tactiq.io transcript\n# Title\n# https://youtube.com/watch?v=example\n\n00:00:27.103 Good morning.\n00:00:29.702 (Laughter)\n00:00:31.129 Welcome back.','transcript.txt');
 assert.equal(result.format,'Timestamped text');
 assert.deepEqual(result.problems,[]);
 assert.equal(result.segments[0].start,27.103);
 assert.equal(result.segments[0].end,29.702);
 assert.equal(result.segments[2].end,34.129);
 assert.ok(result.warnings[0].includes('estimated'));
 const validated=validateSegments(result.segments);
 assert.deepEqual(validated.errors,[]);
 assert.ok(groupPhrases(validated.segments).every(x=>!x.text.includes('Laughter')));
});
test('pasted text accepts short timestamps, brackets and wrapped captions',()=>{
 const result=parseTranscript('[00:01] Hello\nthere\n\n[00:03.500] Goodbye');
 assert.equal(result.segments[0].text,'Hello there');
 assert.equal(result.segments[0].end,3.5);
 assert.equal(result.segments[1].end,6.5);
});
test('equal starts combine; decreasing and malformed timestamps are reported',()=>{
 const result=parseTranscript('00:02 First\n00:02 continuation\n00:01 Out of order\n00:99 Invalid\n00:04 Last');
 assert.equal(result.segments[0].text,'First continuation');
 assert.equal(result.segments[0].end,4);
 assert.equal(result.problems.length,2);
});
test('SRT, WebVTT and JSON retain explicit ends',()=>{
 for(const text of ['1\n00:00:01,000 --> 00:00:02,000\nHello','WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello','[{"start":1,"end":2,"text":"Hello"}]']){
  const result=parseTranscript(text);
  assert.equal(result.segments[0].end,2);
  assert.equal(result.segments[0].timingEstimated,undefined);
 }
});
