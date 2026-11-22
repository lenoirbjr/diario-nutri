'use strict';
const VERSION='1.0.0';
const SCOPE=new URL(self.registration.scope);
const PREFIX='diario-nutri:'+SCOPE.pathname+':';
const CACHE=PREFIX+VERSION;
const ASSETS=['./','./index.html','./app.js?v='+VERSION,'./style.css?v='+VERSION,'./foods.js?v='+VERSION,'./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const URLS=new Set(ASSETS.map(path=>new URL(path,SCOPE).href));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const {request}=e,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==SCOPE.origin||!(URLS.has(url.href)||(request.mode==='navigate'&&(url.pathname===SCOPE.pathname||url.pathname===new URL('./index.html',SCOPE).pathname))))return;
 e.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request.mode==='navigate'?'./index.html':request))||fetch(request)));
});
