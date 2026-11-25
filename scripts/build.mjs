import {readFileSync,writeFileSync,mkdirSync,realpathSync,rmSync} from 'node:fs';
import {contentType,publicAssets} from './shell-assets.mjs';
const assets=Object.fromEntries([...publicAssets(realpathSync('.'))].map(([name,bytes])=>[
 name,{body:bytes.toString('base64'),type:contentType(name)},
]));
const audioServer=readFileSync('server/audio.mjs','utf8').replace('export async function','async function');
const snapshotServer=readFileSync('src/snapshot.mjs','utf8').replace(/^export /gm,'');
const mediaServer=readFileSync('src/library-mutations.mjs','utf8').replace(/^export /gm,'');
const limitsServer=readFileSync('src/sync-limits.mjs','utf8').replace(/^export /gm,'');
const handler=readFileSync('server/worker.mjs','utf8')
 .replace("import {handleAudio} from './audio.mjs';",'')
 .replace("import {validateSnapshot} from '../src/snapshot.mjs';",'')
 .replace("import {isManagedMediaPath,mediaReferences} from '../src/library-mutations.mjs';",'')
 .replace("import {MAX_STATE_BYTES,MAX_ROW_BYTES} from '../src/sync-limits.mjs';",'')
 .replace('export default {','const apiHandler = {');
const code=audioServer+'\n'+limitsServer+'\nconst validateSnapshot = (() => {\n'+snapshotServer+'\nreturn validateSnapshot;\n})();\n'+
 'const {isManagedMediaPath,mediaReferences} = (() => {\n'+mediaServer+'\nreturn {isManagedMediaPath,mediaReferences};\n})();\n'+handler+'\nconst assets='+JSON.stringify(assets)+';\n'+`
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return apiHandler.fetch(request,env,ctx);
 const file=assets[url.pathname==='/'?'/index.html':url.pathname];
 if(!file)return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
 const bytes=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':file.type,'cache-control':'no-cache','referrer-policy':'strict-origin-when-cross-origin','x-content-type-options':'nosniff'}});
}};
`;
rmSync('dist',{recursive:true,force:true});
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js',code);
writeFileSync('dist/.openai/hosting.json',readFileSync('.openai/hosting.json'));
console.log('Built Echo Studio Worker and embedded browser assets.');
