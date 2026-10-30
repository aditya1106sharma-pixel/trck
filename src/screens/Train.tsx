import { useState } from 'react'
import { CATALOG, MUSCLES, muscleLabel } from '../lib/catalog'
import { addDays } from '../lib/dates'
import { dayBest, e1rm, overloadHint, prevSession, priorBest, routine, validSets } from '../lib/muscles'
import { sessionsInWeek } from '../lib/score'
import { blankDay, type Exercise, type MuscleId } from '../lib/types'
import { Section, r1 } from '../ui/bits'
import { uid, type ScreenProps } from './common'

const imgSearch = (n: string) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(n + ' exercise form')}`

export function Train({ store, sel, today }: ScreenProps) {
  const { data, mutate, setSettings } = store
  const s = data.settings
  const d = data.days[sel] ?? blankDay()
  const rt = routine(s)
  const wk = sessionsInWeek(data.days, sel)
  const [adding, setAdding] = useState(false)
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i))
  void last7

  const setVal = (id: string, i: number, key: 'w' | 'r', v: string) =>
    mutate(sel, (x) => {
      const arr = (x.lift[id] ??= [])
      while (arr.length <= i) arr.push({ w: null, r: null })
      arr[i][key] = v === '' ? null : Number(v)
    })
  const addSet = (id: string) => mutate(sel, (x) => { (x.lift[id] ??= []).push({ w: null, r: null }) })

  return (
    <>
      <section>
        <header>
          <h2>This week</h2>
          <span className="sm mut">{wk} session{wk === 1 ? '' : 's'} · aim for 3 to 4</span>
        </header>
        <div className="row sp">
          <p style={{ maxWidth: 300 }} className="sm mut">Same lifts every session. When every set reaches the top of the rep range, add weight next time.</p>
          <button className={'btn ' + (d.done ? 'ghost' : 'acc')} aria-pressed={d.done} onClick={() => mutate(sel, (x) => { x.done = !x.done })}>
            {d.done ? 'Workout done ✓' : 'Finish workout'}
          </button>
        </div>
      </section>

      {rt.map((ex) => <Lift key={ex.id} ex={ex} sel={sel} store={store} setVal={setVal} addSet={addSet} />)}

      <Section title="Lifts" right={<button className="btn ghost sm" onClick={() => setAdding(!adding)}>{adding ? 'Close' : 'Add or change'}</button>}>
        {adding && (
          <AddLift
            have={new Set(rt.map((e) => e.id))}
            onCatalog={(id) => {
              const c = CATALOG.find((x) => x.id === id)
              if (!c) return
              setSettings((x) => {
                const prev = x.extra.find((e) => e.id === id)
                if (prev) prev.off = false
                else x.extra.push({ ...c, x: true })
              })
            }}
            onCustom={(ex) => setSettings((x) => { x.extra.push(ex) })}
          />
        )}
        {s.extra.length > 0 && (
          <div className="list" style={{ marginTop: 8 }}>
            {s.extra.map((e) => (
              <div className="item" key={e.id}>
                <div className="t"><b>{e.n}</b><small>{Object.keys(e.m).map(muscleLabel).join(', ')} {e.off ? '· removed, history kept' : ''}</small></div>
                <button className="btn ghost sm" onClick={() => setSettings((x) => { const t = x.extra.find((y) => y.id === e.id); if (t) t.off = !t.off })}>{e.off ? 'Bring back' : 'Remove'}</button>
              </div>
            ))}
          </div>
        )}
        <p className="sm mut" style={{ marginTop: 12 }}>See a machine you do not know? Add it by name here, then use the photo or ask Claude how to use it.</p>
      </Section>
    </>
  )
}

function Lift({ ex, sel, store, setVal, addSet }: { ex: Exercise; sel: string; store: ScreenProps['store']; setVal: (id: string, i: number, k: 'w' | 'r', v: string) => void; addSet: (id: string) => void }) {
  const { data } = store
  const d = data.days[sel] ?? blankDay()
  const last = prevSession(data.days, ex.id, sel)
  const hint = overloadHint(ex, last)
  const rows = Math.max(ex.s, (d.lift[ex.id] ?? []).length)
  const best = dayBest(d.lift[ex.id])
  const prior = priorBest(data.days, ex.id, sel)
  const pr = prior > 0 && best > prior
  return (
    <div className="lift">
      <div className="row sp">
        <h3>{ex.n}</h3>
        <span className="sm mut">{ex.s} × {ex.lo}–{ex.hi}</span>
      </div>
      <p className="sm mut" style={{ marginTop: 4 }}>{Object.entries(ex.m).map(([m, w]) => muscleLabel(m) + (w < 1 ? ' (helper)' : '')).join(' · ')}</p>
      <p className={'hint ' + hint.kind}>{hint.text}</p>
      {last && <p className="sm mut" style={{ marginBottom: 10 }}>Last time: {last.sets.map((x) => `${r1(x.w)}×${x.r}`).join('  ')}</p>}
      <div className="sets">
        {Array.from({ length: rows }, (_, i) => {
          const v = d.lift[ex.id]?.[i]
          return (
            <div className="set" key={i}>
              <i>{i + 1}</i>
              <input type="number" inputMode="decimal" step="0.5" min="0" placeholder="kg" aria-label={`${ex.n} set ${i + 1} weight`} value={v?.w ?? ''} onChange={(e) => setVal(ex.id, i, 'w', e.target.value)} />
              <input type="number" inputMode="numeric" min="0" placeholder="reps" aria-label={`${ex.n} set ${i + 1} reps`} value={v?.r ?? ''} onChange={(e) => setVal(ex.id, i, 'r', e.target.value)} />
              <span className="pr" aria-hidden>{v && v.w && v.r && e1rm(v.w, v.r) > prior && prior > 0 ? 'PR' : ''}</span>
            </div>
          )
        })}
      </div>
      <div className="row sp" style={{ marginTop: 10 }}>
        <button className="btn ghost sm" onClick={() => addSet(ex.id)}>Add set</button>
        <span className="sm">{pr ? <b className="good">New personal best</b> : validSets(d.lift[ex.id]).length ? <span className="mut">{validSets(d.lift[ex.id]).length} sets logged</span> : null}</span>
      </div>
      {ex.c && (
        <details>
          <summary>How to do it</summary>
          <ol>{ex.c.map((c, i) => <li key={i}>{c}</li>)}</ol>
          <a className="sm" href={imgSearch(ex.n)} target="_blank" rel="noreferrer">See photos of the lift</a>
        </details>
      )}
    </div>
  )
}

function AddLift({ have, onCatalog, onCustom }: { have: Set<string>; onCatalog: (id: string) => void; onCustom: (e: Exercise) => void }) {
  const [name, setName] = useState('')
  const [mu, setMu] = useState<MuscleId>('chest')
  const [sets, setSets] = useState('3')
  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>Variations</h2>
      <div className="chips">
        {CATALOG.filter((c) => !have.has(c.id)).map((c) => (
          <button key={c.id} className="chip" onClick={() => onCatalog(c.id)}>{c.n}<small>{Object.keys(c.m)[0] && muscleLabel(Object.keys(c.m)[0])}</small></button>
        ))}
      </div>
      <h2 style={{ margin: '18px 0 8px' }}>New machine or lift</h2>
      <label className="f">Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pec deck" />
      <div className="grid2" style={{ marginTop: 10 }}>
        <div><label className="f">Main muscle</label>
          <select value={mu} onChange={(e) => setMu(e.target.value as MuscleId)}>{MUSCLES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
        <div><label className="f">Sets</label><input type="number" min="1" max="6" value={sets} onChange={(e) => setSets(e.target.value)} /></div>
      </div>
      <button className="btn acc" style={{ marginTop: 12 }} disabled={!name.trim()} onClick={() => {
        onCustom({ id: 'x_' + uid(), n: name.trim(), m: { [mu]: 1 }, s: Math.max(1, Math.min(6, Number(sets) || 3)), lo: 8, hi: 12, inc: 2.5, x: true })
        setName('')
      }}>Add lift</button>
    </div>
  )
}
