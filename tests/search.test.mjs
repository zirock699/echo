import test from 'node:test';import assert from 'node:assert/strict';import {searchLibrary,rememberSearch,SearchUI} from '../src/search-ui.mjs';import {LibraryUI} from '../src/library-ui.mjs';
const fixture=()=>({preferences:{},categories:[],tags:[],collections:[{id:'collection',name:'Speaking practice',lessonIds:['one']}],courses:[{id:'course',title:'Speaking course',lessonIds:['one']}],lessons:[{id:'one',title:'First lesson',speaker:'British speaker',tags:['speaking'],phrases:[],statuses:{}}]});
test('global search returns lessons, courses and collections with independent type filters',()=>{const data=fixture();assert.equal(searchLibrary(data,'speaking').length,3);assert.deepEqual(searchLibrary(data,'SPEAKING','course').map(r=>r.item.id),['course']);assert.equal(searchLibrary(data,'British','lesson').length,1);assert.deepEqual(searchLibrary(data,''),[]);assert.deepEqual(searchLibrary(data,'missing'),[]);});
test('search history deduplicates, bounds retained terms and preserves entered spelling',()=>{assert.deepEqual(rememberSearch(['English','Science'],' english '),['english','Science']);assert.equal(rememberSearch(Array.from({length:25},(_,i)=>'Term '+i),'New').length,20);assert.deepEqual(rememberSearch(['English'],'  '),['English']);});
test('search history can remove individual entries and clear all without changing library data',()=>{const data=fixture(),store={data,mutate:f=>f(data)},ui=new SearchUI(store,()=>{},{lesson:()=>{}});const before=structuredClone(data.lessons);ui.query='Speaking';ui.action('submit');ui.query='British';ui.action('submit');ui.action('remove-history',{value:'Speaking'});assert.deepEqual(data.preferences.searchHistory,['British']);ui.action('clear-history');assert.deepEqual(data.preferences.searchHistory,[]);assert.deepEqual(data.lessons,before);});
test('search result navigation records the query and opens the requested type',()=>{const data=fixture(),opened=[],ui=new SearchUI({data,mutate:f=>f(data)},()=>{},{course:id=>opened.push(id)});ui.query='Speaking';ui.action('open',{kind:'course',id:'course'});assert.deepEqual(opened,['course']);assert.deepEqual(data.preferences.searchHistory,['Speaking']);});
test('mobile library loads the next results without duplicate rows or pagination controls',t=>{const previous=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});t.after(()=>{globalThis.matchMedia=previous;});const data=fixture();data.lessons=Array.from({length:70},(_,i)=>({...data.lessons[0],id:'lesson-'+i,title:'Lesson '+i,createdAt:i}));const ui=new LibraryUI({data},()=>{},()=>{});ui.kind='lessons';let html=ui.view();assert.equal((html.match(/data-library-key=/g)||[]).length,24);assert.ok(html.includes('data-load-more="library"'));assert.ok(!html.includes('aria-label="Library pages"'));ui.action('more');html=ui.view();assert.equal((html.match(/data-library-key=/g)||[]).length,48);assert.equal(new Set([...html.matchAll(/data-library-key="([^"]+)/g)].map(m=>m[1])).size,48);ui.action('kind',{kind:'unassigned'});assert.equal(ui.mobileLimit,24);});

test('composing search text is not replaced until composition finishes',()=>{
 const data=fixture(),listeners={},renders=[];const ui=new SearchUI({data},()=>renders.push(ui.query),{});
 ui.bind({addEventListener:(name,callback)=>{listeners[name]=callback;}});
 const target={id:'search-query',value:'philosophy'};
 listeners.compositionstart({target});listeners.input({target,isComposing:true});assert.deepEqual(renders,[]);
 listeners.compositionend({target});assert.deepEqual(renders,['philosophy']);
 target.value='philosophy books';listeners.input({target,isComposing:false});assert.equal(renders.at(-1),'philosophy books');
});

test('typing updates only results and never replaces the search field',()=>{
 const data=fixture(),listeners={},results={innerHTML:''},clear={hidden:true},field={value:'Speaking',selectionStart:4,selectionEnd:4};let renders=0,updates=0;
 const root={addEventListener:(name,callback)=>{listeners[name]=callback;},querySelector:selector=>selector==='#search-results'?results:selector==='[data-sx="clear"]'?clear:selector==='#search-query'?field:null};
 const ui=new SearchUI({data},()=>renders++,{});ui.onResults=()=>updates++;ui.bind(root);
 listeners.input({target:{id:'search-query',value:field.value},isComposing:false});
 assert.equal(renders,0);assert.equal(updates,1);assert.equal(root.querySelector('#search-query'),field);assert.equal(field.selectionStart,4);assert.equal(clear.hidden,false);assert.ok(results.innerHTML.includes('Speaking course'));
});
