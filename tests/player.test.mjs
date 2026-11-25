import test from 'node:test';
import assert from 'node:assert/strict';
let moduleNumber=0;
function lesson(){return {id:'lesson',videoId:'iG9CE55wbtY',phrases:[{id:'a',start:27,end:29,text:'Hello.'},{id:'b',start:31,end:33,text:'Welcome.'}],progress:{position:0,phraseId:'a',coverage:[]},statuses:{},pauseOverrides:{}};}
async function fixture(t){
 const {PlayerEngine}=await import(`../src/player.mjs?test=${moduleNumber++}`);
 t.mock.timers.enable({apis:['setTimeout','setInterval']});
 const calls=[],players=[];
 globalThis.location={origin:'https://example.test'};
 globalThis.document={querySelector:()=>({replaceChildren(){calls.push('reset mount');},append(){}}),createElement:()=>({})};
 globalThis.window={YT:{Player:function(id,config){
  assert.match(config.videoId,/^[a-zA-Z0-9_-]{11}$/,'real API requires a valid initial video ID');
  const p={time:27,state:5,config,rate:1,cueVideoById(x){calls.push(['cue',x.videoId]);this.time=x.startSeconds;},seekTo(x){this.time=x;calls.push(['seek',x]);},playVideo(){this.state=1;config.events.onStateChange({data:1});calls.push('play');},pauseVideo(){this.state=2;config.events.onStateChange({data:2});calls.push('pause');},getCurrentTime(){return this.time;},getDuration(){return 80;},getAvailablePlaybackRates(){return [.5,1,1.5];},setPlaybackRate(x){this.rate=x;},getPlaybackRate(){return this.rate;},getPlayerState(){return this.state;},destroy(){calls.push('destroy');},getIframe(){return {setAttribute(){}};}};
  players.push(p);queueMicrotask(()=>config.events.onReady({target:p}));return p;
 }}};
 const e=new PlayerEngine();e.load(lesson(),{mode:'manual',speed:1.5,leadIn:0});
 t.after(()=>e.destroy());return {e,calls,players};
}
test('initialisation supplies video ID, preserves position and speed, and deduplicates requests',async t=>{
 const {e,players}=await fixture(t);await Promise.all([e.initialise(),e.initialise()]);assert.equal(players.length,1);assert.equal(e.ready,true);assert.equal(e.yt.time,27);assert.equal(e.yt.rate,1.5);
});
test('replay and next start playback after manual pause',async t=>{
 const {e,calls}=await fixture(t);await e.initialise();e.pause();e.replay();assert.equal(e.playing,true);assert.equal(e.yt.time,27);e.pause();e.next();assert.equal(e.phrase.id,'b');assert.equal(e.playing,true);assert.equal(e.yt.time,31);assert.equal(calls.filter(x=>x==='play').length,2);
});
test('manual boundaries pause; continuous playback preserves the original timeline',async t=>{
 const {e}=await fixture(t);await e.initialise();e.play();e.yt.time=29;e.tick();assert.equal(e.playing,false);assert.equal(e.state,'paused');e.setMode('continuous');e.play();e.yt.time=34;e.tick();assert.equal(e.playing,true);
});
test('automatic mode advances after the speaking pause and filtered queue skips unrelated phrases',async t=>{
 const {e}=await fixture(t);await e.initialise();e.setMode('automatic');e.play();e.yt.time=29;e.tick();assert.equal(e.state,'speaking-pause');t.mock.timers.tick(4000);assert.equal(e.phrase.id,'b');assert.equal(e.playing,true);e.lesson.statuses.b={difficult:true};e.setSelection('difficult');assert.deepEqual(e.eligible().map(x=>x.id),['b']);
});
test('retry destroys and rebuilds a failed player; autoplay errors remain visible',async t=>{
 const {e,calls,players}=await fixture(t);await e.initialise();e.yt.config.events.onError({data:153});assert.match(e.error,/identify/);await e.retry();assert.equal(players.length,2);assert.ok(calls.includes('destroy'));assert.equal(e.ready,true);e.yt.config.events.onAutoplayBlocked();assert.equal(e.state,'blocked');assert.match(e.error,/Tap Play/);
});
test('Next marks the current phrase Practised and immediately starts the next; replay and previous do not mark',async t=>{
 const {e}=await fixture(t);const marked=[];e.onPractised=id=>marked.push(id);await e.initialise();e.play();e.yt.time=29;e.tick();assert.equal(e.phraseDone,true);e.next();assert.deepEqual(marked,['a']);assert.equal(e.phrase.id,'b');assert.equal(e.playing,true);assert.equal(e.phraseDone,false);e.previous();e.replay();assert.deepEqual(marked,['a']);
});
test('automatic advancement does not mark phrases Practised',async t=>{
 const {e}=await fixture(t);const marked=[];e.onPractised=id=>marked.push(id);await e.initialise();e.setMode('automatic');e.play();e.yt.time=29;e.tick();t.mock.timers.tick(4000);assert.equal(e.phrase.id,'b');assert.deepEqual(marked,[]);
});
test('speed preference survives asynchronous rate changes and cue resets',async t=>{
 const {e}=await fixture(t);await e.initialise();let requested=null;e.yt.setPlaybackRate=value=>{requested=value;};
 e.speed=1;assert.equal(e.setSpeed(.5),true);assert.equal(requested,.5);assert.equal(e.speed,1);assert.equal(e.requestedSpeed,.5);
 e.yt.config.events.onPlaybackRateChange({data:.5});assert.equal(e.speed,.5);requested=null;e.yt.config.events.onPlaybackRateChange({data:1});e.handleYTState(5);assert.equal(requested,.5);assert.equal(e.requestedSpeed,.5);
});

test('resume after transcript cue IDs change selects the cue at saved media position',async t=>{const {e}=await fixture(t);const l=lesson();l.progress={position:31.5,phraseId:'old-imported-id',coverage:[]};e.load(l,{leadIn:0});assert.equal(e.current().id,'b');await e.initialise();e.play();assert.equal(e.yt.time,31.5);});
test('seeking into a gap targets the upcoming cue instead of retaining an unrelated old cue',async t=>{const {e}=await fixture(t);await e.initialise();e.seekRecording(30,false);assert.equal(e.current().id,'b');assert.equal(e.time,30);e.play();assert.equal(e.yt.time,30);});
test('overlapping cues resolve to an earlier cue still active after a short overlap ends',async t=>{const {e}=await fixture(t);e.lesson.phrases=[{id:'long',start:0,end:10,text:'Long caption'},{id:'short',start:2,end:3,text:'Short overlap'}];assert.equal(e.resolvePhrase(4)?.id,'long');assert.equal(e.resolvePhrase(2.5)?.id,'long');});

test('callbacks from a discarded YouTube player cannot mutate its replacement or finish a new phrase',async t=>{const {e,players}=await fixture(t);await e.initialise();const old=players[0];await e.retry();e.seekPhrase('b',false);const phrase=e.current().id,state=e.state;old.config.events.onStateChange({data:0});old.config.events.onError({data:100});old.config.events.onPlaybackRateChange({data:.5});assert.equal(e.current().id,phrase);assert.equal(e.state,state);assert.equal(e.error,'');assert.equal(e.speed,1.5);assert.equal(e.phraseDone,false);});

test('Continuous uses the full timeline and returning to shadowing restores the remembered queue', async t=>{
 const {e}=await fixture(t);
 await e.initialise();
 e.lesson.statuses.a={difficult:true};
 e.setSelection('difficult');
 assert.deepEqual(e.eligible().map(p=>p.id),['a']);
 e.play();
 e.yt.time=29;
 e.tick();
 assert.equal(e.phraseDone,true);

 e.setMode('continuous');
 assert.deepEqual(e.eligible().map(p=>p.id),['a','b']);
 assert.equal(e.phraseDone,false);
 assert.equal(e.time,29);
 e.next();
 assert.equal(e.current().id,'b');
 assert.equal(e.playing,true);
 e.previous();
 assert.equal(e.current().id,'a');
 e.next();
 e.setMode('automatic');
 assert.deepEqual(e.eligible().map(p=>p.id),['a']);
 assert.equal(e.current().id,'a');
 assert.equal(e.playing,true);
});

test('an empty filter leaves Continuous untouched and explicit valid filtering selects Manual',async t=>{
 const {e}=await fixture(t);
 await e.initialise();
 e.setMode('continuous');
 e.play();
 assert.equal(e.setSelection('difficult'),false);
 assert.equal(e.mode,'continuous');
 assert.equal(e.selection,'all');
 assert.equal(e.current().id,'a');
 assert.equal(e.playing,true);

 e.lesson.statuses.b={difficult:true};
 assert.equal(e.setSelection('difficult'),true);
 assert.equal(e.mode,'manual');
 assert.deepEqual(e.eligible().map(p=>p.id),['b']);
 assert.equal(e.current().id,'b');
});

test('session history measures only its own listening and deliberate marks',async t=>{
 const {e}=await fixture(t);
 await e.initialise();
 e.lesson.progress.coverage=[[31,32]];
 e.lesson.statuses={a:{practised:true},b:{practised:true,difficult:true}};
 e.next();
 e.pause();
 let result=e.finishSession();
 assert.equal(result.metricsVersion,1);
 assert.deepEqual(result.coveredIds,[]);
 assert.equal(result.activeSeconds,0);
 assert.equal(result.practised,1);
 assert.equal(result.difficult,0);

 e.seekPhrase('a',true);
 e.yt.time=27.14;e.tick();
 e.yt.time=27.28;e.tick();
 e.recordMark('a','practised');
 e.recordMark('a','practised');
 e.recordMark('a','difficult');
 e.recordMark('b','difficult');
 e.recordMark('b','difficult',false);
 e.pause();
 result=e.finishSession();
 assert.deepEqual(result.coveredIds,['a']);
 assert.ok(result.activeSeconds>0);
 assert.equal(result.practised,1);
 assert.equal(result.difficult,1);
 assert.deepEqual(e.lesson.progress.coverage.at(-1),[31,32]);
 assert.equal(e.lesson.statuses.b.difficult,true);

 e.play();
 e.pause();
 result=e.finishSession();
 assert.deepEqual(result.coveredIds,[]);
 assert.equal(result.practised,0);
 assert.equal(result.difficult,0);
});

test('session coverage does not count short cue gaps passed by an explicit seek or edit preview',async t=>{
 const {e}=await fixture(t);
 await e.initialise();
 e.previewRange(31,32);
 e.yt.time=31.1;e.tick();
 e.yt.time=31.2;e.tick();
 assert.equal(e.finishSession(),null);

 e.lesson.phrases=[{id:'a',start:27,end:27.1},{id:'skip',start:27.11,end:27.13},{id:'b',start:27.14,end:29}];
 e.setMode('continuous');
 e.seekRecording(27,true);
 e.yt.time=27.06;e.tick();
 e.yt.time=27.1;e.tick();
 e.seekRecording(27.14,true);
 e.yt.time=27.15;e.tick();
 e.yt.time=27.19;e.tick();
 e.pause();
 assert.deepEqual(e.finishSession().coveredIds,['a','b']);
});

test('recording seek after cue replacement preserves position and resolves only restored cues',async t=>{
 const {e}=await fixture(t);
 await e.initialise();
 e.setMode('continuous');
 e.seekPhrase('a',false);
 e.lesson.progress.coverage=[[27,29]];
 e.lesson.phrases=[{id:'restored-a',start:25,end:29},{id:'restored-b',start:31,end:33},{id:'overlap',start:32,end:34}];
 e.seekRecording(30,false);
 assert.equal(e.current().id,'restored-a');
 assert.equal(e.yt.time,30);
 assert.equal(e.playing,false);

 e.yt.getTimeBounds=()=>({start:32.5,end:80});
 e.seekRecording(30,true);
 assert.equal(e.current().id,'restored-b');
 assert.equal(e.yt.time,32.5);
 assert.equal(e.playing,true);
 assert.deepEqual(e.lesson.progress.coverage,[[27,29]]);
});

for(const mode of ['manual','automatic']){
 test(`${mode} reload stays at the saved gap after Undo maps it to the next restored cue`,async t=>{
  const {e}=await fixture(t);
  const restored=lesson();
  restored.phrases=[{id:'restored-a',start:0,end:1},{id:'restored-b',start:4,end:5}];
  restored.progress={position:2,phraseId:'restored-b',coverage:[[0,.6]]};
  e.load(restored,{mode,leadIn:.1});
  await e.initialise();
  e.tick();

  assert.equal(e.time,2);
  assert.equal(e.yt.time,2);
  assert.equal(e.current().id,'restored-b');
  assert.equal(e.playing,false);
  assert.deepEqual(restored.progress.coverage,[[0,.6]]);
 });
}
