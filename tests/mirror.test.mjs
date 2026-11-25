import test from 'node:test';
import assert from 'node:assert/strict';
import {peaks,rotateAttempts,sameSegment,EchoMirror} from '../src/mirror.mjs';
test('waveform keeps leading silence and does not align or stretch samples',()=>{const result=peaks(new Float32Array([0,0,.3,.6]),0,4,4);assert.deepEqual(result.slice(0,2),[0,0]);assert.ok(Math.abs(result[2]-.5)<.001);assert.equal(result[3],1);});
test('waveform bounds, silence and per-track normalisation are finite',()=>{assert.deepEqual(peaks(new Float32Array([0,0]),0,2,2),[0,0]);assert.deepEqual(peaks(new Float32Array([.1,.2]),0,2,2),[.5,1]);assert.equal(peaks(new Float32Array([1,0,0,1]),1,3,2).every(x=>x===0),true);});
test('successful attempt keeps only latest and previous',()=>{const a={id:'a'},b={id:'b'},c={id:'c'};assert.deepEqual(rotateAttempts([b,a],c),[c,b]);});
test('saved attempts detect edited timing and replaced audio',()=>{const l={id:'l',audio:{id:'asset'},audioOffset:-1},p={id:'p',start:4,end:6},a={lessonId:'l',phraseId:'p',audioId:'asset',offset:-1,start:4,end:6};assert.equal(sameSegment(a,l,p),true);assert.equal(sameSegment(a,l,{...p,start:3}),false);assert.equal(sameSegment(a,{...l,audio:{id:'new'}},p),false);});
test('delayed microphone permission is safely discarded after cancellation',async()=>{let resolvePermission,stopped=0;const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldRecorder=globalThis.MediaRecorder;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{resolvePermission=resolve;})}}});globalThis.MediaRecorder=class{};const m=new EchoMirror({notify(){},tick(){},pause(){},restore(){}});try{m.enter({id:'l',audio:{id:'a',url:'/audio'}},{id:'p',start:1,end:2},12);const request=m.record();assert.equal(m.phase,'permission');m.interrupt();resolvePermission({getTracks:()=>[{stop(){stopped++;}}]});await request;assert.equal(stopped,1);assert.equal(m.phase,'idle');assert.equal(m.list.length,0);}finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;globalThis.MediaRecorder=oldRecorder;}});
test('exiting restores entry position and never resumes playback',()=>{let position=null,paused=0;const m=new EchoMirror({notify(){},tick(){},pause(){paused++;},restore:t=>{position=t;}});m.enter({id:'l',audio:{id:'a'}},{id:'p',start:1,end:3},17);m.panelOpen=true;m.exit();assert.equal(position,17);assert.equal(m.active,false);assert.equal(m.panelOpen,false);assert.equal(paused,1);});
test('unsupported microphone retains previous attempt and provides recovery',async()=>{const old=globalThis.MediaRecorder;globalThis.MediaRecorder=undefined;try{const m=new EchoMirror({notify(){},tick(){},pause(){},restore(){}});m.enter({id:'l',audio:{id:'a'}},{id:'p',start:1,end:3},0);m.attempts.set(m.key,[{id:'previous'}]);await m.record();assert.equal(m.list[0].id,'previous');assert.match(m.error,/supported browser/);}finally{globalThis.MediaRecorder=old;}});

test('microphone permission denial opens recoverable guidance without replacing attempts',async()=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldRecorder=globalThis.MediaRecorder;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{throw Object.assign(Error('Denied'),{name:'NotAllowedError'});}}}});globalThis.MediaRecorder=class{};try{const m=new EchoMirror({notify(){},tick(){},pause(){},restore(){}});m.enter({id:'l',audio:{id:'a'}},{id:'p',start:0,end:1},0);m.attempts.set(m.key,[{id:'old'}]);await m.record();assert.equal(m.permissionOpen,true);assert.equal(m.permissionKind,'denied');assert.equal(m.list[0].id,'old');assert.match(m.panel(),/Try again/);assert.match(m.error,/site permissions/);}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;globalThis.MediaRecorder=oldRecorder;}});
test('audio autoplay blocking after microphone grant is not misreported as microphone denial',async()=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldRecorder=globalThis.MediaRecorder;let requests=0,captures=0;const stream={getTracks:()=>[{stop(){}}],getAudioTracks:()=>[{}]};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{requests++;return stream;}}}});globalThis.MediaRecorder=class{};try{const m=new EchoMirror({notify(){},tick(){},pause(){},restore(){}});m.enter({id:'l',audio:{id:'a'}},{id:'p',start:0,end:1},0);m.originalSegment=async()=>{throw Object.assign(Error('Playback blocked'),{name:'NotAllowedError'});};await m.record();assert.equal(m.phase,'awaiting-play');assert.equal(m.stream,stream);assert.equal(m.permissionKind,'playback');m.originalSegment=async()=>{};m.capture=()=>{captures++;};await m.continueRecording();assert.equal(captures,1);assert.equal(requests,1);m.interrupt();}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;globalThis.MediaRecorder=oldRecorder;}});

function originalFixture(t, {start = .8, end = 1.7, offset = 0, duration = 2, metadata = true} = {}) {
  t.mock.timers.enable({apis: ['setInterval', 'setTimeout', 'Date']});
  let audio, captures = 0, stopped = 0, permission = 0;
  const track = {stop() { stopped++; }};
  const stream = {getTracks: () => [track], getAudioTracks: () => [track]};
  class Media extends EventTarget {
    constructor(url) {
      super();
      this.src = new URL(url, 'https://echo.test').href;
      this.paused = true;
      this.ended = false;
      this.seeking = false;
      this.readyState = metadata ? 1 : 0;
      this.duration = metadata ? duration : NaN;
      this.position = 0;
      this.plays = 0;
      audio = this;
    }
    get currentTime() { return this.position; }
    set currentTime(time) { this.target = time; this.seeking = true; }
    loadMetadata() {
      this.readyState = 1;
      this.duration = duration;
      this.dispatchEvent(new Event('loadedmetadata'));
    }
    seekTo(time = this.target) {
      this.position = time;
      this.seeking = false;
      this.dispatchEvent(new Event('seeked'));
    }
    play() { this.plays++; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    finish(time) {
      this.position = time;
      this.paused = true;
      this.ended = true;
      this.dispatchEvent(new Event('ended'));
    }
  }
  for (const [name, value] of Object.entries({navigator: {mediaDevices: {getUserMedia: async () => { permission++; return stream; }}},
    Audio: Media, location: {href: 'https://echo.test/'}, MediaRecorder: class {}})) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {configurable: true, value});
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  const mirror = new EchoMirror({notify(){}, tick(){}, pause(){}, restore(){}});
  mirror.enter({id: 'lesson', audio: {id: 'asset', url: '/audio'}, audioOffset: offset}, {id: 'phrase', start, end}, 0);
  mirror.capture = () => { captures++; };
  return {mirror, get audio(){ return audio; }, get captures(){ return captures; }, get stopped(){ return stopped; }, get permission(){ return permission; }};
}

const turn = () => new Promise(setImmediate);

test('Mirror waits for actual metadata and rejects a phrase clipped by the end of the audio', async t => {
  const f = originalFixture(t, {start: 1.6, end: 2.8, metadata: false});
  const attempt = f.mirror.record();
  await turn();
  assert.equal(f.permission, 1);
  assert.equal(f.audio.plays, 0);
  f.audio.loadMetadata();
  await attempt;
  assert.equal(f.audio.plays, 0);
  assert.equal(f.captures, 0);
  assert.equal(f.stopped, 1);
  assert.match(f.mirror.error, /outside the available audio/);
});

test('Mirror rejects a beginning clipped by a negative audio offset', async t => {
  const f = originalFixture(t, {start: .3, end: 1, offset: -.6});
  await f.mirror.record();
  assert.equal(f.audio.plays, 0);
  assert.equal(f.captures, 0);
  assert.equal(f.stopped, 1);
  assert.match(f.mirror.error, /timing offset/);
});

test('Mirror refuses early EOF after audible clock advancement', async t => {
  const f = originalFixture(t);
  const attempt = f.mirror.record();
  await turn();
  f.audio.seekTo();
  f.audio.position = 1.2;
  t.mock.timers.tick(20);
  f.audio.finish(1.3);
  await attempt;
  assert.equal(f.captures, 0);
  assert.equal(f.stopped, 1);
  assert.match(f.mirror.error, /ended before the phrase finished/);
});

test('Mirror does not record if a seek settles at the wrong recording position', async t => {
  const f = originalFixture(t);
  const attempt = f.mirror.record();
  await turn();
  f.audio.seekTo(1.5);
  await attempt;
  assert.equal(f.captures, 0);
  assert.equal(f.stopped, 1);
  assert.match(f.mirror.error, /did not reach the phrase start/);
});

test('Mirror times out an unfinished seek and releases the stream', async t => {
  const f = originalFixture(t);
  const attempt = f.mirror.record();
  await turn();
  t.mock.timers.tick(15000);
  await attempt;
  assert.equal(f.captures, 0);
  assert.equal(f.stopped, 1);
  assert.match(f.mirror.error, /did not reach the phrase start/);
});

test('Mirror does not record if the native decoder reports an error before the cue end', async t => {
  const f = originalFixture(t);
  const attempt = f.mirror.record();
  await turn();
  f.audio.seekTo();
  f.audio.error = {code: 3};
  f.audio.dispatchEvent(new Event('error'));
  await attempt;
  assert.equal(f.captures, 0);
  assert.equal(f.stopped, 1);
  assert.match(f.mirror.error, /Original audio playback failed/);
});

test('Mirror permits small edge rounding and records only after the valid original reaches EOF', async t => {
  const f = originalFixture(t, {start: .01, end: 2.05, offset: -.03});
  const attempt = f.mirror.record();
  await turn();
  assert.equal(f.audio.currentTime, 0);
  assert.equal(f.captures, 0);
  f.audio.position = 1.99;
  t.mock.timers.tick(20);
  assert.equal(f.captures, 0);
  f.audio.finish(1.997);
  await attempt;
  assert.equal(f.captures, 1);
  assert.equal(f.stopped, 0);
  f.mirror.interrupt();
  assert.equal(f.stopped, 1);
});

test('Mirror rejects a short cue with nearly all of its duration beyond the attachment', async t => {
  const f = originalFixture(t, {start: 1.999, end: 2.049});
  await f.mirror.record();
  assert.equal(f.audio.plays, 0);
  assert.equal(f.captures, 0);
  assert.equal(f.stopped, 1);
  assert.match(f.mirror.error, /outside the available audio/);
});

test('Mirror counts rounded EOF against the same combined allowance as the source edges', async t => {
  const f = originalFixture(t, {start: 0, end: 1.048, duration: 1});
  const attempt = f.mirror.record();
  await turn();
  assert.equal(f.audio.plays, 1);
  f.audio.position = .8;
  t.mock.timers.tick(20);
  f.audio.finish(.996);
  await attempt;
  assert.equal(f.captures, 0);
  assert.equal(f.stopped, 1);
  assert.match(f.mirror.error, /ended before the phrase finished/);
});
