import worker from '../server/worker.mjs';
import {DevDB,DevBucket} from './dev-state.mjs';
import {contentType,publicAsset,shellAssets} from './shell-assets.mjs';
import {Readable} from 'node:stream';
import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
function arg(name,fallback){
 const index=args.indexOf(name);
 return index>=0?args[index+1]??fallback:fallback;
}
const port=Number(arg('--port','4173'));
const host=arg('--host','127.0.0.1');
const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const previewEnv={DB:new DevDB(),BUCKET:new DevBucket()};

const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.startsWith('/api/')){
   const headers=new Headers(req.headers);
   headers.set('oai-authenticated-user-email','preview@example.test');
   // Forward body backpressure to the socket. Returning early must leave the
   // socket open long enough to send the Worker's rejection.
   const body=['GET','HEAD'].includes(req.method)?undefined:req.iterator({destroyOnReturn:false});
   const response=await worker.fetch(new Request('http://localhost'+req.url,{method:req.method,headers,...(body?{body,duplex:'half'}:{})}),previewEnv);
   const responseHeaders=Object.fromEntries(response.headers);
   if(body&&!req.readableEnded)responseHeaders.connection='close';
   res.writeHead(response.status,responseHeaders);
   if(response.body)Readable.fromWeb(response.body).pipe(res);
   else res.end();
   return;
  }

  const asset=pathname==='/'?'/index.html':pathname;
  if(!publicAsset(asset))throw Error('Unknown asset');
  const file=path.join(root,asset.slice(1));
  // The preview only exposes these files, never an alias to another file.
  if(await realpath(file)!==file)throw Error('Asset is not a direct file');
  if(req.method!=='GET'&&req.method!=='HEAD'){
   res.writeHead(405,{Allow:'GET, HEAD'});
   res.end('Method not allowed');
   return;
  }
  const data=asset==='/sw.js'?shellAssets(root).get(asset):await readFile(file);
  res.writeHead(200,{
   'Content-Type':contentType(asset),'Cache-Control':'no-store',
   'Referrer-Policy':'strict-origin-when-cross-origin','X-Content-Type-Options':'nosniff',
  });
  res.end(req.method==='HEAD'?undefined:data);
 }catch{
  res.writeHead(404);
  res.end('Not found');
 }
});
server.listen(port,host,()=>console.log(`Echo Studio preview ${host}:${server.address().port}`));
