import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerEngine} from '../src/player.mjs';
function fixture(t,mode='manual'){
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:10000});
 const p=new PlayerEngine();
 p.load({id:'alignment',videoId:'iG9CE55wbtY',phrases:[{id:'a',start:1,end:2,text:'First complete sentence.'},{id:'b',start:4,end:5,text:'Second complete sentence.'},{id:'c',start:8,end:9,text:'Third complete sentence.'}],statuses:{},progress:{position:1,phraseId:'a',coverage:[]}},{mode,leadIn:0});
 const m={time:1,state:2,pending:null,seekTo(t){this.pending=t;},playVideo(){this.state=1;p.handleYTState(1);},pauseVideo(){this.state=2;p.handleYTState(2);},getCurrentTime(){return this.time;},getPlayerState(){return this.state;},getDuration(){return 12;},destroy(){}};
 p.yt=m;p.ready=true;t.after(()=>p.destroy());return {p,m};
}
test('backward replay waits for the requested media clock, rather than ending at the old position',t=>{
 const {p,m}=fixture(t);m.time=8.7;p.seekPhrase('a',true);p.tick();assert.equal(p.current().id,'a');assert.equal(p.phraseDone,false);assert.equal(p.playing,true);assert.equal(p.time,1);assert.deepEqual(p.lesson.progress.coverage,[]);
 m.time=1.04;p.tick();assert.equal(p.current().id,'a');assert.equal(p.playing,true);m.time=2;p.tick();assert.equal(p.phraseDone,true);
});
test('continuous Next keeps the requested text while the media is still at the old cue',t=>{
 const {p,m}=fixture(t,'continuous');p.seekPhrase('c',true);p.tick();assert.equal(p.current().id,'c');assert.equal(p.time,8);m.time=8.05;p.tick();assert.equal(p.current().id,'c');
});
test('native scrubbing while paused reconciles the phrase before playback',t=>{
 const {p,m}=fixture(t);m.time=8.4;p.tick();assert.equal(p.current().id,'c');p.play();p.tick();assert.equal(p.playing,true);assert.equal(p.phraseDone,false);
});
test('pausing just before a cue end resumes its remaining audio without replay',t=>{
 const {p,m}=fixture(t);p.time=1.95;m.time=1.95;p.play();assert.equal(m.pending,null);assert.equal(p.playing,true);
});
test('replaced pending seeks ignore intermediate clocks and delayed ended callbacks',t=>{
 const {p,m}=fixture(t);p.seekPhrase('b',true);p.seekPhrase('c',true);m.time=4;p.tick();p.handleYTState(0);assert.equal(p.current().id,'c');assert.equal(p.phraseDone,false);assert.notEqual(p.state,'ended');m.time=8.1;p.tick();assert.equal(p.playing,true);
});
test('a seek timeout fails clearly and late media cannot resume without another Play',t=>{
 const {p,m}=fixture(t);p.seekPhrase('c',true);t.mock.timers.tick(8001);p.tick();assert.equal(p.state,'error');assert.match(p.error,/did not reach/);assert.equal(p.playing,false);m.time=8;p.handleYTState(1);assert.equal(m.state,2);assert.equal(p.playing,false);p.play();assert.equal(p.playing,true);assert.equal(p.failedSeek,null);
});
test('Pause during a delayed seek remains paused after a queued playing callback',t=>{
 const {p,m}=fixture(t);p.seekPhrase('c',true);p.pause();m.time=8;p.handleYTState(1);p.tick();assert.equal(p.playing,false);assert.equal(m.state,2);assert.equal(p.current().id,'c');
});
test('a new shadowing lesson starts at its first phrase instead of playing a long unrelated introduction',t=>{
 const {p,m}=fixture(t);p.ready=false;p.load({...p.lesson,phrases:[{id:'late',start:27,end:29,text:'The chosen words.'}],progress:{position:0,phraseId:'late',coverage:[]}},{mode:'manual',leadIn:.5});assert.equal(p.time,26.5);assert.equal(p.current().id,'late');
});
test('trimmed recordings cannot silently clamp an unavailable phrase to unrelated audio',t=>{
 const {p,m}=fixture(t);m.getTimeBounds=()=>({start:4,end:7});p.seekPhrase('a',true);assert.equal(m.pending,null);assert.equal(p.state,'error');assert.match(p.error,/outside the uploaded audio/);assert.equal(p.playing,false);
});
test('native seeking must finish before the destination clock can complete a phrase',t=>{
 const {p,m}=fixture(t);let seeking=true;m.isSeeking=()=>seeking;p.seekPhrase('c',true);m.time=8;p.tick();assert.ok(p.pendingSeek);seeking=false;p.tick();assert.equal(p.pendingSeek,null);assert.equal(p.current().id,'c');
});
test('recording seeks and edit previews explicitly request playback during asynchronous seeking',t=>{
 const {p,m}=fixture(t);p.seekRecording(4,true);assert.equal(p.wantsPlayback,true);assert.equal(m.state,1);m.time=4;p.tick();p.pause();p.previewRange(8,8.8);assert.equal(p.wantsPlayback,true);assert.equal(m.state,1);m.time=8;p.tick();assert.equal(p.playing,true);
});
test('lead-in before a trimmed recording clamps the seek target, not the transcript timestamps',t=>{
 const {p,m}=fixture(t);m.getTimeBounds=()=>({start:3.8,end:12});p.leadIn=1;p.seekPhrase('b',true);assert.equal(m.pending,3.8);assert.equal(p.pendingSeek.target,3.8);assert.equal(p.current().start,4);m.time=3.8;p.tick();assert.equal(p.pendingSeek,null);assert.equal(p.current().id,'b');assert.equal(p.playing,true);
});
test('native playing callback retains the selected adjacent phrase during lead-in',t=>{
 const {p,m}=fixture(t);p.lesson.phrases=[{id:'a',start:0,end:1.52,text:'First line'},{id:'b',start:1.52,end:3.32,text:'Second line'}];p.phrase=p.lesson.phrases[0];p.leadIn=.5;m.time=1.52;p.seekPhrase('b',false);m.time=1.02;p.tick();assert.equal(p.pendingSeek,null);m.time=1.15;m.state=1;p.handleYTState(1);assert.equal(p.current().id,'b');m.time=3.32;p.tick();assert.equal(p.phraseDone,true);assert.equal(p.current().id,'b');
});
test('paused lead-in clock drift cannot switch to the previous phrase',t=>{
 const {p,m}=fixture(t);p.lesson.phrases=[{id:'a',start:0,end:1.52,text:'First line'},{id:'b',start:1.52,end:3.32,text:'Second line'}];p.leadIn=.5;p.seekPhrase('b',false);m.time=1.02;p.tick();m.time=1.04;p.tick();assert.equal(p.current().id,'b');
});
