// Cache first so TRCK opens offline at the gym. The build stamps a new cache name on every deploy.
// A new worker installs quietly and waits. The app shows "Update ready" and asks it to take over.
const CACHE = 'trck-__BUILD__'

async function precache() {
  const fresh = (u) => new Request(u, { cache: 'reload' })
  const c = await caches.open(CACHE)
  const res = await fetch(fresh('./index.html'))
  if (!res.ok) throw new Error('index.html not available')
  const assets = [...(await res.text()).matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((m) => './' + m[1])
  if (!assets.length) throw new Error('no assets found in index.html') // fail the install and keep the old version
  await c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg', ...assets].map(fresh))
}

self.addEventListener('install', (e) => { e.waitUntil(precache()) })
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
    return res
  }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))))
})
