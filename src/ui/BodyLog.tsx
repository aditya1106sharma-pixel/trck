import { MUSCLES } from '../lib/catalog'
import { MEAS_FIELDS, measDue, measOf, measTrend, type MeasKey } from '../lib/context'
import type { Store } from '../lib/store'
import { blankDay, type MuscleId } from '../lib/types'
import { Section, r1 } from './bits'

const LEVELS = ['', 'a little', 'a lot', 'sharp'] as const

/** Soreness and measurements for the selected day. Soreness can only delay Ready. Measurements feed the trainer's context. */
export function BodyLog({ store, sel, today }: { store: Store; sel: string; today: string }) {
  const { data, mutate, setSettings } = store
  const s = data.settings
  const d = data.days[sel] ?? blankDay()
  const due = measDue(data.days, s, today)

  const cycle = (mu: MuscleId) => mutate(sel, (x) => {
    const next = ((x.sore?.[mu] ?? 0) + 1) % 4
    const cur = { ...x.sore }
    if (next === 0) delete cur[mu]; else cur[mu] = next
    if (Object.keys(cur).length) x.sore = cur; else delete x.sore
  })
  const setMeas = (key: MeasKey, raw: string) => mutate(sel, (x) => {
    const num = raw === '' ? null : Number(raw)
    const n = num != null && Number.isFinite(num) && num > 0 ? num : null
    if (key === 'wt') x.wt = n
    else if (key === 'waist') x.waist = n
    else {
      const cur = { ...x.meas }
      if (n == null) delete cur[key]; else cur[key] = n
      if (Object.keys(cur).length) x.meas = cur; else delete x.meas
    }
  })

  const sharp = Object.values(d.sore ?? {}).some((v) => v === 3)
  return (
    <>
      <Section title="Sore anywhere?" right={<span className="sm mut">Tap to change</span>}>
        <div className="chips">
          {MUSCLES.map((m) => {
            const lv = d.sore?.[m.id] ?? 0
            return (
              <button key={m.id} className="chip sore" aria-pressed={lv > 0} data-level={lv}
                aria-label={`${m.label}, ${lv ? 'sore ' + LEVELS[lv] : 'not sore'}. Tap to change.`} onClick={() => cycle(m.id)}>
                {m.label}{lv > 0 && <small>{LEVELS[lv]}</small>}
              </button>
            )
          })}
        </div>
        <p className="sm mut" style={{ marginTop: 10 }}>A little changes nothing. A lot keeps that muscle out of tonight's session through tomorrow. Sharp keeps it out for two more days. Soreness can only make a muscle wait longer, never less.</p>
        {sharp && <p className="sm warn" role="alert" style={{ marginTop: 8 }}>Sharp pain, swelling or pain that does not ease: stop and see a doctor. TRCK is not medical advice.</p>}
      </Section>

      <Section title="Measurements" right={<span className="sm mut">{due == null ? 'Add your first' : due <= 0 ? 'Due now' : `Next in ${due} day${due === 1 ? '' : 's'}`}</span>}>
        <div className="grid3 meas">
          {MEAS_FIELDS.map((f) => {
            const t = measTrend(data.days, f.key)
            const v = measOf(d, f.key)
            return (
              <div key={f.key}>
                <label className="f" htmlFor={`m-${f.key}`}>{f.label} {f.unit}</label>
                <input id={`m-${f.key}`} type="number" inputMode="decimal" step="0.1" min="0" value={v ?? ''} onChange={(e) => setMeas(f.key, e.target.value)} />
                <p className="sm mut">{t && t.n > 1 ? `${r1(t.last.v - t.first.v) >= 0 ? 'Up' : 'Down'} ${Math.abs(r1(t.last.v - t.first.v))} since the first` : t ? 'First entry' : 'Not yet'}</p>
              </div>
            )
          })}
        </div>
        <div className="row sp" style={{ marginTop: 12 }}>
          <span className="sm mut">Same spot, same time of day. Every</span>
          <div className="row">
            <input id="meas-days" type="number" inputMode="numeric" min="1" max="90" aria-label="Days between measurements" style={{ width: 72 }} value={s.measDays ?? 14}
              onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 90) setSettings((x) => { x.measDays = Math.round(n) }) }} />
            <span className="sm mut">days</span>
          </div>
        </div>
        <p className="sm mut" style={{ marginTop: 10 }}>One number proves nothing. A smaller waist, a steady weight and heavier sets together point the right way. Entries are for {sel}.</p>
      </Section>
    </>
  )
}

