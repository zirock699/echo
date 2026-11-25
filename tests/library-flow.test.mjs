import test from 'node:test';import assert from 'node:assert/strict';import {pageItems,newCourse,migrateLibrary} from '../src/courses.mjs';import {LibraryUI} from '../src/library-ui.mjs';import {initialData} from '../src/store.mjs';
function controller(count=0){const data=migrateLibrary(initialData()),c=newCourse('Course');data.courses.push(c);for(let i=0;i<count;i++){const l={id:'l'+i,title:'Lesson '+i,phrases:[],statuses:{},tags:[],progress:{},createdAt:i,courseId:c.id};data.lessons.push(l);c.lessonIds.push(l.id);}return new LibraryUI({data,mutate(fn){fn(data);}},()=>{},()=>{});}
test('ten thousand results render only a bounded page',()=>{const c=controller(10000);c.kind='lessons';const html=c.view();assert.equal((html.match(/data-library-key=/g)||[]).length,24);assert.match(html,/Page 1 of 417/);c.page=417;assert.equal((c.view().match(/data-library-key=/g)||[]).length,16);});
test('courses do not duplicate every course lesson on initial library page',()=>{const c=controller(40);const html=c.view();assert.equal((html.match(/data-library-key=/g)||[]).length,1);c.state.course=c.store.data.courses[0].id;assert.equal((c.view().match(/data-library-key=/g)||[]).length,24);});
test('global search finds lessons even while browsing courses',()=>{const c=controller(40);c.state.query='Lesson 39';assert.equal(c.currentItems().length,1);assert.equal(c.currentItems()[0].kind,'l');});
test('pagination clamps after filtering and empty results',()=>{assert.equal(pageItems([],99).page,1);assert.deepEqual(pageItems([1,2,3],99,2).items,[3]);});
test('ZIP preview paginates and confirmation is outside the scrolling dialog body',()=>{const c=controller();c.dialog='import';c.draft={destination:'new',title:'Demo',duplicates:'repair'};c.package={lessons:Array.from({length:40},(_,i)=>({title:'Item '+i,notes:[],phrases:[{}]}))};const html=c.overlay();assert.equal((html.match(/<li>/g)||[]).length,8);assert.match(html,/Page 1 of 5/);assert.ok(html.indexOf('class="import-footer"')>html.indexOf('class="library-dialog-body"'));assert.match(html,/data-lx="commit"/);});
test('entering a pinned course clears root-only filters and Back restores browsing context',()=>{const c=controller(40);c.state.filter='pinned';c.page=3;const id=c.store.data.courses[0].id;c.action('open',{kind:'c',id});assert.equal(c.state.filter,'all');assert.equal(c.currentItems().length,40);c.action('back');assert.equal(c.state.filter,'pinned');assert.equal(c.state.course,'');assert.equal(c.browsePage,3);});
test('transcript-only reimport repairs captions without uploading or replacing audio or progress',async()=>{const c=controller(1),l=c.store.data.lessons[0],audio={id:'original-asset',url:'/api/audio/original-asset'};l.audio=audio;l.videoId='external';l.progress.position=23;c.store.mode='cloud';c.store.flush=async()=>{};c.package={lessons:[{meta:{video_id:'external'},folder:'external',title:l.title,source:'original caption source',segments:[{id:'cue',start:0,end:1,text:'Hello'}],phrases:[{id:'cue',start:0,end:1,text:'Hello'}],notes:[],transcript:'transcript.srt'}]};c.draft={destination:c.store.data.courses[0].id,duplicates:'repair'};c.upload=()=>{throw Error('Repair must not upload assets');};await c.commit();assert.equal(c.summary.repaired,1);assert.equal(l.audio,audio);assert.equal(l.progress.position,23);assert.equal(l.phrases.length,1);assert.equal(c.store.data.lessons.length,1);});

test('an open ZIP summary reflects pending, rejected and confirmed account saves',async()=>{
 const c=controller(1),store=c.store,save=Promise.withResolvers();
 store.data.lessons[0].videoId='external';
 Object.assign(store,{mode:'cloud',pending:true,cacheStatus:'saved',flush:()=>save.promise});
 c.dialog='import';
 c.package={lessons:[{meta:{video_id:'external'},title:'Existing lesson'}]};
 c.draft={destination:store.data.courses[0].id,duplicates:'reuse'};
 const committing=c.commit();
 assert.equal(c.summary,null);
 save.resolve();
 await committing;
 const status=()=>c.overlay().match(/<p role="status">(.*?)<\/p>/s)?.[1];
 assert.equal(c.summary.reused,1);
 assert.match(status(),/^Saving to your account…/);

 Object.assign(store,{mode:'rejected',saveError:{code:'storage-too-large'}});
 assert.match(status(),/exceeds account storage limits.*Export a backup/);
 Object.assign(store,{mode:'cloud',pending:false,saveError:null});
 assert.equal(status(),'Library saved to your account.');
 assert.equal(c.summary.reused,1);
});

test('Library row distinguishes a resume cursor from explicit completion',()=>{
 const c=controller(1),lesson=c.store.data.lessons[0];
 Object.assign(lesson,{duration:100,progress:{position:60,coverage:[]}});
 const row=c.row('l',lesson);
 assert.match(row,/value="60" aria-label="Resume at 1:00"/);
 assert.match(row,/<small>Resume at 1:00<\/small>/);
 assert.doesNotMatch(row,/% (practised|complete|listened)/);
 lesson.completed=true;
 assert.match(c.row('l',lesson),/value="100" aria-label="Completed"/);
});
