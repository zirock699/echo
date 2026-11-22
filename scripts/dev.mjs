import worker from '../server/worker.mjs';
import {DevDB,DevBucket} from './dev-state.mjs';
import {Readable} from 'node:stream';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2);const arg=(name,fallback)=>args[args.indexOf(name)+1]||fallback;
const port=Number(arg('--port','4173'));const host=arg('--host','127.0.0.1');
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const previewEnv={DB:new DevDB(),BUCKET:new DevBucket()};
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.startsWith('/api/')){
 const headers=new Headers(req.headers);headers.set('oai-authenticated-user-email','preview@example.test');
 const body=['GET','HEAD'].includes(req.method)?undefined:await new Response(Readable.toWeb(req)).arrayBuffer();
 const response=await worker.fetch(new Request('http://localhost'+req.url,{method:req.method,headers,...(body?{body}:{})}),previewEnv);
 res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();return;
}const file=path.resolve('.','.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(process.cwd()+'/'))throw Error();const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,host,()=>console.log(`Echo Studio preview ${host}:${port}`));
