import test from 'node:test';
import assert from 'node:assert/strict';
import {rgbToHsl,refinePalette,validPalette,prepareAmbient} from '../src/ambient.mjs';
test('thumbnail colours become dark tones with bounded saturation',()=>{
 assert.deepEqual(rgbToHsl([255,0,0]),[0,1,.5]);
 const warm=refinePalette([[255,0,0],[255,255,255],[0,0,0]],'warm');assert.equal(warm.primary,'hsl(0 60% 24%)');assert.match(warm.secondary,/22%\)$/);
 assert.equal(refinePalette([[0,0,255]],'cool').primary,'hsl(240 60% 24%)');
});
test('neutral or missing thumbnails get deterministic lesson-specific fallbacks',()=>{
 assert.deepEqual(refinePalette([],'lesson'),refinePalette([[255,255,255]],'lesson'));assert.notDeepEqual(refinePalette([],'lesson'),refinePalette([],'another'));
});
test('cached palette accepts only bounded hex colours for the same video and version',()=>{
 const p={version:1,videoId:'video',colours:['#ff0000']};assert.equal(validPalette(p,'video'),true);assert.equal(validPalette(p,'other'),false);assert.equal(validPalette({...p,colours:['url(x)']},'video'),false);assert.equal(validPalette({...p,colours:Array(10).fill('#ffffff')},'video'),false);
});
test('failed extraction persists a fallback and reopening reuses it',async()=>{
 let requests=0;globalThis.Image=class{set src(value){requests++;queueMicrotask(()=>this.onerror());}};
 const lesson={videoId:'test',thumbnail:{url:'/api/audio/00000000-0000-4000-8000-000000000001'}};await prepareAmbient(lesson,p=>{lesson.ambientPalette=p;});assert.equal(lesson.ambientPalette.source,'fallback');assert.equal(requests,1);await prepareAmbient(lesson,()=>assert.fail('Must reuse cache'));assert.equal(requests,1);delete globalThis.Image;
});
