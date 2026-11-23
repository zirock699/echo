import test from 'node:test';import assert from 'node:assert/strict';
import {PlayerEngine} from '../src/player.mjs';import {transportState} from '../src/practice.mjs';
class Media {
 constructor(){this.events=new Map();this.readyState=1;this.currentTime=0;this.duration=8;this.playbackRate=1;}
 addEventListener(n,f){this.events.set(n,[...(this.events.get(n)||[]),f]);}removeEventListener(n,f){this.events.set(n,(this.events.get(n)||[]).filter(x=>x!==f));}
 emit(n){for(const f of this.events.get(n)||[])f();}load(){if(this.src)queueMicrotask(()=>this.emit('loadedmetadata'));}play(){this.emit('playing');return Promise.resolve();}pause(){this.emit('pause');}removeAttribute(n){if(n==='src')this.src='';}
}
test('uploaded audio drives Play, Replay and Next through the same phrase controller',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});globalThis.Audio=Media;
 globalThis.document={querySelector:()=>({replaceChildren(){},append(){}}),createElement:()=>({})};
 const id='00000000-0000-4000-8000-000000000001';
 const lesson={id:'native',videoId:'iG9CE55wbtY',audio:{id,url:'/api/audio/'+id},mediaSource:'audio',phrases:[{id:'a',start:.1,end:1.2,text:'First phrase.'},{id:'b',start:2,end:3.2,text:'Second phrase.'}],progress:{position:.1,phraseId:'a',coverage:[]},statuses:{}};
 const p=new PlayerEngine();t.after(()=>p.destroy());p.load(lesson,{mode:'manual',leadIn:0,speed:1});await p.initialise();
 assert.equal(p.ready,true);assert.equal(transportState(p).label,'Play');p.play();assert.equal(transportState(p).label,'Pause');
 p.yt.audio.currentTime=1.21;p.tick();assert.equal(p.playing,false);assert.equal(transportState(p).label,'Replay');
 const marks=[];p.onPractised=id=>marks.push(id);p.next();assert.deepEqual(marks,['a']);assert.equal(p.phrase.id,'b');assert.equal(p.playing,true);assert.equal(p.yt.audio.currentTime,2);
 p.replay();assert.deepEqual(marks,['a']);assert.equal(p.yt.audio.currentTime,2);
 const audio=p.yt;lesson.mediaSource='youtube';p.load(lesson,{});assert.equal(audio.destroyed,true);assert.equal(p.ready,false);assert.equal(p.mediaIdentity,'youtube:iG9CE55wbtY');
});
