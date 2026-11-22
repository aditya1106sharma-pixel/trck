// Small shared pieces: routing, toasts, sheets, fields, copy, QR code, loading and the crash screen.
import qrcode from 'qrcode-generator'
import { Component, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { logError } from '../api'

// ---------------------------------------------------------------- routing on the # part of the address

export function useRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export const go = (path: string) => { window.location.hash = '/' + path.replace(/^\//, '') }

// ---------------------------------------------------------------- toasts

export function toast(message: string): void { window.dispatchEvent(new CustomEvent('gym-toast', { detail: message })) }

export function Toaster() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const on = (e: Event) => { setMsg((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setMsg(''), 2600) }
    window.addEventListener('gym-toast', on)
    return () => { window.removeEventListener('gym-toast', on); clearTimeout(t) }
  }, [])
  return msg ? <div className="toast" role="status">{msg}</div> : <div className="vh" role="status" />
}

// ---------------------------------------------------------------- copy

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch { return false }
  }
}

// ---------------------------------------------------------------- sheet

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  // Callers pass a new onClose on every render. Keep it in a ref so focus is set once, when the sheet opens,
  // and typing in a field (which re-renders the parent) never moves focus or closes the phone keyboard.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not(.close)')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return }
      if (e.key !== 'Tab' || !ref.current) return
      // Keep Tab inside the sheet.
      const all = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')]
      if (!all.length) return
      const first = all[0]
      const last = all[all.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; before?.focus?.() }
  }, [])
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) closeRef.current() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="grab" />
        <header><h3 id={id}>{title}</h3><button className="link close" onClick={onClose}>Close</button></header>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- form fields

type FieldProps = { label: string; error?: string; hint?: string; children: ReactNode }
export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <label className={'field' + (error ? ' bad' : '')}>
      <span>{label}</span>
      {children}
      {error ? <span className="err">{error}</span> : hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function Choice({ options, value, onChange, label }: { options: string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="choice" role="group" aria-label={label}>
      {options.map((o) => <button type="button" key={o} aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)}>{o}</button>)}
    </div>
  )
}

// ---------------------------------------------------------------- states

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="center" aria-busy="true"><div><div className="spin" /><p className="mut">{label}</p></div></div>
}

export function Failed({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="center"><div>
      <h3>Could not load</h3>
      <p className="mut">{message}</p>
      {retry && <button className="btn" onClick={retry}>Try again</button>}
    </div></div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) { void logError('crash: ' + error.message, (error.stack ?? '') + (info.componentStack ?? '')) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="page"><div className="center"><div>
        <h3>Something broke</h3>
        <p className="mut">The problem was saved so Aditya can fix it. Reloading usually gets you going again.</p>
        <button className="btn acc" onClick={() => window.location.reload()}>Reload</button>
      </div></div></div>
    )
  }
}

// ---------------------------------------------------------------- QR code for the join link

export function QR({ text, label }: { text: string; label: string }) {
  const q = qrcode(0, 'M')
  q.addData(text)
  q.make()
  const n = q.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`
  return (
    <div className="qr">
      <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={label} shapeRendering="crispEdges"><path d={d} fill="#000" /></svg>
    </div>
  )
}

/** Runs an async action with a busy flag and a toast on failure. Returns true if it worked. */
export function useBusy(): [boolean, (fn: () => Promise<unknown>) => Promise<boolean>] {
  const [busy, setBusy] = useState(false)
  const lock = useRef(false) // a ref, so a fast double tap cannot start the action twice before React re-renders
  const run = async (fn: () => Promise<unknown>) => {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    try { await fn(); return true } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong.'); return false } finally { lock.current = false; setBusy(false) }
  }
  return [busy, run]
}
