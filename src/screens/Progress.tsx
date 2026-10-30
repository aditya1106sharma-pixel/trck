import { useState } from 'react'
import { addDays } from '../lib/dates'
import { avg, badgeStats, dailySeries, delta, periodStats, type Delta } from '../lib/stats'
import { streaks } from '../lib/score'
import { Section, Seg, f0, f1 } from '../ui/bits'
import { Strip } from '../ui/Strip'
import type { ScreenProps } from './common'

function Tile({ label, value, unit, note, d }: { label: string; value: string; unit: string; note: string; d: Delta }) {
  return (
    <div className="tile">
      <h2>{label}</h2>
      <div className="v">{value}<small>{unit}</small></div>
      <div className="sm mut">{note}</div>
      {d.text && <div className={'sm ' + (d.good == null ? 'mut' : d.good ? 'good' : 'bad')}>{d.text}</div>}
    </div>
  )
}

export function Progress({ store, today }: ScreenProps) {
  const { data } = store
  const s = data.settings
  const [n, setN] = useState<'7' | '30' | '60'>('7')
  const N = Number(n)
  const A = periodStats(data.days, s, today, N)
  const B = periodStats(data.days, s, addDays(today, -N), N)
  const ser = dailySeries(data.days, s, today, N)
  const st = streaks(data.days, s, today)
  const bs = badgeStats(data.days, s, st.best)
  const PA = avg(A.prot, A.foodDays), PB = avg(B.prot, B.foodDays)
  const KA = avg(A.kcal, A.foodDays), KB = avg(B.kcal, B.foodDays)
  const SA = avg(A.score, A.logged), SB = avg(B.score, B.logged)
  const CA = avg(A.cig, A.logged), CB = avg(B.cig, B.logged)
  const TA = avg(A.cups, A.logged), TB = avg(B.cups, B.logged)
  const w0 = A.weights[0], w1 = A.weights[A.weights.length - 1]
  const lbl = N === 7 ? 'last 7 days' : `last ${N} days`

  const badges: [string, string, boolean][] = [
    ['First log', 'Log anything once', bs.anyLogged],
    ['Three days', 'A 3 day streak', bs.streakBest >= 3],
    ['One week', 'A 7 day streak', bs.streakBest >= 7],
    ['Two weeks', 'A 14 day streak', bs.streakBest >= 14],
    ['Iron habit', '12 sessions', bs.sessions >= 12],
    ['Protein week', '7 days near target', bs.proteinDays >= 7],
    ['Capped', '10 days under the cigarette cap', bs.capDays >= 10],
    ['Personal best', 'Beat a previous best', bs.prs >= 1],
  ]

  return (
    <>
      <Section title="Progress" right={<Seg label="Range" value={n} onChange={setN} opts={[['7', '7 days'], ['30', '30 days'], ['60', '60 days']]} />}>
        <Tile label="Score" value={f0(SA)} unit="/100" note={`${A.logged} of ${N} days logged`} d={delta(SA, SB)} />
        <Tile label="Protein" value={f0(PA)} unit="g a day" note={`${A.proteinDays} of ${A.foodDays} days near the ${s.protein} g target`} d={delta(PA, PB)} />
        <Tile label="Calories" value={f0(KA)} unit="a day" note={`target ${s.kcal}`} d={delta(KA, KB)} />
        <Tile label="Training" value={String(A.sessions)} unit="sessions" note={`${A.sets} working sets, ${lbl}`} d={delta(A.sessions, B.sessions)} />
        <Tile label="Cigarettes" value={f1(CA)} unit="a day" note={`cap ${s.cig}`} d={delta(CA, CB, true, true)} />
        <Tile label="Tea or coffee" value={f1(TA)} unit="cups a day" note={`cap ${s.cups}`} d={delta(TA, TB, true, true)} />
        {A.weights.length > 1 && <Tile label="Weight" value={f1(w1)} unit="kg" note={`${f1(w0)} kg at the start of this range`} d={{ text: `${w1 - w0 > 0 ? 'Up' : 'Down'} ${Math.abs(Math.round((w1 - w0) * 10) / 10)} kg`, good: null }} />}
      </Section>

      <Section title="Day by day">
        <Strip label="Score" values={ser.score} target={60} good={(v) => v >= 60} summary={`avg ${f0(SA)}`} />
        <Strip label="Protein (g)" values={ser.protein} target={s.protein} good={(v) => v >= s.protein * 0.9} summary={`avg ${f0(PA)} g`} />
        <Strip label="Calories" values={ser.kcal} target={s.kcal} good={(v) => Math.abs(v - s.kcal) <= s.kcal * 0.1} summary={`avg ${f0(KA)}`} />
        <Strip label="Lifting volume (kg)" values={ser.volume} summary={`${A.sessions} sessions`} />
        <Strip label="Tea or coffee" values={ser.cups} target={s.cups} good={(v) => v <= s.cups} summary={`avg ${f1(TA)}`} />
        <Strip label="Cigarettes" values={ser.cig} target={s.cig} good={(v) => v <= s.cig} summary={`avg ${f1(CA)}`} />
        <Strip label="Sleep (h)" values={ser.sleep} summary={`avg ${f1(avg(ser.sleep.filter((x): x is number => x != null).reduce((a, b) => a + b, 0), ser.sleep.filter((x) => x != null).length))}`} />
        <Strip label="Weight (kg)" values={ser.weight} line summary={A.weights.length ? `${f1(w1)} kg` : 'no entries'} />
      </Section>

      <Section title="Badges">
        <div className="badges">
          {badges.map(([t, d, on]) => <div key={t} className={'badge' + (on ? ' on' : '')}><b>{t}</b><span>{d}</span></div>)}
        </div>
      </Section>
    </>
  )
}
