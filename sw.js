// The build and local preview prepend the same content-addressed shell manifest.
const {cache:cacheName,assets}=SHELL;

function assetRequest(pathname){
 return new Request(new URL(pathname,self.location.origin),{
  cache:'reload',redirect:'error',integrity:assets[pathname],
 });
}

self.addEventListener('install',event=>{
 // addAll leaves the previous shell available if any asset is missing or differs.
 event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(Object.keys(assets).map(assetRequest))));
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name!==cacheName&&name.startsWith('echo-studio-app-'))
   .map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});

self.addEventListener('fetch',event=>{
 const {request}=event;
 const url=new URL(request.url);
 const pathname=url.pathname==='/'?'/index.html':url.pathname;
 if(request.method!=='GET'||url.origin!==self.location.origin||url.search||!Object.hasOwn(assets,pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(cacheName);
  return await cache.match(new URL(pathname,self.location.origin))??fetch(assetRequest(pathname));
 })());
});
