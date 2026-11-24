import test from 'node:test';
import assert from 'node:assert/strict';
import {homeShelves} from '../src/home.mjs';
import {categoryValues} from '../src/courses.mjs';
import {LibraryUI} from '../src/library-ui.mjs';
const fixture=()=>({categories:['Unused','Pronunciation'],tags:[],courses:[{id:'c',title:'Course',category:'Speaking',pinned:true,createdAt:1,lessonIds:['l1']}],collections:[{id:'col',name:'Practice',lessonIds:['l1']}],lessons:Array.from({length:40},(_,i)=>({id:'l'+i,title:'Lesson '+i,category:i%2?'Speaking':'Pronunciation',courseId:i===1?'c':null,createdAt:i,phrases:[],favourite:i%3===0,statuses:{},tags:[]}))});
test('Home previews stay bounded and do not mutate lesson order',()=>{const data=fixture(),before=JSON.stringify(data);const shelves=homeShelves(data);assert.ok(shelves.every(s=>s.items.length<=8));assert.equal(shelves.find(s=>s.id==='recent').items[0].item.id,'l39');assert.equal(shelves.find(s=>s.id==='favourites').items[0].item.id,'l39');assert.equal(JSON.stringify(data),before);assert.ok(!shelves.some(s=>s.title==='Unused'));});
test('every Home shelf opens an equivalent complete Library result set',()=>{const data=fixture(),library=new LibraryUI({data},()=>{},()=>{});for(const shelf of homeShelves(data)){if(shelf.destination.view)continue;library.browse(shelf.destination);const ids=new Set(library.currentItems().map(x=>x.item.id));assert.ok(shelf.items.every(x=>ids.has(x.item.id)),shelf.id);if(shelf.id==='recent')assert.equal(ids.size,40);}});
test('selected category includes matching courses and lessons with a full-library destination',()=>{const shelves=homeShelves(fixture(),'Speaking');assert.equal(shelves.length,1);assert.deepEqual(shelves[0].destination,{kind:'all',category:'Speaking'});assert.ok(shelves[0].items.some(x=>x.kind==='c'));assert.ok(shelves[0].items.every(x=>x.item.category==='Speaking'));assert.deepEqual(homeShelves(fixture(),'Unused'),[]);});
test('Home limits default category sections while any managed category remains discoverable',()=>{const data=fixture();for(let i=0;i<20;i++)data.courses.push({id:'extra'+i,title:'Extra',category:'Category '+i,lessonIds:[],createdAt:1});assert.equal(homeShelves(data).filter(s=>s.id.startsWith('category-')).length,4);assert.ok(categoryValues(data).includes('Category 19'));assert.equal(homeShelves(data,'Category 19')[0].items.length,1);});
test('shelf navigation clears stale Library search, selection, category and course filters',()=>{const library=new LibraryUI({data:fixture()},()=>{},()=>{});Object.assign(library.state,{query:'old',filter:'pinned',category:'old',course:'c',tag:'old'});library.page=5;library.selecting=true;library.selected.add('l:l1');library.browse({kind:'lessons',filter:'favourites'});assert.deepEqual(library.state,{query:'',filter:'favourites',sort:'recent',category:'',tag:'',course:''});assert.equal(library.page,1);assert.equal(library.selected.size,0);assert.equal(library.selecting,false);});
test('empty Home never invents content',()=>assert.deepEqual(homeShelves({courses:[],lessons:[],collections:[],categories:[]}),[]));

test('practice shelves use actual progress and open matching complete filters',()=>{
 const data=fixture();data.lessons[5].phrases=[{id:'a'},{id:'b'}];data.lessons[5].statuses={a:{practised:true}};
 const shelves=homeShelves(data);
 assert.deepEqual(shelves.find(s=>s.id==='progress').items.map(x=>x.item.id),['l5']);
 assert.ok(!shelves.find(s=>s.id==='new').items.some(x=>x.item.id==='l5'));
 assert.equal(shelves.find(s=>s.id==='recent').total,40);
 const library=new LibraryUI({data},()=>{},()=>{});
 for(const shelf of shelves){if(shelf.destination.view)continue;library.browse(shelf.destination);const ids=new Set(library.currentItems().map(x=>x.item.id));assert.ok(shelf.items.every(x=>ids.has(x.item.id)),shelf.id);}
});
test('See all artwork resolves real member lessons across courses and collections',async()=>{
 const {shelfArtworkLessons}=await import('../src/home.mjs');const data=fixture();
 const shelf={items:[{kind:'c',item:{lessonIds:['missing','l1','l2']}},{kind:'collection',item:{lessonIds:['l2','l3']}},{kind:'l',item:data.lessons[4]}]};
 assert.deepEqual(shelfArtworkLessons(data,shelf).map(l=>l.id),['l1','l2','l3','l4']);
 assert.deepEqual(shelfArtworkLessons(data,{items:[]}),[]);
});
