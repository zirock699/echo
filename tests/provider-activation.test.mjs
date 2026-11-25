import test from 'node:test';
import assert from 'node:assert/strict';
import {artworkURL,prepareAmbient} from '../src/ambient.mjs';
import {PlayerEngine} from '../src/player.mjs';

const VIDEO_ID='fixture1234';
const asset='/api/audio/00000000-0000-4000-8000-000000000001';
const origin='https://echo.example.test';

function lesson(videoId=VIDEO_ID){
 return {id:'fixture',videoId,phrases:[{id:'first',start:2,end:4},{id:'second',start:6,end:9}],
   statuses:{},progress:{position:2.153,phraseId:'first',coverage:[]}};
}

test('passive and native artwork use managed assets without following provider or external URLs',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('Artwork selection must not fetch'));
 const originalLocation=globalThis.location;
 globalThis.location={origin};
 t.after(()=>{globalThis.location=originalLocation;});
 const video={...lesson(),thumbnail:{url:'https://i.ytimg.com/vi/'+VIDEO_ID+'/mqdefault.jpg'}};
 const native={...video,audio:{id:asset.split('/').at(-1),url:asset}};
 assert.equal(artworkURL(video),null);
 assert.equal(artworkURL(native,{allowYouTube:true}),null);
 assert.equal(artworkURL({...video,cover:{url:'https://other.example.test'+asset}}),null);
 assert.equal(artworkURL({...video,frame:{url:origin+asset+'?legacy=1'}}),asset);
 assert.equal(artworkURL({...video,cover:{url:asset}}),asset);
 assert.equal(artworkURL(video,{allowYouTube:true}),`https://i.ytimg.com/vi/${VIDEO_ID}/mqdefault.jpg`);
 assert.equal(artworkURL(lesson('invalid'),{allowYouTube:true}),null);

 const originalImage=globalThis.Image;
 const requests=[];
 globalThis.Image=class {
  set src(url){requests.push(url);queueMicrotask(()=>this.onerror());}
 };
 t.after(()=>{globalThis.Image=originalImage;});
 await prepareAmbient(video,()=>assert.fail('Passive fallback is not stored'));
 await prepareAmbient(native,()=>assert.fail('Native fallback is not stored'),{allowYouTube:true});
 assert.deepEqual(requests,[]);
 await prepareAmbient(video,palette=>assert.equal(palette.source,'fallback'),{allowYouTube:true});
 assert.deepEqual(requests,[`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`]);
});

test('imported provider metadata and an invalid attempted video leave the API untouched',async t=>{
 const originalWindow=globalThis.window,originalDocument=globalThis.document;
 let scripts=0;
 globalThis.window={};
 globalThis.document={querySelector:()=>null,createElement:()=>{scripts++;return {};},head:{append(){} }};
 t.after(()=>{globalThis.window=originalWindow;globalThis.document=originalDocument;});
 const player=new PlayerEngine();
 t.after(()=>player.destroy());
 player.load(lesson(),{mode:'manual'});
 assert.equal(scripts,0);
 player.load(lesson('invalid'),{mode:'manual'});
 await player.initialise();
 assert.equal(player.state,'error');
 assert.match(player.error,/invalid YouTube video ID/);
 assert.equal(scripts,0);
});

test('deliberate video preparation cues without seeking and preserves the paused cursor until Play',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:1000});
 const originalWindow=globalThis.window,originalLocation=globalThis.location;
 const calls=[];
 globalThis.location={origin};
 globalThis.window={YT:{Player:function(_mount,config){
  assert.equal(config.videoId,VIDEO_ID);
  assert.equal(config.playerVars.controls,1);
  assert.equal(config.playerVars.autoplay,0);
  const media={state:5,time:0,
   emit(state){this.state=state;config.events.onStateChange({data:state});},
   cueVideoById({startSeconds}){calls.push(['cue',startSeconds]);this.emit(5);},
   seekTo(time){calls.push(['seek',time]);this.time=time;if(this.state!==2)this.emit(1);},
   playVideo(){calls.push(['play']);if(this.state!==1)this.emit(1);},
   pauseVideo(){this.emit(2);},getCurrentTime(){return this.time;},getDuration(){return 10;},
   getPlayerState(){return this.state;},setPlaybackRate(){},destroy(){},
  };
  queueMicrotask(()=>config.events.onReady({target:media}));
  return media;
 }}};
 t.after(()=>{globalThis.window=originalWindow;globalThis.location=originalLocation;});
 const player=new PlayerEngine();
 t.after(()=>player.destroy());
 player.load(lesson(),{mode:'manual'});
 await player.initialise();
 assert.deepEqual(calls,[['cue',2.153]]);
 t.mock.timers.tick(10000);
 assert.equal(player.time,2.153);
 assert.equal(player.current().id,'first');
 assert.equal(player.state,'ready');
 assert.equal(player.session,null);

 player.seekRecording(6.243,false);
 player.tick();
 assert.deepEqual(calls,[['cue',2.153],['cue',6.243]]);
 assert.equal(player.time,6.243);
 assert.equal(player.current().id,'second');
 assert.equal(player.playing,false);
 assert.equal(player.session,null);

 player.play();
 assert.deepEqual(calls,[['cue',2.153],['cue',6.243],['seek',6.243],['play']]);
 assert.equal(player.playing,true);
 assert.equal(player.time,6.243);
 assert.equal(player.yt.time,6.243);
 assert.ok(player.session);
});
