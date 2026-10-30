// Registers the service worker and tells the app when a newer version is waiting.
type Listener = (ready: boolean) => void

let ready = false
let applying = false
let registration: ServiceWorkerRegistration | null = null
const listeners = new Set<Listener>()

function announce(reg: ServiceWorkerRegistration) {
  registration = reg
  ready = true
  listeners.forEach((f) => f(true))
}

export function onUpdateReady(f: Listener): () => void {
  listeners.add(f)
  f(ready)
  return () => { listeners.delete(f) }
}

/** Asks the waiting worker to take over. The page reloads once it has. */
export function applyUpdate() {
  applying = true
  const waiting = registration?.waiting
  if (waiting) waiting.postMessage('SKIP_WAITING')
  else location.reload() // the new worker already took over, so a reload is all that is left
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload() })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const hasOld = () => !!navigator.serviceWorker.controller
      if (reg.waiting && hasOld()) announce(reg)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => { if (w.state === 'installed' && hasOld()) announce(reg) })
      })
      // A phone app can stay open for days, so look for a new version whenever it comes back.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
    }).catch(() => {})
  })
}
