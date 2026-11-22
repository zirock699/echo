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
