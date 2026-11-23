import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerEngine} from '../src/player.mjs';
import {parseTranscript,validateSegments,groupPhrases,activeWordIndices} from '../src/transcript.mjs';

function fixture(t,prefs={}){
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:10000});
 const lesson={id:'sync',videoId:'iG9CE55wbtY',phrases:[{id:'a',start:0,end:1,text:'First phrase.'},{id:'b',start:1,end:2,text:'Second phrase.'},{id:'c',start:4,end:6,text:'Third phrase.'}],statuses:{},progress:{position:0,phraseId:'a',coverage:[]}};
 const p=new PlayerEngine();p.load(lesson,{leadIn:0,...prefs});
 const media={time:0,state:2,pending:null,deferred:false,seekTo(time){if(this.deferred)this.pending=time;else this.time=time;},playVideo(){this.state=1;p.handleYTState(1);},pauseVideo(){this.state=2;p.handleYTState(2);},getCurrentTime(){return this.time;},getDuration(){return 20;},getPlayerState(){return this.state;},destroy(){}};
 p.yt=media;p.ready=true;p.state='ready';p.duration=20;t.after(()=>p.destroy());return {p,media,lesson};
}
test('edit preview uses its own end instead of the selected phrase boundary',t=>{const {p,media}=fixture(t);p.previewRange(.2,5);media.time=1.5;p.tick();assert.equal(p.playing,true);assert.equal(p.current().id,'b');media.time=5.01;p.tick();assert.equal(p.playing,false);});
test('phrase grouping cannot truncate a longer overlapping source cue',()=>{const segments=[{id:'a',start:0,end:10,text:'A longer caption without punctuation'},{id:'b',start:2,end:3,text:'overlapping words'}];const phrases=groupPhrases(segments,'long');assert.equal(phrases[0].end,10);});
test('manual caption import handles adjacent cues without blank separators',()=>{const source='1\n00:00:00,000 --> 00:00:01,000\nFirst phrase.\n2\n00:00:01,000 --> 00:00:02,000\nSecond phrase.';const result=validateSegments(parseTranscript(source).segments);assert.equal(result.segments.length,2);assert.equal(result.segments[0].text,'First phrase.');assert.equal(result.segments[1].start,1);});

test('a supplied multiword timing highlights its matching displayed tokens, not a later word',()=>{const phrase={text:'Visit New York today.',words:[{text:'Visit',start:0,end:1},{text:'New York',start:1,end:2},{text:'today',start:2,end:3}]};assert.deepEqual(activeWordIndices(phrase,1.5),[1,2]);assert.deepEqual(activeWordIndices(phrase,2.5),[3]);});
test('mismatched or incomplete word timing cannot highlight the wrong displayed word',()=>{const phrase={text:'Hello there.',words:[{text:'Hello',start:0,end:1},{text:'different',start:1,end:2}]};assert.deepEqual(activeWordIndices(phrase,1.5),[]);assert.deepEqual(activeWordIndices({...phrase,words:phrase.words.slice(0,1)},.5),[]);});
test('SRT and VTT preserve numeric speech, multiline text, settings and source timestamps',()=>{const srt='1\n00:01:02,125 --> 00:01:04,875\nThe year is\n2024\n\n2\n00:01:05,000 --> 00:01:06,500\n123';const cues=parseTranscript(srt).segments;assert.equal(cues[0].text,'The year is 2024');assert.equal(cues[1].text,'123');assert.equal(cues[0].start,62.125);const vtt='WEBVTT\n\nfirst\n00:00:00.000 --> 00:00:01.000 align:start\nFirst.\n\nsecond\n00:00:01.250 --> 00:00:02.000\nSecond.';assert.deepEqual(parseTranscript(vtt).segments.map(x=>[x.start,x.end,x.text]),[[0,1,'First.'],[1.25,2,'Second.']]);});






test('recovered Manual mode stops its selected phrase when delayed media samples catch up',t=>{const {p,media}=fixture(t);p.play();t.mock.timers.tick(1500);media.time=.9;p.tick();t.mock.timers.tick(100);media.time=1.6;p.tick();assert.equal(p.current().id,'a');assert.equal(p.playing,false);assert.equal(p.phraseDone,true);assert.equal(media.state,2);});
test('recovered transport lets an approximate seek advance through preroll instead of blocking itself',t=>{const {p,media}=fixture(t);media.seekTo=function(time){this.time=time-.2;};p.seekPhrase('c',true);assert.equal(p.current().id,'c');assert.equal(media.state,1);assert.equal(p.playing,true);for(let i=0;i<30&&media.state===1;i++){media.time+=.1;t.mock.timers.tick(100);p.tick();}assert.equal(p.current().id,'c');assert.equal(p.phraseDone,true);assert.equal(p.state,'paused');assert.ok(media.time>=5.95&&media.time<6.15);});
test('recovered Automatic mode stops before the speaking pause and only then advances',t=>{const {p,media}=fixture(t,{mode:'automatic',pauseType:'fixed',fixedPause:2});p.play();media.time=1.6;p.tick();assert.equal(p.current().id,'a');assert.equal(p.state,'speaking-pause');assert.equal(media.state,2);t.mock.timers.tick(1900);assert.equal(p.current().id,'a');t.mock.timers.tick(100);assert.equal(p.current().id,'b');assert.equal(p.playing,true);});
test('recovered Continuous mode follows source timestamps while retaining recording gaps',t=>{const {p,media}=fixture(t,{mode:'continuous'});p.play();media.time=1.5;p.tick();assert.equal(p.current().id,'b');media.time=3;p.tick();assert.equal(media.time,3);assert.equal(p.playing,true);media.time=4.5;p.tick();assert.equal(p.current().id,'c');assert.equal(p.playing,true);});
