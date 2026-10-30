import { CATALOG, ROUTINE, TARGET } from './catalog'
import { addDays, atHour, winKeys, weekStart } from './dates'
import type { Days } from './score'
import type { Exercise, MuscleId, Settings, SetLog } from './types'

export const validSets = (a: SetLog[] | undefined): { w: number; r: number }[] =>
  (a ?? []).filter((s): s is { w: number; r: number } => !!s && (s.w ?? 0) > 0 && (s.r ?? 0) > 0)

export const e1rm = (w: number, r: number) => w * (1 + r / 30)

export function routine(s: Settings): Exercise[] {
  return ROUTINE.concat(s.extra.filter((e) => !e.off))
}
/** Every lift ever logged, including removed ones, so history stays readable. */
export function allExercises(s: Settings): Exercise[] {
  return ROUTINE.concat(s.extra)
}
export const knownExercise = (s: Settings, id: string) =>
  allExercises(s).find((e) => e.id === id) ?? CATALOG.find((e) => e.id === id)

export type Effective = Partial<Record<MuscleId, number>>

/** Sets for one day: a set counts 1 for the main muscle and 0.5 for helpers. */
export function dayEffective(days: Days, s: Settings, k: string): Effective {
  const out: Effective = {}
  const d = days[k]
  if (!d) return out
  for (const ex of allExercises(s)) {
    const n = validSets(d.lift[ex.id]).length
    if (!n) continue
    for (const [mu, w] of Object.entries(ex.m) as [MuscleId, number][]) out[mu] = (out[mu] ?? 0) + n * w
  }
  return out
}

export function sumEffective(days: Days, s: Settings, keys: string[]): Effective {
  const out: Effective = {}
  for (const k of keys) {
    for (const [mu, v] of Object.entries(dayEffective(days, s, k)) as [MuscleId, number][]) out[mu] = (out[mu] ?? 0) + v
  }
  return out
}

export function weekEffective(days: Days, s: Settings, k: string): Effective {
  const start = weekStart(k)
  return sumEffective(days, s, Array.from({ length: 7 }, (_, i) => addDays(start, i)))
}

export const monthEffective = (days: Days, s: Settings, today: string) => sumEffective(days, s, winKeys(today, 30))

/** A muscle counts as trained on a day when it gets 2 or more sets. */
export function lastTrained(days: Days, s: Settings, mu: MuscleId): string | null {
  const keys = Object.keys(days).sort().reverse()
  for (const k of keys) if ((dayEffective(days, s, k)[mu] ?? 0) >= 2) return k
  return null
}

/** Hours until the muscle has had 48 hours since the usual finish hour. Null if never trained. */
export function hoursLeft(days: Days, s: Settings, mu: MuscleId, now: number = Date.now()): number | null {
  const k = lastTrained(days, s, mu)
  if (!k) return null
  return (atHour(k, s.hour) + 48 * 36e5 - now) / 36e5
}

export type Band = 'low' | 'ok' | 'high' | 'ind'
export function band(mu: MuscleId, sets: number, mult: number): Band {
  const t = TARGET[mu]
  if (!t) return 'ind'
  if (sets < t[0] * mult) return 'low'
  if (sets > t[1] * mult) return 'high'
  return 'ok'
}

export function gaps(eff: Effective, mult: number): { mu: MuscleId; sets: number; need: number }[] {
  const out: { mu: MuscleId; sets: number; need: number }[] = []
  for (const [mu, t] of Object.entries(TARGET) as [MuscleId, [number, number]][]) {
    const sets = eff[mu] ?? 0
    if (sets < t[0] * mult) out.push({ mu, sets, need: Math.round(t[0] * mult) })
  }
  return out
}

// Lift history helpers

export function prevSession(days: Days, id: string, before: string) {
  const keys = Object.keys(days).filter((k) => k < before).sort().reverse()
  for (const k of keys) {
    const v = validSets(days[k].lift[id])
    if (v.length) return { k, sets: v }
  }
  return null
}

export function dayBest(sets: SetLog[] | undefined): number {
  return validSets(sets).reduce((m, x) => Math.max(m, e1rm(x.w, x.r)), 0)
}

export function priorBest(days: Days, id: string, before: string): number {
  return Object.keys(days).filter((k) => k < before).reduce((m, k) => Math.max(m, dayBest(days[k].lift[id])), 0)
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Progressive overload hint. Add weight once every set reached the top of the rep range. */
export function overloadHint(ex: Exercise, last: ReturnType<typeof prevSession>): { kind: 'first' | 'add' | 'beat'; text: string } {
  if (!last) return { kind: 'first', text: `First time. Pick a weight you can lift for ${ex.lo} reps with 2 left in the tank.` }
  const w = Math.max(...last.sets.map((s) => s.w))
  const all = last.sets.length >= ex.s && last.sets.every((s) => s.w >= w && s.r >= ex.hi)
  if (all) return { kind: 'add', text: `Add weight: try ${r1(w + ex.inc)} kg for ${ex.lo} reps or more.` }
  return { kind: 'beat', text: `Beat last time: ${r1(w)} kg, add a rep on each set until you hit ${ex.hi}.` }
}

export function sessionVolume(days: Days, s: Settings, k: string): number {
  const d = days[k]
  if (!d) return 0
  return allExercises(s).reduce((a, ex) => a + validSets(d.lift[ex.id]).reduce((b, x) => b + x.w * x.r, 0), 0)
}
