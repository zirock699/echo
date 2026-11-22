import test from 'node:test';import assert from 'node:assert/strict';import worker from '../server/worker.mjs';
const data=()=>({lessons:[],collections:[],sessions:[],preferences:{theme:'dark'}});
class FakeD1{
 constructor(){this.map=new Map();}
 prepare(query){const db=this;return {bind(...args){return {
 async first(){const row=db.map.get(args[0]);return row?{...row}:null;},
 async run(){if(query.startsWith('INSERT')){if(db.map.has(args[0]))return {meta:{changes:0}};db.map.set(args[0],{revision:1,data:args[1]});return {meta:{changes:1}};}
 if(query.startsWith('UPDATE')){const row=db.map.get(args[2]);if(!row||row.revision!==args[3])return {meta:{changes:0}};db.map.set(args[2],{revision:row.revision+1,data:args[0]});return {meta:{changes:1}};}
 return {meta:{changes:0}};}
 };}};}
}
const make=(method='GET',mail='a@sample.test',body=null)=>new Request('https://echo.test/api/state',{method,headers:{...(mail?{'oai-authenticated-user-email':mail}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('server requires authenticated Sites identity and D1',async()=>{assert.equal((await worker.fetch(make('GET',null),{DB:new FakeD1()})).status,401);assert.equal((await worker.fetch(make(),{})).status,503);});
test('D1 snapshot versioning, conflicts and owner isolation',async()=>{
 const DB=new FakeD1(),env={DB};let r=await worker.fetch(make(),env);assert.deepEqual(await r.json(),{revision:0,data:null});
 r=await worker.fetch(make('PUT','a@sample.test',{expectedRevision:0,data:data()}),env);assert.equal((await r.json()).revision,1);
 r=await worker.fetch(make('PUT','a@sample.test',{expectedRevision:0,data:data()}),env);assert.equal(r.status,409);assert.equal((await r.json()).revision,1);
 r=await worker.fetch(make('PUT','a@sample.test',{expectedRevision:1,data:data()}),env);assert.equal((await r.json()).revision,2);
 assert.equal((await (await worker.fetch(make('GET','b@sample.test'),env)).json()).revision,0);
 assert.equal((await (await worker.fetch(make(),env)).json()).revision,2);
});
test('invalid state rejected',async()=>{const res=await worker.fetch(make('PUT','a@sample.test',{expectedRevision:0,data:{lessons:'not array'}}),{DB:new FakeD1()});assert.equal(res.status,400);});
