import test from 'node:test';import assert from 'node:assert/strict';import {AudioAdapter} from '../src/audio.mjs';
class TestAudio{
 constructor(){this.listeners=new Map();this.readyState=1;this.currentTime=0;this.duration=20;this.playbackRate=1;}
 addEventListener(name,fn){this.listeners.set(name,[...(this.listeners.get(name)||[]),fn]);}
 removeEventListener(name,fn){this.listeners.set(name,(this.listeners.get(name)||[]).filter(x=>x!==fn));}
 emit(name){for(const fn of this.listeners.get(name)||[])fn();}
 load(){}pause(){this.emit('pause');}play(){this.emit('playing');return Promise.resolve();}removeAttribute(){}
}
test('native audio uses original transcript times with an offset and preserves controls',async()=>{
 const source=new TestAudio(),states=[];const a=new AudioAdapter({url:'/api/audio/test'},-10,{onStateChange:e=>states.push(e.data)},()=>source);
 source.emit('loadedmetadata');await a.ready;a.seekTo(12);assert.equal(source.currentTime,2);assert.equal(a.getCurrentTime(),12);assert.equal(a.getDuration(),30);
 a.playVideo();a.pauseVideo();assert.deepEqual(states,[1,2]);a.setPlaybackRate(.75);assert.equal(a.getPlaybackRate(),.75);assert.equal(source.preload,'auto');a.destroy();source.emit('playing');assert.deepEqual(states,[1,2]);
});
test('audio that needs metadata preserves a pending seek until ready',async()=>{
 const source=new TestAudio();source.readyState=0;const a=new AudioAdapter({url:'/api/audio/test'},0,{},()=>source);a.seekTo(4);assert.equal(a.getCurrentTime(),4);source.readyState=1;source.emit('loadedmetadata');await a.ready;assert.equal(source.currentTime,4);a.destroy();
});
