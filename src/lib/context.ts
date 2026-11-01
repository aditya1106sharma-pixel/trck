// The week, as a short text. It goes with every question to the trainer so the answer knows what you did, what is sore and
// what is ready. Pure and free: no network, no AI. Numbers are what the person logged, never filled in.
import { MUSCLES, TARGET, muscleLabel } from './catalog'
import { addDays, fmt, winKeys } from './dates'
import { allExercises, dayEffective, hoursLeft, validSets, weekEffective } from './muscles'
import { protein, suppCount, type Days } from './score'
import type { Day, MuscleId, Settings } from './types'
import { SUPPLEMENTS } from './catalog'

const r1 = (n: number) => Math.round(n * 10) / 10
const list = (a: string[]) => a.join(', ')
const dayName = (k: string) => fmt(k, { weekday: 'short', day: 'numeric', month: 'short' })

export const MEAS_FIELDS = [
  { key: 'wt', label: 'Weight', unit: 'kg' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', unit: 'cm' },
  { key: 'hip', label: 'Hip', unit: 'cm' },
] as const
export type MeasKey = (typeof MEAS_FIELDS)[number]['key']

export const measOf = (d: Day | undefined, key: MeasKey): number | null => {
  if (!d) return null
  const v = key === 'wt' ? d.wt : key === 'waist' ? d.waist : d.meas?.[key]
  return typeof v === 'number' && v > 0 ? v : null
}

/** First and latest entries for one measurement, with their dates. Null when there is nothing yet. */
export function measTrend(days: Days, key: MeasKey): { first: { k: string; v: number }; last: { k: string; v: number }; n: number } | null {
  const rows = Object.keys(days).sort().map((k) => ({ k, v: measOf(days[k], key) })).filter((x): x is { k: string; v: number } => x.v != null)
  return rows.length ? { first: rows[0], last: rows[rows.length - 1], n: rows.length } : null
}

/** Days until measurements are due again, from the latest one taken. Zero or less means due now. Null if none taken yet. */
export function measDue(days: Days, s: Settings, today: string): number | null {
  const latest = Object.keys(days).sort().filter((k) => MEAS_FIELDS.some((f) => measOf(days[k], f.key) != null)).pop()
  if (!latest) return null
  const gap = s.measDays ?? 14
  const [y, m, d] = latest.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const passed = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 864e5)
  return gap - passed
}

function sessionLines(days: Days, s: Settings, keys: string[]): string[] {
  const out: string[] = []
  for (const k of keys) {
    const d = days[k]
    if (!d) continue
    const lifts = allExercises(s)
      .map((ex) => ({ ex, sets: validSets(d.lift[ex.id]) }))
      .filter((x) => x.sets.length)
      .map((x) => `${x.ex.n} ${x.sets.map((v) => `${r1(v.w)}x${v.r}`).join(', ')}`)
    if (!lifts.length) continue
    const hit = Object.entries(dayEffective(days, s, k)).filter(([, v]) => (v ?? 0) >= 2).map(([m]) => muscleLabel(m).toLowerCase())
    out.push(`${dayName(k)} (${list(hit) || 'light work'}): ${list(lifts)} (kg x reps)`)
  }
  return out
}

/** About 300 words about the last 7 days. `now` is passed in so tests can fix it. */
export function buildContext(days: Days, s: Settings, today: string, now: number): string {
  const keys = winKeys(today, 7)
  const lines: string[] = []
  lines.push(`Today is ${dayName(today)}. Goal: body recomposition (lose fat and build muscle at the same time). Protein target ${s.protein} g a day, about ${s.kcal} kcal.`)

  const sessions = sessionLines(days, s, keys)
  lines.push(sessions.length ? 'Training in the last 7 days:\n' + sessions.map((x) => '- ' + x).join('\n') : 'Training in the last 7 days: nothing logged.')

  const wk = weekEffective(days, s, today)
  const sets = (Object.entries(TARGET) as [MuscleId, [number, number]][]).map(([m, t]) => `${muscleLabel(m).toLowerCase()} ${r1(wk[m] ?? 0)} of ${t[0]} to ${t[1]}`)
  lines.push('Sets this week so far, against the usual range: ' + list(sets) + '.')

  const ready: string[] = []
  const rest: string[] = []
  for (const { id } of MUSCLES) {
    const h = hoursLeft(days, s, id, now)
    if (h == null || h <= 0) ready.push(muscleLabel(id).toLowerCase())
    else rest.push(`${muscleLabel(id).toLowerCase()} (${Math.ceil(h)} h)`)
  }
  lines.push(`Ready to train: ${list(ready) || 'none'}. Recovering: ${list(rest) || 'none'}.`)

  const sore = keys.flatMap((k) => Object.entries(days[k]?.sore ?? {}).map(([m, l]) => `${muscleLabel(m).toLowerCase()} ${['', 'a little', 'a lot', 'sharp'][l as number] ?? ''} on ${dayName(k)}`))
  if (sore.length) lines.push('Soreness told to the app: ' + list(sore) + '.')

  const meas = MEAS_FIELDS.flatMap((f) => {
    const t = measTrend(days, f.key)
    if (!t) return []
    return [t.n > 1 ? `${f.label.toLowerCase()} ${t.last.v} ${f.unit} on ${dayName(t.last.k)}, ${r1(t.last.v - t.first.v) >= 0 ? 'up' : 'down'} ${Math.abs(r1(t.last.v - t.first.v))} since ${dayName(t.first.k)}` : `${f.label.toLowerCase()} ${t.last.v} ${f.unit} on ${dayName(t.last.k)}`]
  })
  lines.push(meas.length ? 'Measurements: ' + list(meas) + '.' : 'Measurements: none yet.')

  const eaten = keys.filter((k) => days[k]?.f.length).slice(-3).map((k) => `${dayName(k)} ${Math.round(protein(days[k]))} g`)
  lines.push(eaten.length ? `Protein on recent days (target ${s.protein} g): ${list(eaten)}.` : 'Protein: nothing logged recently.')

  const yesterday = days[addDays(today, -1)]
  if (yesterday && suppCount(yesterday)) lines.push('Supplements yesterday: ' + list(SUPPLEMENTS.filter((x) => yesterday.s[x.id]).map((x) => x.n.toLowerCase())) + '.')
  return lines.join('\n')
}
