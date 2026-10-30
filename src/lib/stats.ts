import { allExercises, dayBest, sessionVolume, validSets } from './muscles'
import { cupsOf, isLogged, kcal, protein, score, suppCount, type Days } from './score'
import { addDays, winKeys } from './dates'
import type { Settings } from './types'

export type PeriodStats = {
  n: number
  logged: number
  score: number
  foodDays: number
  prot: number
  kcal: number
  proteinDays: number
  sessions: number
  sets: number
  cig: number
  cups: number
  water: number
  supp: number
  weights: number[]
}

export function periodStats(days: Days, s: Settings, end: string, n: number): PeriodStats {
  const o: PeriodStats = {
    n, logged: 0, score: 0, foodDays: 0, prot: 0, kcal: 0, proteinDays: 0, sessions: 0, sets: 0,
    cig: 0, cups: 0, water: 0, supp: 0, weights: [],
  }
  for (const k of winKeys(end, n)) {
    const d = days[k]
    if (!d) continue
    if (d.wt && d.wt > 0) o.weights.push(d.wt)
    if (!isLogged(d)) continue
    o.logged++
    o.score += score(d, s).total
    if (d.f.length) {
      o.foodDays++
      const p = protein(d)
      o.prot += p
      o.kcal += kcal(d)
      if (p >= s.protein * 0.9) o.proteinDays++
    }
    if (d.done) o.sessions++
    o.cig += d.cig
    o.cups += cupsOf(d)
    o.water += d.w
    o.supp += suppCount(d)
    for (const ex of allExercises(s)) o.sets += validSets(d.lift[ex.id]).length
  }
  return o
}

export const avg = (sum: number, n: number): number | null => (n > 0 ? sum / n : null)

export type Delta = { text: string; good: boolean | null }
export function delta(cur: number | null, prev: number | null, lowerBetter = false, decimals = false): Delta {
  if (cur == null || prev == null) return { text: '', good: null }
  const d = cur - prev
  if (Math.abs(d) < (decimals ? 0.05 : 0.5)) return { text: 'Same as the period before', good: null }
  const mag = decimals ? Math.round(Math.abs(d) * 10) / 10 : Math.round(Math.abs(d))
  return { text: `${d > 0 ? 'Up' : 'Down'} ${mag} on the period before`, good: lowerBetter ? d < 0 : d > 0 }
}

export type Series = (number | null)[]

/** One value per day for the last n days, null when nothing was logged that day. */
export function dailySeries(days: Days, s: Settings, end: string, n: number) {
  const keys = winKeys(end, n)
  const pick = <T,>(f: (k: string) => T | null): (T | null)[] => keys.map(f)
  const logged = (k: string) => isLogged(days[k])
  return {
    keys,
    score: pick((k) => (logged(k) ? score(days[k], s).total : null)),
    protein: pick((k) => (days[k]?.f.length ? Math.round(protein(days[k])) : null)),
    kcal: pick((k) => (days[k]?.f.length ? Math.round(kcal(days[k])) : null)),
    volume: pick((k) => { const v = sessionVolume(days, s, k); return v > 0 ? v : null }),
    water: pick((k) => (logged(k) ? days[k].w : null)),
    cups: pick((k) => (logged(k) ? cupsOf(days[k]) : null)),
    cig: pick((k) => (logged(k) ? days[k].cig : null)),
    sleep: pick((k) => (days[k]?.sleep && days[k].sleep! > 0 ? days[k].sleep : null)),
    weight: pick((k) => (days[k]?.wt && days[k].wt! > 0 ? days[k].wt : null)),
  }
}

export function badgeStats(days: Days, s: Settings, streakBest: number) {
  const keys = Object.keys(days).sort()
  const sessions = keys.filter((k) => days[k].done).length
  const proteinDays = keys.filter((k) => protein(days[k]) >= s.protein * 0.9).length
  const capDays = keys.filter((k) => isLogged(days[k]) && days[k].cig <= s.cig).length
  let prs = 0
  for (const ex of allExercises(s)) {
    let best = 0
    for (const k of keys) {
      const b = dayBest(days[k].lift[ex.id])
      if (b > best) {
        if (best > 0) prs++
        best = b
      }
    }
  }
  const anyLogged = keys.some((k) => isLogged(days[k]))
  return { sessions, proteinDays, capDays, prs, anyLogged, streakBest }
}

export const lastNDaysEnd = (today: string) => addDays(today, 0)
