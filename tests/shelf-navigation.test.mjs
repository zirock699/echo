import test from 'node:test';
import assert from 'node:assert/strict';
import {shelfEdges,scrollShelf,updateShelfControls} from '../src/shelf-navigation.mjs';

test('shelf edges handle fitting content, fractional pixels and overscroll',()=>{
 assert.deepEqual(shelfEdges({scrollLeft:0,clientWidth:400,scrollWidth:400}),{overflow:false,atStart:true,atEnd:true});
 assert.deepEqual(shelfEdges({scrollLeft:-20,clientWidth:400,scrollWidth:1200}),{overflow:true,atStart:true,atEnd:false});
 assert.deepEqual(shelfEdges({scrollLeft:320,clientWidth:400,scrollWidth:1200}),{overflow:true,atStart:false,atEnd:false});
 assert.deepEqual(shelfEdges({scrollLeft:799.5,clientWidth:400,scrollWidth:1200}),{overflow:true,atStart:false,atEnd:true});
 assert.deepEqual(shelfEdges({scrollLeft:840,clientWidth:400,scrollWidth:1200}),{overflow:true,atStart:false,atEnd:true});
});

test('direction buttons follow real native scroll position and disappear when content fits',()=>{
 const left={},right={},controls={hidden:true,querySelector:s=>s.includes('left')?left:right};
 const track={scrollLeft:0,clientWidth:400,scrollWidth:1200,closest:()=>({querySelector:()=>controls})};
 updateShelfControls(track);assert.equal(controls.hidden,false);assert.equal(left.disabled,true);assert.equal(right.disabled,false);
 track.scrollLeft=800;updateShelfControls(track);assert.equal(left.disabled,false);assert.equal(right.disabled,true);
 track.clientWidth=1200;updateShelfControls(track);assert.equal(controls.hidden,true);
});

test('shelf paging is reversible and respects reduced motion',()=>{
 const calls=[],track={clientWidth:400,scrollBy:opts=>calls.push(opts)};
 scrollShelf(track,'right');scrollShelf(track,'left',true);
 assert.deepEqual(calls,[{left:320,behavior:'smooth'},{left:-320,behavior:'instant'}]);
});
