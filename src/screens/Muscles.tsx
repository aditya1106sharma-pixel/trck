import { useState } from 'react'
import { CATALOG, MUSCLES, SUGGEST, TARGET, muscleLabel } from '../lib/catalog'
import { addDays, fmt, weekStart } from '../lib/dates'
import { band, gaps, hoursLeft, lastTrained, monthEffective, routine, weekEffective } from '../lib/muscles'
import type { MuscleId } from '../lib/types'
import { BodyMap } from '../ui/BodyMap'
import { Section, Seg, r1 } from '../ui/bits'
import type { ScreenProps } from './common'

export function Muscles({ store, sel, today }: ScreenProps) {
  const { data, setSettings } = store
  const s = data.settings
  const [per, setPer] = useState<'week' | 'month'>('week')
  const [view, setView] = useState<'vol' | 'rec'>('vol')
  const [mu, setMu] = useState<MuscleId | null>(null)
  const mult = per === 'month' ? 30 / 7 : 1
  const eff = per === 'month' ? monthEffective(data.days, s, today) : weekEffective(data.days, s, sel)
  const rt = routine(s)
  const now = Date.now()

  const fill = (m: MuscleId) => {
    const neutral = 'color-mix(in srgb, var(--ink) 9%, var(--bg))'
    if (view === 'rec') {
      const h = hoursLeft(data.days, s, m, now)
      if (h == null) return neutral
      return h > 0 ? 'var(--warn)' : 'var(--ok)'
    }
    const v = eff[m] ?? 0
    if (v <= 0) return neutral
    const t = TARGET[m]
    const top = (t ? t[1] : 6) * mult
    const pct = Math.max(28, Math.min(100, (v / top) * 100))
    return `color-mix(in srgb, var(--acc) ${Math.round(pct)}%, ${neutral})`
  }
  const g = gaps(eff, mult)
  const any = Object.values(eff).some((v) => (v ?? 0) > 0)
  const title = per === 'month' ? 'Last 30 days' : `Week of ${fmt(weekStart(sel), { day: 'numeric', month: 'short' })}`

  return (
    <>
      <Section title={title} right={<Seg label="Period" value={per} onChange={setPer} opts={[['week', 'Week'], ['month', 'Month']]} />}>
        <div className="row sp" style={{ marginBottom: 8 }}>
          <span className="sm mut">Colour by</span>
          <Seg label="Colour by" value={view} onChange={setView} opts={[['vol', 'Sets'], ['rec', 'Recovery']]} />
        </div>
        <BodyMap fill={fill} selected={mu} onPick={setMu} />
        <div className="legend">
          {view === 'rec' ? (<>
            <span><i style={{ background: 'var(--ok)' }} />Ready</span>
            <span><i style={{ background: 'var(--warn)' }} />Recovering</span>
            <span><i style={{ background: 'color-mix(in srgb, var(--ink) 9%, var(--bg))', border: '1px solid var(--line)' }} />Not trained</span>
          </>) : (<><span>Fewer sets</span><span style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, color-mix(in srgb, var(--acc) 28%, var(--bg)), var(--acc))' }} /><span>More sets</span></>)}
        </div>
        <Detail mu={mu} eff={eff[mu ?? 'chest'] ?? 0} mult={mult} store={store} rt={rt} onAdd={(id) => {
          const c = CATALOG.find((x) => x.id === id)
          if (c) setSettings((x) => { const p = x.extra.find((e) => e.id === id); if (p) p.off = false; else x.extra.push({ ...c, x: true }) })
        }} />
      </Section>

      <Section title="Coverage">
        {!any ? <p>No sets logged in this period yet. Log weight and reps in Train and this fills in.</p>
          : g.length === 0 ? <p>Every muscle group is in range.</p>
          : <p><b>Below range so far:</b> {g.map((x) => `${muscleLabel(x.mu)} (${r1(x.sets)} of ${x.need})`).join(', ')}.</p>}
        {per === 'week' && <p className="sm mut" style={{ marginTop: 8 }}>Early in the week this is normal. Check again by Friday.</p>}
      </Section>

      <Section title="Every muscle">
        <div className="list">
          {MUSCLES.map((m) => {
            const t = TARGET[m.id]
            const v = eff[m.id] ?? 0
            const lo = t ? t[0] * mult : 0, hi = t ? t[1] * mult : 0
            const scale = t ? Math.max(hi * 1.25, v) : Math.max(8 * mult, v)
            const b = band(m.id, v, mult)
            return (
              <div key={m.id} className={'mrow ' + b} onClick={() => setMu(m.id)}>
                <span>{m.label}</span>
                <div className="bar" role="img" aria-label={`${m.label} ${r1(v)} sets${t ? `, range ${Math.round(lo)} to ${Math.round(hi)}` : ''}`}>
                  {t && <span className="range" style={{ left: `${(lo / scale) * 100}%`, width: `${((hi - lo) / scale) * 100}%` }} />}
                  <i style={{ width: `${Math.min(100, (v / scale) * 100)}%` }} />
                </div>
                <span>{r1(v)}{t ? ` / ${Math.round(lo)}–${Math.round(hi)}` : ''}</span>
              </div>
            )
          })}
        </div>
        <p className="sm mut" style={{ marginTop: 10 }}>A main muscle counts 1 set, a helper 0.5. Bars show your sets against a usual range for about three sessions a week. A muscle is trained on a day when it gets 2 or more sets, and shows Ready 48 hours after you usually finish ({s.hour}:00).</p>
      </Section>
    </>
  )
}

function Detail({ mu, eff, mult, store, rt, onAdd }: { mu: MuscleId | null; eff: number; mult: number; store: ScreenProps['store']; rt: ReturnType<typeof routine>; onAdd: (id: string) => void }) {
  const { data } = store
  const s = data.settings
  if (!mu) return <p className="sm mut" style={{ marginTop: 14 }}>Tap a muscle to see its sets, recovery and the lifts that train it.</p>
  const t = TARGET[mu]
  const hl = hoursLeft(data.days, s, mu)
  const lt = lastTrained(data.days, s, mu)
  const lifts = rt.filter((e) => (e.m[mu] ?? 0) > 0)
  const sug = SUGGEST[mu] ? CATALOG.find((c) => c.id === SUGGEST[mu]) : undefined
  const rec = lt == null ? 'Not trained yet' : hl != null && hl > 0 ? `Recovering, ready in ${Math.ceil(hl)} h` : `Ready. Last trained ${fmt(lt)}`
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <div className="row sp"><h3>{muscleLabel(mu)}</h3><span className="sm mut">{rec}</span></div>
      <p style={{ margin: '6px 0' }}>{r1(eff)} sets{t ? `, range ${Math.round(t[0] * mult)} to ${Math.round(t[1] * mult)}` : ', indirect work only'}.</p>
      {lifts.length ? <ul className="plain">{lifts.map((e) => <li key={e.id}>{e.n} <span className="sm mut">{(e.m[mu] ?? 0) >= 1 ? 'main' : 'helper'}</span></li>)}</ul>
        : <p className="sm mut">No lift in your routine trains this.</p>}
      {sug && !rt.some((e) => e.id === sug.id) && (!lifts.length || (t && eff < t[0] * mult)) && (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => onAdd(sug.id)}>Add {sug.n}</button>
      )}
    </div>
  )
}

void addDays
