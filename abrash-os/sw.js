/* ABRASH OS offline cache — cache-first for shell, network-first for navigations */
const V='abrash-v1';
const CORE=['./index.html','./css/app.css','./js/app.js','./js/core.js','./js/store.js','./js/crypto.js','./js/i18n.js','./js/auth.js','./js/ui.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(cc=>cc.put(e.request,c)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(m=>m||caches.match('./index.html'))))});
