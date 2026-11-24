import test from 'node:test';
import assert from 'node:assert/strict';
import {LyricsScroller,lyricTarget,lyricDistance} from '../src/lyrics.mjs';

test('lyric centring handles both short and taller-than-viewport phrases',()=>{
 assert.equal(lyricTarget(300,80,400),140);
 assert.equal(lyricTarget(0,20,400),0);
 assert.equal(lyricTarget(300,600,400),400);
 assert.deepEqual([0,1,2,8].map(i=>lyricDistance(i,0)),[0,1,2,3]);
});

test('transport rerenders preserve the existing transcript node and browsing position instantly',t=>{
 const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 t.after(()=>{globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=caf;});
 const phrases=[{id:'p',text:'Current phrase'}],button={},text={dataset:{},innerHTML:'words'};
 const row={dataset:{},classList:{toggle(){}},querySelector:s=>s==='.lyric-select'?button:text,setAttribute(){},removeAttribute(){}};
 const calls=[],el={isConnected:true,clientHeight:400,scrollTop:170,style:{setProperty(){}},querySelectorAll:()=>[row],scrollTo:opts=>{calls.push(opts);el.scrollTop=opts.top;}};
 const view=new LyricsScroller();Object.assign(view,{element:el,key:'lesson|'+JSON.stringify(phrases.map(p=>[p.id,p.text])),currentId:'p',following:false});view.capture();
 const slot={replaceWith:node=>{assert.equal(node,el);el.scrollTop=0;}};
 view.mount(slot,{lessonId:'lesson',phrases,currentId:'p',activeHTML:'words'});
 assert.equal(view.element,el);assert.equal(el.scrollTop,170);assert.deepEqual(calls,[{top:170,behavior:'instant'}]);assert.equal(view.following,false);
});

test('initial centring and reduced motion are instant; subsequent following is smooth',t=>{
 const media=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});t.after(()=>{globalThis.matchMedia=media;});
 const calls=[],button={},row={offsetTop:600,offsetHeight:100};
 const view=new LyricsScroller();view.element={isConnected:true,clientHeight:400,scrollTop:0,querySelector:s=>s==='.is-current'?row:button,scrollTo:opts=>calls.push(opts)};
 view.center();view.center();globalThis.matchMedia=()=>({matches:true});view.center();
 assert.deepEqual(calls.map(x=>x.behavior),['instant','smooth','instant']);assert.ok(calls.every(x=>x.top===450));
});
