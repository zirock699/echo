import {readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import path from 'node:path';
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const assets={};
function add(file){assets['/'+file]={body:readFileSync(file).toString('base64'),type:mime[path.extname(file)]||'application/octet-stream'};}
for(const file of ['index.html','sw.js','manifest.webmanifest'])add(file);
for(const dir of ['src','assets'])for(const file of readdirSync(dir))add(dir+'/'+file);
const audioServer=readFileSync('server/audio.mjs','utf8').replace('export async function','async function');
let handler=readFileSync('server/worker.mjs','utf8').replace("import {handleAudio} from './audio.mjs';",'').replace('export default {','const apiHandler = {');
const code=audioServer+'\n'+handler+'\nconst assets='+JSON.stringify(assets)+';\n'+`
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return apiHandler.fetch(request,env,ctx);
 const file=assets[url.pathname==='/'?'/index.html':url.pathname];
 if(!file)return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const bytes=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':file.type,'cache-control':'no-cache','referrer-policy':'strict-origin-when-cross-origin','x-content-type-options':'nosniff'}});
}};
`;
rmSync('dist',{recursive:true,force:true});
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js',code);
writeFileSync('dist/.openai/hosting.json',readFileSync('.openai/hosting.json'));
console.log('Built Echo Studio Worker and embedded browser assets.');
