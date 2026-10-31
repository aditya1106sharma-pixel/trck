// Next session suggestion. Pure rules from docs/product/prds/PRD-next-session.md.
import { CATALOG, LIFT_EQ, MUSCLES, SUGGEST, TARGET, muscleLabel } from './catalog'
import { addDays } from './dates'
import { dayEffective, hoursLeft, overloadHint, prevSession, routine, validSets, weekEffective, type Effective } from './muscles'
import type { Days } from './score'
import type { Exercise, MuscleId, Settings } from './types'

export const MIN_PER_SET = 3
export const MAX_MIN = 50
// When two muscles are equally short this week, the bigger one goes first, so a full body day never drops legs for arms.
const SIZE: MuscleId[] = ['quads', 'hamstrings', 'back', 'chest', 'glutes', 'shoulders', 'calves', 'triceps', 'biceps', 'core', 'forearms']
const MAX_SETS = Math.floor(MAX_MIN / MIN_PER_SET)

export type PlanLift = {
  id: string
  ex: Exercise
  muscles: MuscleId[] // main muscles it covers today
  reason: string
  target: string
  variation: boolean
  alts: string[] // other available lift ids with the same first main muscle, best first
}
export type StyleKind = 'full' | 'upper-lower' | 'mixed' | 'new'
export type SessionPlan = {
  lifts: PlanLift[]
  sets: number
  minutes: number
  skipped: { mu: MuscleId; why: string }[]
  style: { kind: StyleKind; text: string }
}

const UPPER: MuscleId[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms']
const LOWER: MuscleId[] = ['quads', 'hamstrings', 'glutes', 'calves', 'core']
const NOUN: Partial<Record<MuscleId, string>> = { calves: 'calf' }
const r1 = (n: number) => Math.round(n * 10) / 10
const and = (a: string[]) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
const names = (ms: MuscleId[]) => cap(and(ms.map((m) => muscleLabel(m).toLowerCase())))
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export const mains = (ex: Exercise): MuscleId[] =>
  (Object.entries(ex.m) as [MuscleId, number][]).filter(([, w]) => w === 1).map(([m]) => m)

export const available = (id: string, s: Settings): boolean =>
  !(LIFT_EQ[id] ?? []).some((e) => (s.noEq ?? []).includes(e))

/** Lifts the plan may use: the routine, then catalog lifts not already in it. */
export function pool(s: Settings): Exercise[] {
  const rt = routine(s)
  const ids = new Set(rt.map((e) => e.id))
  return rt.concat(CATALOG.filter((c) => !ids.has(c.id)))
}

export const historyCount = (days: Days, id: string, before: string): number =>
  Object.keys(days).filter((k) => k < before && validSets(days[k].lift[id]).length > 0).length

/** Short target from the overload rule, for example "40 kg x 8". */
export function liftTarget(ex: Exercise, days: Days, today: string): string {
  const last = prevSession(days, ex.id, today)
  const hint = overloadHint(ex, last)
  if (!last || hint.kind === 'first') return `Find a weight for ${ex.lo} reps`
  const w = Math.max(...last.sets.map((x) => x.w))
  if (hint.kind === 'add') return `${r1(w + ex.inc)} kg x ${ex.lo}`
  const best = Math.max(...last.sets.filter((x) => x.w >= w).map((x) => x.r))
  return `${r1(w)} kg x ${Math.min(ex.hi, best + 1)}`
}

/** Sessions in the 28 days before today, classed by which muscles got 2 or more sets. */
export function trainingStyle(days: Days, s: Settings, today: string): SessionPlan['style'] {
  let up = 0, low = 0, full = 0
  for (let i = 1; i <= 28; i++) {
    const eff = dayEffective(days, s, addDays(today, -i))
    const u = UPPER.some((m) => (eff[m] ?? 0) >= 2)
    const l = LOWER.some((m) => (eff[m] ?? 0) >= 2)
    if (u && l) full++
    else if (u) up++
    else if (l) low++
  }
  const n = up + low + full
  if (n < 2) return { kind: 'new', text: 'Not enough sessions yet to tell your style.' }
  const x = Math.round((n / 4) * 2) / 2
  const tail = `about ${x} a week.`
  if (full / n >= 0.6) return { kind: 'full', text: `Your last ${n} sessions look like full body, ${tail}` }
  if ((up + low) / n >= 0.6) return { kind: 'upper-lower', text: `Your last ${n} sessions look like an upper and lower split, ${tail}` }
  return { kind: 'mixed', text: `Your last ${n} sessions are a mix of full body and split days, ${tail}` }
}

type Ctx = {
  days: Days
  s: Settings
  today: string
  week: Effective
  ready: (mu: MuscleId) => boolean
  rtIds: Set<string>
  hist: (id: string) => number
}

/** Lifts for a muscle, best first: routine, then more history, then the suggested variation. */
function ranked(ctx: Ctx, mu: MuscleId, used: Set<string>, first = false): Exercise[] {
  return pool(ctx.s)
    .filter((ex) => (first ? mains(ex)[0] === mu : ex.m[mu] === 1))
    .filter((ex) => !used.has(ex.id) && available(ex.id, ctx.s) && mains(ex).every(ctx.ready))
    .map((ex, i) => ({ ex, i }))
    .sort((a, b) =>
      Number(ctx.rtIds.has(b.ex.id)) - Number(ctx.rtIds.has(a.ex.id)) ||
      ctx.hist(b.ex.id) - ctx.hist(a.ex.id) ||
      Number(SUGGEST[mu] === b.ex.id) - Number(SUGGEST[mu] === a.ex.id) ||
      a.i - b.i)
    .map((x) => x.ex)
}

export function planSession(days: Days, s: Settings, today: string, now: number): SessionPlan {
  // Only days before today, so the plan stays put while tonight's sets are logged.
  const past: Days = Object.fromEntries(Object.entries(days).filter(([k]) => k < today))
  const left = new Map<MuscleId, number | null>(MUSCLES.map((m) => [m.id, hoursLeft(past, s, m.id, now)]))
  const ready = (mu: MuscleId) => { const h = left.get(mu); return h == null || h <= 0 }
  const rtIds = new Set(routine(s).map((e) => e.id))
  const hc = new Map<string, number>()
  const hist = (id: string) => hc.get(id) ?? hc.set(id, historyCount(past, id, today)).get(id) ?? 0
  const ctx: Ctx = { days: past, s, today, week: weekEffective(past, s, today), ready, rtIds, hist }
  const wk = (mu: MuscleId) => r1(ctx.week[mu] ?? 0)

  const skipped: SessionPlan['skipped'] = []
  const cands: { mu: MuscleId; gap: number; since: number }[] = []
  for (const [mu, t] of Object.entries(TARGET) as [MuscleId, [number, number]][]) {
    const h = left.get(mu) ?? null
    if (!ready(mu)) skipped.push({ mu, why: `Recovering, ready in ${Math.ceil(h ?? 0)} h` })
    else if (wk(mu) >= t[1]) skipped.push({ mu, why: 'Done for this week' })
    else cands.push({ mu, gap: Math.max(0, t[0] - wk(mu)), since: h == null ? Infinity : -h })
  }
  cands.sort((a, b) => b.gap - a.gap || SIZE.indexOf(a.mu) - SIZE.indexOf(b.mu) || b.since - a.since)
  const isCand = (mu: MuscleId) => cands.some((c) => c.mu === mu)

  const lifts: PlanLift[] = []
  const used = new Set<string>()
  const proj: Effective = {}
  let sets = 0
  const add = (ex: Exercise, muscles: MuscleId[], reason: string) => {
    lifts.push({ id: ex.id, ex, muscles, reason, target: liftTarget(ex, past, today), variation: !rtIds.has(ex.id), alts: [] })
    used.add(ex.id)
    sets += ex.s
    for (const [m, w] of Object.entries(ex.m) as [MuscleId, number][]) proj[m] = (proj[m] ?? 0) + ex.s * w
  }
  const fits = (ex: Exercise) => (sets + ex.s) * MIN_PER_SET <= MAX_MIN
  const low = (mu: MuscleId) => TARGET[mu]?.[0] ?? 0

  // First pass: one lift for each muscle not yet covered today.
  for (const c of cands) {
    if ((proj[c.mu] ?? 0) >= (c.gap === 0 ? 2 : Math.min(3, c.gap))) continue
    const opts = ranked(ctx, c.mu, used)
    if (!opts.length) { skipped.push({ mu: c.mu, why: 'No lift for your equipment' }); continue }
    const ex = opts.find(fits)
    if (!ex) { skipped.push({ mu: c.mu, why: 'No time today' }); continue }
    const ms = mains(ex).filter(isCand)
    const covers = ms.includes(c.mu) ? ms : [c.mu]
    let reason = `${names(covers)}: ready, ${and(covers.map((m) => `${wk(m)} of ${low(m)}`))} sets this week`
    if (!rtIds.has(ex.id)) {
      const noun = NOUN[c.mu] ?? muscleLabel(c.mu).toLowerCase()
      const hasRoutine = routine(s).some((e) => e.m[c.mu] === 1)
      reason += hasRoutine ? `. Your usual ${noun} lift is not available today.` : `. No ${noun} lift in your routine yet.`
    }
    add(ex, covers, reason)
  }

  // Second pass: a variation for muscles still under the low end, time allowing.
  for (const c of cands) {
    if (!lifts.some((l) => l.ex.m[c.mu] === 1)) continue
    const short = r1(low(c.mu) - wk(c.mu) - (proj[c.mu] ?? 0))
    if (short <= 0) continue
    const ex = ranked(ctx, c.mu, used).filter((e) => !rtIds.has(e.id)).find(fits)
    if (!ex) continue
    add(ex, [c.mu], `${muscleLabel(c.mu)}: still ${short} short of ${low(c.mu)} this week`)
  }

  // Swap options: same first main muscle, ready, available, not chosen, and still inside the time cap.
  for (const l of lifts) {
    const first = mains(l.ex)[0]
    l.alts = first ? ranked(ctx, first, used, true).filter((e) => sets - l.ex.s + e.s <= MAX_SETS).map((e) => e.id) : []
  }
  return { lifts, sets, minutes: sets * MIN_PER_SET, skipped, style: trainingStyle(past, s, today) }
}

/** Put the next swap option in place of lift `i`. The old lift goes to the end so taps cycle. */
export function swapLift(plan: SessionPlan, i: number, days: Days, s: Settings, today: string): SessionPlan {
  const l = plan.lifts[i]
  const id = l?.alts[0]
  const ex = id ? pool(s).find((e) => e.id === id) : undefined
  if (!l || !ex) return plan
  const rt = new Set(routine(s).map((e) => e.id))
  const next: PlanLift = { ...l, id: ex.id, ex, target: liftTarget(ex, days, today), variation: !rt.has(ex.id), alts: [...l.alts.slice(1), l.id] }
  const lifts = plan.lifts.map((x, j) => (j === i ? next : x))
  const sets = lifts.reduce((a, x) => a + x.ex.s, 0)
  return { ...plan, lifts, sets, minutes: sets * MIN_PER_SET }
}

/** Plan ids that are not in the routine yet, so Start this session can add them. */
export const toAdd = (ids: string[], s: Settings): string[] => {
  const rt = new Set(routine(s).map((e) => e.id))
  return ids.filter((id) => !rt.has(id))
}
