import { useState } from 'react'
import { FOODS, INGREDIENTS, SUPPLEMENTS } from '../lib/catalog'
import { diffDays } from '../lib/dates'
import { carbG, carbTarget, fatG, kcal, kcalOf, level, protein, score, streaks, cupsOf } from '../lib/score'
import { blankDay, type Food, type FoodEntry, type Part } from '../lib/types'
import { Check, Num, Rail, Section, Stepper, f0, r1 } from '../ui/bits'
import { MealPhoto } from '../ui/MealPhoto'
import { Plates } from '../ui/Plates'
import { uid, type ScreenProps } from './common'

const CUP: Omit<FoodEntry, 'id'> = { n: 'Tea or coffee', p: 1, f: 1.5, cb: 6, k: 45, q: 1, c: 1, t: 'drink' }

function entryOf(f: Food): Omit<FoodEntry, 'id'> {
  return { n: f.n, p: f.p, f: f.f, cb: f.cb, k: kcalOf(f), q: 1, h: f.h ? 1 : 0, t: f.t }
}
const partOf = (f: Food, q = 1): Part => ({ n: f.n, p: f.p, f: f.f, cb: f.cb, k: kcalOf(f), q, t: f.t, u: f.u })

export function Today({ store, sel, today, toast }: ScreenProps) {
  const { data, mutate, setSettings } = store
  const s = data.settings
  const d = data.days[sel] ?? blankDay()
  const sc = score(d, s)
  const st = streaks(data.days, s, today)
  const lv = level(data.days, s)
  const P = protein(d)
  const dayN = Math.max(1, diffDays(sel, s.start) + 1)
  const [open, setOpen] = useState<'none' | 'custom' | 'meal' | 'photo'>('none')

  const foods = FOODS.concat(s.foods)
  const addFood = (f: Omit<FoodEntry, 'id'>) =>
    mutate(sel, (x) => {
      const hit = x.f.find((y) => y.n === f.n && !y.m && !!y.c === !!f.c)
      if (hit) hit.q = r1(hit.q + 1)
      else x.f.push({ ...f, id: uid() })
    })
  const qty = (id: string, dir: 1 | -1) =>
    mutate(sel, (x) => {
      const i = x.f.findIndex((y) => y.id === id)
      if (i < 0) return
      const step = x.f[i].h ? 0.5 : 1
      x.f[i].q = r1(x.f[i].q + dir * step)
      if (x.f[i].q <= 0) x.f.splice(i, 1)
    })

  return (
    <>
      <section>
        <div className="hero">
          <div>
            <h2>Score · day {dayN} of {s.days}</h2>
            <div className="num big" aria-label={`Score ${sc.total} of 100`}>{sc.total}<small>/100</small></div>
          </div>
          <div className="sm mut" style={{ textAlign: 'right' }}>
            {st.cur > 0 ? <><b className="num" style={{ fontSize: 30, color: 'var(--ink)' }}>{st.cur}</b><br />day streak</> : <>Streak needs<br />60 points</>}
          </div>
        </div>
        <Plates xp={lv.xp} />
        <div className="row sp sm mut">
          <span>{lv.cur.kg} kg plates</span>
          <span>{lv.next ? `${lv.next.xp - lv.xp} points to ${lv.next.kg} kg` : 'Top plate reached'}</span>
        </div>
        <div className="kv">
          <div><b>{sc.p}<small className="mut">/30</small></b><span>Protein</span></div>
          <div><b>{sc.t}<small className="mut">/20</small></b><span>Training</span></div>
          <div><b>{sc.s + sc.cg + sc.cp + sc.w}<small className="mut">/60</small></b><span>Habits, supps, water</span></div>
        </div>
      </section>

      <Section title="Protein" right={<span className="sm mut">{P >= s.protein ? 'Target hit' : `${f0(s.protein - P)} g to go`}</span>}>
        <div className="num big" style={{ fontSize: 64 }}>{f0(P)}<small>of {s.protein} g</small></div>
        <div style={{ margin: '10px 0 16px' }}><Rail pct={(P / s.protein) * 100} ok={P >= s.protein * 0.9} /></div>
        <div className="chips" style={{ marginBottom: 14 }}>
          <button className="chip" onClick={() => addFood(CUP)}>Tea or coffee</button>
          {foods.map((f) => (
            <button key={f.n} className="chip" onClick={() => addFood(entryOf(f))} aria-label={`Add ${f.n}, ${f.p} grams protein`}>
              {f.n}<small>{f.p} g</small>
            </button>
          ))}
        </div>
        {s.meals.length > 0 && (
          <div className="chips" style={{ marginBottom: 14 }}>
            {s.meals.map((m) => (
              <button key={m.n} className="chip" onClick={() => {
                const sum = m.parts.reduce((a, x) => ({ p: a.p + x.p * x.q, f: a.f + x.f * x.q, cb: a.cb + x.cb * x.q, k: a.k + x.k * x.q }), { p: 0, f: 0, cb: 0, k: 0 })
                mutate(sel, (x) => { x.f.push({ id: uid(), n: m.n, p: sum.p, f: sum.f, cb: sum.cb, k: Math.round(sum.k), q: 1, m: 1, parts: m.parts }) })
              }}>{m.n}<small>meal</small></button>
            ))}
          </div>
        )}
        <div className="row wrap">
          <button className="btn ghost photo-open" aria-expanded={open === 'photo'} onClick={() => setOpen(open === 'photo' ? 'none' : 'photo')}>Add meal photo</button>
          <button className="btn ghost sm" onClick={() => setOpen(open === 'custom' ? 'none' : 'custom')}>Custom food</button>
          <button className="btn ghost sm" onClick={() => setOpen(open === 'meal' ? 'none' : 'meal')}>Build a meal</button>
        </div>
        {open === 'photo' && <MealPhoto foods={s.foods} toast={toast} onClose={() => setOpen('none')} onLog={(e, fav) => {
          mutate(sel, (x) => { x.f.push(e) })
          if (fav) setSettings((x) => { x.meals = x.meals.filter((m) => m.n !== fav.n).concat(fav) })
          toast(fav ? 'Logged and saved as a favourite' : 'Meal logged'); setOpen('none')
        }} />}
        {open === 'custom' && <CustomFood onSave={(f, keep) => { addFood(entryOf(f)); if (keep) setSettings((x) => { x.foods.push(f) }); setOpen('none') }} />}
        {open === 'meal' && <MealBuilder onSave={(name, parts, add) => {
          setSettings((x) => { x.meals = x.meals.filter((m) => m.n !== name).concat({ n: name, parts }) })
          if (add) {
            const sum = parts.reduce((a, x) => ({ p: a.p + x.p * x.q, f: a.f + x.f * x.q, cb: a.cb + x.cb * x.q, k: a.k + x.k * x.q }), { p: 0, f: 0, cb: 0, k: 0 })
            mutate(sel, (x) => { x.f.push({ id: uid(), n: name, p: sum.p, f: sum.f, cb: sum.cb, k: Math.round(sum.k), q: 1, m: 1, parts }) })
          }
          toast('Meal saved'); setOpen('none')
        }} />}
      </Section>

      <Section title="Eaten" right={<span className="sm mut">{f0(kcal(d))} kcal</span>}>
        {d.f.length === 0 ? <p className="mut">Nothing logged. Tap a food above.</p> : (
          <div className="list">
            {d.f.map((x) => (
              <div className="item" key={x.id}>
                <div className="t"><b>{x.n}</b><small>{f0(x.p * x.q)} g protein · {f0(x.k * x.q)} kcal{x.parts ? ` · ${x.parts.length} items` : ''}{x.src === 'photo' ? ' · from a photo' : ''}</small></div>
                <div className="step">
                  <button aria-label={`Less ${x.n}`} onClick={() => qty(x.id, -1)}>−</button>
                  <output>{x.q}</output>
                  <button aria-label={`More ${x.n}`} onClick={() => qty(x.id, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Macros fat={fatG(d)} carb={carbG(d)} kc={kcal(d)} s={s} />
      </Section>

      <Section title="Supplements" right={<span className="sm mut">{sc.s / 5} of {SUPPLEMENTS.length}</span>}>
        <div className="list">
          {SUPPLEMENTS.map((x) => (
            <div className="item" key={x.id}>
              <div className="t"><b>{x.n}</b><small>{x.h}</small></div>
              <Check on={!!d.s[x.id]} label={`${x.n} taken`} onToggle={() => mutate(sel, (y) => { y.s[x.id] = !y.s[x.id] })} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Habits">
        <div className="list">
          <Row label="Water" sub={`glasses, target ${s.water}`}><Stepper label="Water" value={d.w} onChange={(v) => mutate(sel, (y) => { y.w = v })} /></Row>
          <Row label="Cigarettes" sub={`cap ${s.cig}`}>
            <div className="row"><span className={d.cig > s.cig ? 'bad sm' : 'sm mut'}>{d.cig > s.cig ? 'Over cap' : ''}</span>
              <Stepper label="Cigarettes" value={d.cig} onChange={(v) => mutate(sel, (y) => { y.cig = v })} /></div>
          </Row>
          <Row label="Tea or coffee" sub={`cups, cap ${s.cups}`}>
            <div className="row"><span className={cupsOf(d) > s.cups ? 'bad sm' : 'sm mut'}>{cupsOf(d) > s.cups ? 'Over cap' : ''}</span><b className="num" style={{ fontSize: 24 }}>{r1(cupsOf(d))}</b></div>
          </Row>
          <Row label="Cardio" sub="minutes, 20 or more earns 10"><Stepper label="Cardio" value={d.cardio} step={5} max={180} onChange={(v) => mutate(sel, (y) => { y.cardio = v })} /></Row>
        </div>
      </Section>

      <Section title="Body">
        <div className="grid3">
          <Field label="Weight kg" v={d.wt} onChange={(v) => mutate(sel, (y) => { y.wt = v })} step="0.1" />
          <Field label="Waist cm" v={d.waist} onChange={(v) => mutate(sel, (y) => { y.waist = v })} step="0.5" />
          <Field label="Sleep hours" v={d.sleep} onChange={(v) => mutate(sel, (y) => { y.sleep = v })} step="0.5" />
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="f" htmlFor="note">Note</label>
          <textarea id="note" value={d.note} placeholder="Energy, mood, anything odd" onChange={(e) => mutate(sel, (y) => { y.note = e.target.value })} />
        </div>
      </Section>
    </>
  )
}

function Row({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return <div className="item"><div className="t"><b>{label}</b><small>{sub}</small></div>{children}</div>
}

function Field({ label, v, onChange, step }: { label: string; v: number | null; onChange: (v: number | null) => void; step: string }) {
  return (
    <div>
      <label className="f">{label}</label>
      <input type="number" inputMode="decimal" step={step} min="0" value={v ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    </div>
  )
}

function Macros({ fat, carb, kc, s }: { fat: number; carb: number; kc: number; s: ScreenProps['store']['data']['settings'] }) {
  const items: [string, number, number, string][] = [['Calories', kc, s.kcal, ' kcal'], ['Fat', fat, s.fat, ' g'], ['Carbs', carb, carbTarget(s), ' g']]
  return (
    <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
      {items.map(([n, v, t, u]) => (
        <div key={n}>
          <div className="row sp sm"><span>{n}</span><span className={v > t * 1.1 ? 'warn' : 'mut'}><Num v={v} />{u} of {t}</span></div>
          <div style={{ marginTop: 4 }}><Rail pct={(v / t) * 100} ok={v <= t * 1.1 && v >= t * 0.9} /></div>
        </div>
      ))}
    </div>
  )
}

function CustomFood({ onSave }: { onSave: (f: Food, keep: boolean) => void }) {
  const [f, setF] = useState({ n: '', p: '', f: '', cb: '', k: '' })
  const [keep, setKeep] = useState(true)
  const num = (v: string) => Math.max(0, Number(v) || 0)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="sheet">
      <label className="f">Name</label>
      <input type="text" value={f.n} onChange={set('n')} placeholder="High protein roti" />
      <div className="grid4" style={{ marginTop: 10 }}>
        <div><label className="f">Protein g</label><input type="number" inputMode="decimal" value={f.p} onChange={set('p')} /></div>
        <div><label className="f">Fat g</label><input type="number" inputMode="decimal" value={f.f} onChange={set('f')} /></div>
        <div><label className="f">Carbs g</label><input type="number" inputMode="decimal" value={f.cb} onChange={set('cb')} /></div>
        <div><label className="f">kcal</label><input type="number" inputMode="decimal" value={f.k} onChange={set('k')} placeholder="auto" /></div>
      </div>
      <p className="sm mut" style={{ margin: '8px 0' }}>Values for one serving. Leave kcal empty and it is worked out from the macros.</p>
      <label className="row sm" style={{ margin: '8px 0 12px' }}><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep in my quick list</label>
      <button className="btn acc" disabled={!f.n.trim() || !num(f.p) && !num(f.cb) && !num(f.f)} onClick={() =>
        onSave({ n: f.n.trim(), p: num(f.p), f: num(f.f), cb: num(f.cb), k: num(f.k) || undefined, u: '1 serving', t: 'custom' }, keep)}>Add</button>
    </div>
  )
}

function MealBuilder({ onSave }: { onSave: (name: string, parts: Part[], add: boolean) => void }) {
  const [name, setName] = useState('')
  const [q, setQ] = useState<Record<string, number>>({})
  const all = INGREDIENTS.concat(FOODS)
  const parts = all.filter((f) => q[f.n] > 0).map((f) => partOf(f, q[f.n]))
  const sum = parts.reduce((a, x) => ({ p: a.p + x.p * x.q, f: a.f + x.f * x.q, k: a.k + x.k * x.q }), { p: 0, f: 0, k: 0 })
  return (
    <div className="sheet">
      <label className="f">Meal name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Air fryer egg bowl" />
      <div className="list" style={{ marginTop: 8, maxHeight: 280, overflow: 'auto' }}>
        {all.map((f) => (
          <div className="item" key={f.n}>
            <div className="t"><b>{f.n}</b><small>{f.u} · {f.p} g protein · {f.f} g fat</small></div>
            <Stepper label={f.n} value={q[f.n] ?? 0} step={f.h ? 0.5 : 1} onChange={(v) => setQ({ ...q, [f.n]: v })} />
          </div>
        ))}
      </div>
      <p className="sm" style={{ margin: '10px 0' }}>{f0(sum.p)} g protein · {f0(sum.f)} g fat · {f0(sum.k)} kcal</p>
      <div className="row">
        <button className="btn acc" disabled={!name.trim() || !parts.length} onClick={() => onSave(name.trim(), parts, true)}>Save and log</button>
        <button className="btn ghost" disabled={!name.trim() || !parts.length} onClick={() => onSave(name.trim(), parts, false)}>Save only</button>
      </div>
    </div>
  )
}
