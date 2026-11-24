import test from 'node:test';import assert from 'node:assert/strict';
import {transportState,swipeDirection} from '../src/practice.mjs';
test('the single primary transport switches Play, Pause and Replay',()=>{
 assert.equal(transportState({state:'ready'}).label,'Play');
 assert.equal(transportState({state:'playing',playing:true}).label,'Pause');
 assert.equal(transportState({state:'paused',phraseDone:true}).label,'Replay');
 assert.equal(transportState({state:'buffering'}).label,'Pause');
});
test('mobile gestures require a deliberate horizontal swipe and never apply to desktop',()=>{
 const start={x:200,y:100};assert.equal(swipeDirection(start,{x:100,y:110},390),'next');assert.equal(swipeDirection(start,{x:300,y:100},390),'previous');
 assert.equal(swipeDirection(start,{x:180,y:100},390),null);assert.equal(swipeDirection(start,{x:100,y:250},390),null);assert.equal(swipeDirection(start,{x:100,y:100},1440),null);
});

test('surrounding transcript follows the eligible queue at both ends without duplicates',async()=>{
 const {phraseNeighbours}=await import('../src/practice.mjs');
 const phrases=Array.from({length:7},(_,i)=>({id:'p'+i,text:'Phrase '+i}));
 assert.deepEqual(phraseNeighbours(phrases,'p3'),{before:phrases.slice(1,3),after:phrases.slice(4,6)});
 assert.deepEqual(phraseNeighbours(phrases,'p0'),{before:[],after:phrases.slice(1,3)});
 assert.deepEqual(phraseNeighbours(phrases,'p6'),{before:phrases.slice(4,6),after:[]});
 assert.deepEqual(phraseNeighbours(phrases.filter((_,i)=>i%2===0),'p4'),{before:[phrases[0],phrases[2]],after:[phrases[6]]});
 assert.deepEqual(phraseNeighbours(phrases,'missing'),{before:[],after:[]});
});
