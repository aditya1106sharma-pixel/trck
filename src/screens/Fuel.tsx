import { useState } from 'react'
import { addDays } from '../lib/dates'
import { advise, fuelData, mealTips, rank } from '../lib/fuel'
import { reviewPrompt } from '../lib/prompt'
import { carbTarget } from '../lib/score'
import { Rail, Section, Seg, f0 } from '../ui/bits'
import type { ScreenProps } from './common'

export function Fuel({ store, sel, today, toast }: ScreenProps) {
  const { data } = store
  const s = data.settings
  const [mode, setMode] = useState<'day' | 'week'>('week')
  const keys = mode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)) : [sel]
  const fd = fuelData(data.days, keys)
  const a = fd.avg
  const label = mode === 'week' ? '7 day average' : 'day'
  const adv = advise(fd, s, label)
  const fatR = rank(fd.list, 'f')
  const tips = mealTips(data.days, keys)
  const [shown, setShown] = useState(false)
  const prompt = reviewPrompt(data.days, s, today)

  const rows: [string, number, number, string][] = a
    ? [['Protein', a.p, s.protein, ' g'], ['Fat', a.f, s.fat, ' g'], ['Carbs', a.cb, carbTarget(s), ' g'], ['Calories', a.k, s.kcal, ' kcal']] : []

  return (
    <>
      <Section title="Fuel" right={<Seg label="Range" value={mode} onChange={setMode} opts={[['day', 'Day'], ['week', 'Week']]} />}>
        {!a ? <p>Log some food first. This page then shows where the fat and calories come from and where there is room.</p> : (
          <>
            <p className="sm mut" style={{ marginBottom: 12 }}>{mode === 'week' ? `Average over ${fd.n} logged day${fd.n === 1 ? '' : 's'}` : 'Selected day'}</p>
            <div style={{ display: 'grid', gap: 14 }}>
              {rows.map(([n, v, t, u]) => (
                <div key={n}>
                  <div className="row sp"><span>{n}</span><span className="sm mut"><b className="num" style={{ fontSize: 22, color: 'var(--ink)' }}>{f0(v)}</b>{u} of {t}</span></div>
                  <div style={{ marginTop: 4 }}><Rail pct={(v / t) * 100} ok={Math.abs(v - t) <= t * 0.1} /></div>
                </div>
              ))}
            </div>
            {fd.unknownFat > 0 && <p className="sm mut" style={{ marginTop: 12 }}>{fd.unknownFat} older entries have no fat value, so fat reads low.</p>}
          </>
        )}
      </Section>

      {a && (
        <>
          <Section title="Where the fat comes from">
            <div className="list">
              {fatR.arr.slice(0, 6).map(([n, v]) => (
                <div key={n} className="item">
                  <div className="t"><b>{n}</b><small>{Math.round((v / fatR.tot) * 100)}% of fat</small></div>
                  <span className="num" style={{ fontSize: 24 }}>{f0(v / fd.n)}<small className="sm mut"> g/day</small></span>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Room to cut"><ul className="plain">{adv.cut.map((x, i) => <li key={i}>{x}</li>)}</ul></Section>
          <Section title="Room to add"><ul className="plain">{adv.add.map((x, i) => <li key={i}>{x}</li>)}</ul></Section>
          {tips.length > 0 && (
            <Section title="Your meals, made better">
              <div className="list">
                {tips.map((m) => (
                  <div key={m.name}>
                    <div className="row sp"><b>{m.name}</b><span className="sm mut">{m.p} g protein · {m.f} g fat · {m.kcal} kcal</span></div>
                    <ul className="plain">{m.tips.map((t, i) => <li key={i} className="sm">{t}</li>)}</ul>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      <Section title="Ask Claude to review the week">
        <p className="sm mut" style={{ marginBottom: 12 }}>Free and private: this builds a summary of your last 7 days. Paste it into Claude and ask for the review.</p>
        <div className="row">
          <button className="btn acc" onClick={async () => {
            try { await navigator.clipboard.writeText(prompt); toast('Copied. Paste it into Claude.') } catch { setShown(true); toast('Copy it from the box below') }
          }}>Copy review prompt</button>
          <button className="btn ghost" onClick={() => setShown(!shown)}>{shown ? 'Hide' : 'Preview'}</button>
        </div>
        {shown && <pre className="prompt" style={{ marginTop: 12 }}>{prompt}</pre>}
      </Section>
    </>
  )
}
