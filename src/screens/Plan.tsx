import { useRef, useState } from 'react'
import { diffDays, fmt } from '../lib/dates'
import { exportJson, parseImport, readBackups } from '../lib/store'
import { reviewPrompt } from '../lib/prompt'
import { carbTarget } from '../lib/score'
import { DEFAULT_SETTINGS, type Settings } from '../lib/types'
import { syncAvailable } from '../lib/sync'
import { Section } from '../ui/bits'
import { SignIn } from '../ui/SignIn'
import type { ScreenProps } from './common'

type Key = 'protein' | 'fat' | 'kcal' | 'water' | 'cups' | 'cig' | 'hour' | 'days'
const FIELDS: [Key, string, string][] = [
  ['protein', 'Protein g', 'Daily target'], ['fat', 'Fat g', 'Daily limit'], ['kcal', 'Calories', 'Daily target'],
  ['water', 'Water glasses', 'Daily target'], ['cups', 'Tea or coffee cups', 'Daily cap'], ['cig', 'Cigarettes', 'Daily cap'],
  ['hour', 'Usual finish hour', '24 hour clock, for recovery'], ['days', 'Plan length', 'Days'],
]

export function Plan({ store, today, toast, sync }: ScreenProps) {
  const { data, setSettings, replace, saveError } = store
  const s = data.settings
  const file = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('trck:theme') ?? 'auto' } catch { return 'auto' } })
  const dayN = diffDays(today, s.start) + 1
  const count = Object.keys(data.days).length

  const applyTheme = (t: string) => {
    setTheme(t)
    try { localStorage.setItem('trck:theme', t) } catch { /* private mode */ }
    if (t === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }
  const download = () => {
    const blob = new Blob([exportJson(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `trck-backup-${today}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Backup downloaded')
  }

  return (
    <>
      <Section title="Plan">
        <p>Day {Math.max(1, dayN)} of {s.days}. Started {fmt(s.start, { day: 'numeric', month: 'short', year: 'numeric' })}. {count} day{count === 1 ? '' : 's'} with data.</p>
        <div style={{ marginTop: 14 }}>
          <label className="f" htmlFor="start">Start date</label>
          <input id="start" type="date" value={s.start} onChange={(e) => e.target.value && setSettings((x) => { x.start = e.target.value })} />
        </div>
      </Section>

      <Section title="Targets">
        <div className="grid2">
          {FIELDS.map(([k, label, sub]) => (
            <div key={k}>
              <label className="f" htmlFor={k}>{label}</label>
              <input id={k} type="number" inputMode="numeric" min="0" value={s[k]} onChange={(e) => { const v = Number(e.target.value); if (v >= 0) setSettings((x: Settings) => { x[k] = v }) }} />
              <span className="sm mut">{sub}</span>
            </div>
          ))}
        </div>
        <p className="sm mut" style={{ marginTop: 14 }}>Carbs are the rest: about {carbTarget(s)} g, worked out from calories, protein and fat.</p>
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setSettings((x) => { Object.assign(x, { ...DEFAULT_SETTINGS, start: x.start, extra: x.extra, foods: x.foods, meals: x.meals }) })}>Reset targets</button>
      </Section>

      <Section title="Sync">
        {!syncAvailable ? (
          <p className="sm mut">Not set up in this build. Add the two Supabase values (see README) and phone and laptop will share one log.</p>
        ) : sync.email ? (
          <>
            <p>Signed in as {sync.email}. {sync.state === 'syncing' ? 'Syncing…' : sync.state === 'ok' ? 'Everything is saved to the cloud.' : sync.state === 'error' ? 'Last sync failed.' : ''}</p>
            {sync.error && <p className="sm bad" style={{ marginTop: 6 }}>{sync.error}</p>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn ghost sm" onClick={() => void sync.syncNow()}>Sync now</button>
              <button className="btn ghost sm" onClick={async () => {
                const saved = await sync.syncNow()
                const sure = window.confirm(saved
                  ? 'Sign out and clear this device? Your log stays in your account, and a copy is kept on this device.'
                  : 'Your latest changes could not be saved to your account. Sign out and clear this device anyway? A copy is kept on this device.')
                if (sure) toast(await sync.signOut() ? 'Signed out' : 'Nothing was cleared. Download a backup, then try again.')
              }}>Sign out</button>
            </div>
          </>
        ) : <SignIn onSubmit={sync.signIn} onReset={sync.resetPassword} onSendCode={sync.sendCode} onVerifyCode={sync.verifyCode} toast={toast} />}
      </Section>

      <Section title="Your data">
        <p className="sm mut" style={{ marginBottom: 12 }}>{sync.email
          ? 'Your log is kept on this device and in your cloud account. Download a backup now and then for your own copy.'
          : 'Everything is stored on this device only. Nothing is sent anywhere. Phone and laptop each keep their own copy, so use backup and restore to move between them.'}</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn acc" onClick={download}>Download backup</button>
          <button className="btn ghost" onClick={() => file.current?.click()}>Restore or import</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              const imp = parseImport(await f.text())
              const n = Object.keys(imp.days).length
              if (!window.confirm(`Replace what is on this device with ${n} days from this file?`)) return
              toast(replace(imp, true) ? `Imported ${n} days` : 'Nothing was changed: this device is too full to keep a copy of your current log. Download a backup first.')
            } catch (err) { toast(err instanceof Error ? err.message : 'Could not read that file') }
          }} />
        </div>
        <p className="sm mut" style={{ marginTop: 10 }}>Import also reads the export from the first prototype. Before an import, the last copy on this device is kept, up to five.</p>
        {saveError && <div className="warnbar" role="alert">This device refused to save. Download a backup now.</div>}
        <KeptCopies />
      </Section>

      <Section title="Look">
        <div className="seg" role="group" aria-label="Theme">
          {[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, t]) => <button key={v} aria-pressed={theme === v} onClick={() => applyTheme(v)}>{t}</button>)}
        </div>
      </Section>

      <Section title="Coach">
        <p className="sm mut" style={{ marginBottom: 12 }}>A weekly review you can paste into Claude. It costs nothing and sends nothing by itself.</p>
        <button className="btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(reviewPrompt(data.days, s, today)); toast('Copied') } catch { toast('Copy failed') } }}>Copy review prompt</button>
      </Section>

      <p className="sm mut" style={{ padding: '18px 0' }}>Version <span className="num" data-testid="version">{__APP_VERSION__}</span></p>
    </>
  )
}

const WHY: Record<string, string> = {
  'before import': 'Before an import',
  'before upgrade': 'Before an upgrade',
  'before sign out': 'Before signing out',
  'another account was here': 'Before another account signed in',
  unreadable: 'Could not be read',
}

/** The last few copies the app set aside, so a wrong import or a sign out can be undone by hand. */
function KeptCopies() {
  const copies = readBackups().slice().reverse()
  if (!copies.length) return null
  const save = (json: string, at: number) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = `trck-kept-${new Date(at).toISOString().slice(0, 16).replace(/[T:]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="kept">
      <h3>Copies kept on this device</h3>
      <p className="sm mut">Download one, then use Restore or import to put it back.</p>
      <div className="list">
        {copies.map((b) => (
          <div key={b.at} className="row kept-row">
            <span className="kept-why">{WHY[b.reason] ?? b.reason}<small className="mut">{new Date(b.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span>
            <button className="btn ghost sm" onClick={() => save(b.json, b.at)}>Download</button>
          </div>
        ))}
      </div>
    </div>
  )
}
