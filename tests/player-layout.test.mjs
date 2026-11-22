import test from 'node:test';import assert from 'node:assert/strict';
import {playbackFeedback,fitTextSize} from '../src/player-layout.mjs';
test('busy playback does not create visible message rows',()=>{for(const state of ['loading','buffering']){const f=playbackFeedback(state);assert.equal(f.busy,true);assert.equal(f.visible,false);assert.ok(f.label);}});
test('failures have concise feedback',()=>{for(const state of ['blocked','stalled','error']){const f=playbackFeedback(state);assert.equal(f.visible,true);assert.ok(f.label.length<=30);}});
test('text fitting selects the largest readable size',()=>{const o={maximum:42,minimum:18,available:100,measure:x=>x*4};const size=fitTextSize(o);assert.ok(size<=25&&size>24.75);assert.equal(fitTextSize({...o,available:300}),42);assert.equal(fitTextSize({...o,available:30}),18);});
