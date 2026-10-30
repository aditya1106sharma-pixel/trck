import { STREAK_MIN, SUPPLEMENTS } from './catalog'
import { addDays, diffDays, parseKey, weekStart } from './dates'
import type { Day, FoodEntry, Settings } from './types'

/** kcal from macros, used only when an item has no stated calories. */
export const kcalOf = (x: { p?: number; cb?: number; f?: number; k?: number }): number =>
  x.k && x.k > 0 ? x.k : Math.round(4 * (x.p ?? 0) + 4 * (x.cb ?? 0) + 9 * (x.f ?? 0))

export const protein = (d: Day) => d.f.reduce((a, x) => a + x.p * x.q, 0)
export const fatG = (d: Day) => d.f.reduce((a, x) => a + (x.f ?? 0) * x.q, 0)
export const carbG = (d: Day) => d.f.reduce((a, x) => a + (x.cb ?? 0) * x.q, 0)
export const kcal = (d: Day) => d.f.reduce((a, x) => a + x.k * x.q, 0)
export const cupsOf = (d: Day) => d.f.reduce((a, x) => a + (x.c ? x.q : 0), 0)
export const suppCount = (d: Day) => SUPPLEMENTS.filter((s) => d.s[s.id]).length

export const carbTarget = (s: Settings) => Math.max(0, Math.round((s.kcal - 4 * s.protein - 9 * s.fat) / 4))

export function isLogged(d: Day | undefined): boolean {
  return !!d && (d.f.length > 0 || suppCount(d) > 0 || d.w > 0 || d.done)
}

export type Score = { p: number; s: number; w: number; t: number; cg: number; cp: number; total: number }

/** 100 points: protein 30, training 20, supplements 20, habits 20, water 10. */
export function score(d: Day | undefined, s: Settings): Score {
  if (!d) return { p: 0, s: 0, w: 0, t: 0, cg: 0, cp: 0, total: 0 }
  const logged = isLogged(d)
  const p = Math.round(Math.min(1, protein(d) / s.protein) * 30)
  const sp = suppCount(d) * 5
  const w = Math.round(Math.min(1, d.w / s.water) * 10)
  const t = d.done ? 20 : d.cardio >= 20 ? 10 : 0
  const cg = logged && d.cig <= s.cig ? 10 : 0
  const cp = logged && cupsOf(d) <= s.cups ? 10 : 0
  return { p, s: sp, w, t, cg, cp, total: p + sp + w + t + cg + cp }
}

export type Days = Record<string, Day>

export function streaks(days: Days, s: Settings, today: string): { cur: number; best: number } {
  const ok = (k: string) => !!days[k] && score(days[k], s).total >= STREAK_MIN
  let cur = 0
  let k = today
  if (!ok(k)) k = addDays(today, -1)
  while (ok(k)) {
    cur++
    k = addDays(k, -1)
  }
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const key of Object.keys(days).sort()) {
    if (ok(key)) {
      run = prev && diffDays(key, prev) === 1 ? run + 1 : 1
      prev = key
      best = Math.max(best, run)
    } else {
      run = 0
      prev = null
    }
  }
  return { cur, best: Math.max(best, cur) }
}

export const LEVELS = [
  { kg: 5, xp: 0 },
  { kg: 10, xp: 600 },
  { kg: 15, xp: 1500 },
  { kg: 20, xp: 2800 },
  { kg: 25, xp: 4200 },
]

export function level(days: Days, s: Settings) {
  const xp = Object.values(days).reduce((a, d) => a + score(d, s).total, 0)
  let i = 0
  LEVELS.forEach((l, j) => { if (xp >= l.xp) i = j })
  const next = LEVELS[i + 1]
  const pct = next ? Math.round(((xp - LEVELS[i].xp) / (next.xp - LEVELS[i].xp)) * 100) : 100
  return { xp, cur: LEVELS[i], next, pct }
}

export function sessionsInWeek(days: Days, k: string): number {
  const start = weekStart(k)
  let n = 0
  for (let i = 0; i < 7; i++) if (days[addDays(start, i)]?.done) n++
  return n
}

/** Weekday index helper kept here so screens do not reach into Date. */
export const weekdayIndex = (k: string) => (parseKey(k).getDay() + 6) % 7

export type Expanded = Pick<FoodEntry, 'n' | 'q' | 'p' | 'f' | 'cb' | 'k' | 't'>

/** Built meals split into their ingredients so analysis can see the oil and cheese. */
export function expand(d: Day): Expanded[] {
  const out: Expanded[] = []
  for (const x of d.f) {
    if (x.parts) {
      for (const pt of x.parts) out.push({ n: pt.n, q: pt.q * x.q, p: pt.p, f: pt.f, cb: pt.cb, k: pt.k, t: pt.t })
    } else out.push({ n: x.n, q: x.q, p: x.p, f: x.f, cb: x.cb, k: x.k, t: x.t })
  }
  return out
}
