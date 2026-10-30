import { useEffect, useState } from 'react'
import { addDays, diffDays, fmt, todayKey } from './lib/dates'
import { useStore } from './lib/store'
import { Fuel } from './screens/Fuel'
import { Muscles } from './screens/Muscles'
import { Plan } from './screens/Plan'
import { Progress } from './screens/Progress'
import { Today } from './screens/Today'
import { Train } from './screens/Train'
import { useSync } from './lib/sync'
import { UpdateBar } from './ui/UpdateBar'

const TABS = [['today', 'Today', Today], ['train', 'Train', Train], ['muscles', 'Muscles', Muscles], ['fuel', 'Fuel', Fuel], ['progress', 'Progress', Progress], ['plan', 'Plan', Plan]] as const
type Tab = (typeof TABS)[number][0]

export default function App() {
  const store = useStore()
  const sync = useSync(store)
  const [tab, setTab] = useState<Tab>(() => { try { return (localStorage.getItem('trck:tab') as Tab) || 'today' } catch { return 'today' } })
  const [today, setToday] = useState(() => todayKey())
  const [sel, setSel] = useState(today)
  const [msg, setMsg] = useState('')

  useEffect(() => { try { localStorage.setItem('trck:tab', tab) } catch { /* ignore */ } }, [tab])
  useEffect(() => {
    try { const t = localStorage.getItem('trck:theme'); if (t && t !== 'auto') document.documentElement.setAttribute('data-theme', t) } catch { /* ignore */ }
  }, [])
  // Roll the day over if the app stays open past 5 am.
  useEffect(() => {
    const id = setInterval(() => {
      const t = todayKey()
      setToday((p) => { if (p !== t) setSel((s) => (s === p ? t : s)); return t })
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2200) }

  const Screen = TABS.find((t) => t[0] === tab)![2]
  const dayN = diffDays(sel, store.data.settings.start) + 1
  const isToday = sel === today

  return (
    <>
      <header className="top">
        <div className="brand">TRC<i>K</i></div>
        <div className="day">
          <button aria-label="Previous day" onClick={() => setSel(addDays(sel, -1))}>‹</button>
          <span>{isToday ? 'Today' : fmt(sel)}</span>
          <button aria-label="Next day" disabled={sel >= today} onClick={() => setSel(addDays(sel, 1))} style={{ opacity: sel >= today ? 0.25 : 1 }}>›</button>
        </div>
      </header>
      {!isToday && (
        <div className="daynote"><span>Editing <b>{fmt(sel, { weekday: 'long', day: 'numeric', month: 'short' })}</b>{dayN > 0 ? ` · day ${dayN}` : ''}</span>
          <button className="btn ghost sm" onClick={() => setSel(today)}>Back to today</button></div>
      )}
      {store.locked && <div className="warnbar" role="alert">The data on this device is from a newer version of TRCK. Close and reopen the app to update. Nothing you change is saved until then.</div>}
      <main>
        <Screen store={store} sel={sel} today={today} toast={toast} sync={sync} />
      </main>
      <UpdateBar />
      {msg && <div className="toast" role="status">{msg}</div>}
      <nav className="tabs" aria-label="Sections">
        <div>
          {TABS.map(([id, label]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); window.scrollTo(0, 0) }}>{label}</button>)}
        </div>
      </nav>
    </>
  )
}
