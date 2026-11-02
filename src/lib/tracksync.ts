// TRCK-SYNC v1: one line per day, key=value pairs joined by " | ", for moving logs to and from a chat by copy and paste.
// Pure logic, no React and no Node, so the same code can back a screen later.

import { MUSCLES } from './catalog'
import { addDays, keyOf, parseKey, todayKey } from './dates'
import { allExercises, validSets } from './muscles'
import { kcal, protein } from './score'
import { blankDay, CHAT_FIELDS, type AppData, type Day, type Exercise, type FoodEntry, type MuscleId, type Settings } from './types'

export const HEADER = 'TRCK-SYNC v1'

export const KEYS = [
  'date', 'weight_kg', 'sleep_in', 'sleep_out', 'sleep_hrs', 'sleep_q', 'steps', 'protein_g', 'kcal', 'meals',
  'session', 'top_sets', 'gummy', 'energy', 'hunger', 'gut', 'notes',
] as const
export type Key = (typeof KEYS)[number]

/** Keys TRCK has a home for in its own log. These are the ones "missing:" can name. */
export const TRACKED = ['weight_kg', 'sleep_hrs', 'protein_g', 'kcal', 'meals', 'session', 'top_sets', 'notes'] as const
/** Keys the app has no screen for. Imported values are kept in the day's optional `chat` field so they come back out. */
export const CHAT_ONLY = CHAT_FIELDS.filter((k) => k !== 'session')

/** A day's food logged from a chat is one entry with this id, so later imports adjust it instead of adding more. */
export const chatFoodId = (date: string) => `chat-${date}`
export const CHAT_FOOD_NAME = 'Logged in chat'
const isChatFood = (x: FoodEntry, date: string) => x.id === chatFoodId(date)

const LEGS: MuscleId[] = ['quads', 'hamstrings', 'glutes', 'calves']
const MAX_TEXT = 500

// ---------- export ----------

/** Text values cannot hold the separators. */
const clean = (s: string) => s.replace(/\s*\|\s*/g, ' / ').replace(/\s*[\r\n]+\s*/g, ' / ').replace(/\s+/g, ' ').trim()
/** Two decimals at most, the same precision the import accepts, so a value always comes back equal. */
const num = (n: number) => String(Math.round(n * 100) / 100)

/** "pulldown 45x10,10,9; row 40x10,50x8": the weight is written when it changes, reps after it share that weight. */
export function liftText(d: Day, s: Settings): string {
  const parts: string[] = []
  for (const ex of allExercises(s)) {
    const sets = validSets(d.lift[ex.id])
    if (sets.length) parts.push(`${ex.id} ${setsText(sets)}`)
  }
  return parts.join('; ')
}

function hasData(d: Day): boolean {
  return d.f.length > 0 || Object.values(d.s).some(Boolean) || d.w > 0 || d.cig > 0 || d.cardio > 0 || d.done ||
    d.sleep != null || d.wt != null || d.waist != null || d.note.trim() !== '' || Object.values(d.lift).some((a) => validSets(a).length > 0) ||
    !!d.chat && Object.keys(d.chat).length > 0
}

/** What the day's training was, from the lifts logged. "rest" for a day with data and no training. */
export function sessionOf(d: Day, s: Settings): string | undefined {
  if (d.chat?.session) return d.chat.session
  const main = new Set<MuscleId>()
  for (const ex of allExercises(s)) {
    if (!validSets(d.lift[ex.id]).length) continue
    for (const [m, w] of Object.entries(ex.m) as [MuscleId, number][]) if (w >= 1) main.add(m)
  }
  if (main.size) {
    const out: string[] = []
    for (const m of MUSCLES) {
      if (!main.has(m.id)) continue
      if (LEGS.includes(m.id)) { if (!out.includes('legs')) out.push('legs') } else out.push(m.id)
    }
    return out.join('+')
  }
  if (d.done) return 'training'
  if (d.cardio > 0) return `cardio ${d.cardio} min`
  return hasData(d) ? 'rest' : undefined
}

/** The day as TRCK-SYNC values. Only keys with data appear. */
export function dayValues(d: Day, date: string, s: Settings): Partial<Record<Key, string>> {
  const v: Partial<Record<Key, string>> = { date }
  if (d.wt != null && d.wt > 0) v.weight_kg = num(d.wt)
  if (d.chat?.sleep_in) v.sleep_in = d.chat.sleep_in
  if (d.chat?.sleep_out) v.sleep_out = d.chat.sleep_out
  if (d.sleep != null && d.sleep > 0) v.sleep_hrs = num(d.sleep)
  if (d.chat?.sleep_q) v.sleep_q = d.chat.sleep_q
  if (d.chat?.steps) v.steps = d.chat.steps
  const p = protein(d)
  if (p > 0) v.protein_g = num(p)
  const k = kcal(d)
  if (k > 0) v.kcal = num(k)
  const meals = mealsText(d, date)
  if (meals) v.meals = meals
  const ses = sessionOf(d, s)
  if (ses) v.session = ses
  const lift = liftText(d, s)
  if (lift) v.top_sets = lift
  for (const key of ['gummy', 'energy', 'hunger', 'gut'] as const) if (d.chat?.[key]) v[key] = d.chat[key]
  if (d.note.trim()) v.notes = clean(d.note)
  return v
}

export function mealsText(d: Day, date: string): string {
  return clean(d.f
    .filter((x) => !(isChatFood(x, date) && x.n === CHAT_FOOD_NAME))
    .map((x) => (isChatFood(x, date) || x.q === 1 ? x.n : `${x.n} x${num(x.q)}`))
    .join(', '))
}

export function exportLine(d: Day | undefined, date: string, s: Settings): string {
  const v = dayValues(d ?? blankDay(), date, s)
  const parts = KEYS.filter((k) => v[k] !== undefined).map((k) => `${k}=${v[k]}`)
  const missing = TRACKED.filter((k) => v[k] === undefined && !(k === 'top_sets' && v.session === 'rest'))
  if (missing.length) parts.push(`missing: ${missing.join(', ')}`)
  return parts.join(' | ')
}

/** The last `n` days ending today, oldest first, header on top. */
export function exportSync(data: AppData, n = 2, today = todayKey()): string {
  const lines = [HEADER]
  for (let i = n - 1; i >= 0; i--) {
    const k = addDays(today, -i)
    lines.push(exportLine(data.days[k], k, data.settings))
  }
  return lines.join('\n')
}

// ---------- parse ----------

export type SetIn = { w: number; r: number }
export type Lift = { id: string; sets: SetIn[] }
export type Parsed = { date: string; v: Partial<Record<Key, string>>; lifts: Lift[] }

const INT = /^\d+$/
const DEC = /^\d+(\.\d{1,2})?$/
const rangeNum = (lo: number, hi: number, whole = false) => (x: string): string | null => {
  if (!(whole ? INT : DEC).test(x)) return whole ? 'a whole number' : 'a number with at most 2 decimals'
  const n = Number(x)
  return n < lo || n > hi ? `between ${lo} and ${hi}` : null
}
const clock = (x: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(x)
  return m && Number(m[1]) <= 23 && Number(m[2]) <= 59 ? null : 'a time as HH:MM, like 23:40'
}
const text = (x: string) => (x.length > MAX_TEXT ? `at most ${MAX_TEXT} characters` : null)
const scale = rangeNum(1, 5, true)

const RULES: Record<Exclude<Key, 'date' | 'top_sets'>, (x: string) => string | null> = {
  weight_kg: rangeNum(20, 300), sleep_in: clock, sleep_out: clock, sleep_hrs: rangeNum(0, 24), sleep_q: scale,
  steps: rangeNum(0, 200000, true), protein_g: rangeNum(0, 600), kcal: rangeNum(0, 10000), meals: text,
  session: text, gummy: text, energy: scale, hunger: scale, gut: scale, notes: text,
}

export function validDate(x: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  return keyOf(parseKey(x)) === x
}

function findExercise(name: string, s: Settings): Exercise | undefined {
  const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
  const all = allExercises(s)
  return all.find((e) => e.id.toLowerCase() === n) ?? all.find((e) => e.n.toLowerCase() === n)
}

/** Reads "pulldown 45x10,10,9; row 40x10,10,8". Each exercise must be in the routine. */
export function parseLifts(x: string, s: Settings): { lifts: Lift[] } | { error: string } {
  const lifts: Lift[] = []
  for (const chunk of x.split(';').map((c) => c.trim()).filter(Boolean)) {
    const sp = chunk.lastIndexOf(' ')
    if (sp < 1) return { error: `"${chunk}" needs a lift and its sets, like "pulldown 45x10,10,9"` }
    const name = chunk.slice(0, sp)
    const ex = findExercise(name, s)
    if (!ex) return { error: `"${name}" is not a lift in your routine. Use its id (${allExercises(s).map((e) => e.id).join(', ')}) or add it in the app first` }
    if (lifts.some((l) => l.id === ex.id)) return { error: `"${name}" is listed twice` }
    const sets: SetIn[] = []
    let w: number | null = null
    for (const tok of chunk.slice(sp + 1).split(',')) {
      const m = /^(?:(\d+(?:\.\d{1,2})?)x)?(\d+)$/.exec(tok.trim())
      if (!m) return { error: `"${tok}" in "${chunk}" should be weight x reps, like 45x10, or just reps after the first set` }
      if (m[1] !== undefined) w = Number(m[1])
      if (w === null) return { error: `the first set of "${name}" needs a weight, like 45x10` }
      const r = Number(m[2])
      if (w <= 0 || w > 500) return { error: `weight ${w} for "${name}" should be between 0 and 500 kg` }
      if (r < 1 || r > 100) return { error: `${r} reps for "${name}" should be between 1 and 100` }
      sets.push({ w, r })
    }
    lifts.push({ id: ex.id, sets })
  }
  return { lifts }
}

export type ParseResult = { ok: true; days: Parsed[] } | { ok: false; errors: string[] }

/** Checks every line. Any error means nothing is imported. Code fences and the "missing:" note are skipped. */
export function parseSync(input: string, s: Settings, today = todayKey()): ParseResult {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('```'))
  const errors: string[] = []
  if (lines[0] !== HEADER) return { ok: false, errors: [`The first line must be "${HEADER}".`] }
  const days: Parsed[] = []
  lines.slice(1).forEach((line, i) => {
    const at = `Line ${i + 2}`
    const v: Partial<Record<Key, string>> = {}
    let lifts: Lift[] = []
    for (const seg of line.split(' | ').map((x) => x.trim())) {
      if (/^missing:/.test(seg)) continue
      const eq = seg.indexOf('=')
      if (eq < 1) { errors.push(`${at}: "${seg}" is not key=value.`); continue }
      const key = seg.slice(0, eq).trim()
      const val = seg.slice(eq + 1).trim()
      if (!(KEYS as readonly string[]).includes(key)) { errors.push(`${at}: unknown key "${key}". Allowed: ${KEYS.join(', ')}.`); continue }
      const k = key as Key
      if (v[k] !== undefined) { errors.push(`${at}: "${k}" appears twice.`); continue }
      if (val === '') continue // a blank is no data, and never clears a stored value
      if (k === 'date') {
        if (!validDate(val)) errors.push(`${at}: date "${val}" must be a real date as YYYY-MM-DD.`)
        else if (val > today) errors.push(`${at}: date ${val} is after today (${today}).`)
      } else if (k === 'top_sets') {
        const r = parseLifts(val, s)
        if ('error' in r) errors.push(`${at}: top_sets: ${r.error}.`)
        else lifts = r.lifts
      } else {
        const why = RULES[k](val)
        if (why) errors.push(`${at}: ${k}=${val} should be ${why}.`)
      }
      v[k] = val
    }
    if (!v.date) { errors.push(`${at}: needs a date=YYYY-MM-DD.`); return }
    if (days.some((d) => d.date === v.date)) { errors.push(`${at}: date ${v.date} appears on more than one line.`); return }
    days.push({ date: v.date, v, lifts })
  })
  if (lines.length < 2) errors.push('There are no day lines after the header.')
  return errors.length ? { ok: false, errors } : { ok: true, days }
}

// ---------- plan and apply ----------

export type Change = { date: string; field: string; from?: string; to: string; newDay?: boolean }
export type Conflict = { id: string; date: string; field: string; trck: string; pasted: string }
export type Plan = { adds: Change[]; conflicts: Conflict[]; notes: string[]; days: Parsed[] }

/** Numbers are compared as numbers, text as the exported text, so a fresh export always matches. */
function same(key: Key, a: string, b: string): boolean {
  if (key in RULES && RULES[key as keyof typeof RULES] === text) return clean(a) === clean(b)
  if (DEC.test(a) && DEC.test(b)) return Number(a) === Number(b)
  return a === b
}

function setsText(sets: SetIn[]): string {
  let last: number | null = null
  return sets.map((x) => { const t = x.w === last ? String(x.r) : `${num(x.w)}x${x.r}`; last = x.w; return t }).join(',')
}

/** Works out what an import would do, without changing anything. */
export function planImport(data: AppData, days: Parsed[]): Plan {
  const plan: Plan = { adds: [], conflicts: [], notes: [], days }
  for (const p of days) {
    const stored = data.days[p.date]
    const newDay = !stored
    const d = stored ?? blankDay()
    const cur = dayValues(d, p.date, data.settings)
    const realFood = d.f.some((x) => !isChatFood(x, p.date))
    for (const key of KEYS) {
      if (key === 'date' || key === 'top_sets') continue
      const to = p.v[key]
      if (to === undefined) continue
      const from = cur[key]
      if (from !== undefined && same(key, from, to)) continue
      if (key === 'meals' && realFood) {
        if (from !== undefined) plan.notes.push(`${p.date} meals: kept "${from}". Meals come from the foods logged in TRCK, so change them in the app.`)
        else plan.notes.push(`${p.date} meals: not added, because this day has foods logged in TRCK.`)
        continue
      }
      if (from === undefined) plan.adds.push({ date: p.date, field: key, to, newDay })
      else plan.conflicts.push({ id: `${p.date}:${key}`, date: p.date, field: key, trck: from, pasted: to })
    }
    for (const l of p.lifts) {
      const have = validSets(d.lift[l.id])
      const to = setsText(l.sets)
      if (!have.length) plan.adds.push({ date: p.date, field: `top_sets ${l.id}`, to, newDay })
      else if (setsText(have) !== to) plan.conflicts.push({ id: `${p.date}:top_sets:${l.id}`, date: p.date, field: `top_sets ${l.id}`, trck: setsText(have), pasted: to })
    }
  }
  // A total can only be raised by the chat entry: never take food away that was logged in the app.
  plan.conflicts = plan.conflicts.filter((c) => {
    if (c.field !== 'protein_g' && c.field !== 'kcal') return true
    const d = data.days[c.date]
    const others = d.f.filter((x) => !isChatFood(x, c.date))
    const base = c.field === 'protein_g' ? others.reduce((a, x) => a + x.p * x.q, 0) : others.reduce((a, x) => a + x.k * x.q, 0)
    if (Number(c.pasted) >= base - 0.005) return true
    plan.notes.push(`${c.date} ${c.field}: kept ${c.trck}. ${c.pasted} is less than the foods logged in TRCK (${num(base)}), so lower it in the app.`)
    return false
  })
  return plan
}

/** Sets the chat food entry so the day's total for `field` equals `target`. Other entries are never touched. */
function setFoodTotal(d: Day, date: string, field: 'p' | 'k', target: number) {
  let e = d.f.find((x) => isChatFood(x, date))
  if (!e) { e = { id: chatFoodId(date), n: CHAT_FOOD_NAME, p: 0, k: 0, q: 1, t: 'chat' }; d.f.push(e) }
  const others = d.f.filter((x) => x !== e).reduce((a, x) => a + x[field] * x.q, 0)
  e.q = 1
  e[field] = Math.max(0, Math.round((target - others) * 100) / 100)
}

function setValue(d: Day, date: string, key: string, val: string, lifts: Lift[]) {
  if (key.startsWith('top_sets ')) {
    const id = key.slice('top_sets '.length)
    const l = lifts.find((x) => x.id === id)
    if (l) d.lift[id] = l.sets.map((x) => ({ w: x.w, r: x.r }))
    return
  }
  switch (key as Key) {
    case 'weight_kg': d.wt = Number(val); return
    case 'sleep_hrs': d.sleep = Number(val); return
    case 'protein_g': setFoodTotal(d, date, 'p', Number(val)); return
    case 'kcal': setFoodTotal(d, date, 'k', Number(val)); return
    case 'meals': {
      const e = d.f.find((x) => isChatFood(x, date))
      if (e) e.n = val
      else d.f.push({ id: chatFoodId(date), n: val, p: 0, k: 0, q: 1, t: 'chat' })
      return
    }
    case 'notes': d.note = val; return
    default:
      if ((CHAT_FIELDS as readonly string[]).includes(key)) d.chat = { ...(d.chat ?? {}), [key]: val }
  }
}

/**
 * Applies the adds, and each conflict listed in `take` with the pasted value. Every other conflict keeps TRCK.
 * Returns new data and the dates that changed. Days that did not change keep their edit time, so sync is not woken.
 */
export function applyImport(data: AppData, plan: Plan, take: Set<string>, now = Date.now()): { data: AppData; changed: string[] } {
  const next: AppData = { ...data, days: { ...data.days } }
  const changed: string[] = []
  for (const p of plan.days) {
    const edits = [
      ...plan.adds.filter((a) => a.date === p.date).map((a) => [a.field, a.to] as const),
      ...plan.conflicts.filter((c) => c.date === p.date && take.has(c.id)).map((c) => [c.field, c.pasted] as const),
    ]
    if (!edits.length) continue
    const d = structuredClone(data.days[p.date] ?? blankDay())
    // meals first, so a new chat food entry carries its name before totals are set
    edits.sort((a, b) => (a[0] === 'meals' ? -1 : b[0] === 'meals' ? 1 : 0))
    for (const [field, val] of edits) setValue(d, p.date, field, val, p.lifts)
    d.u = now
    next.days[p.date] = d
    changed.push(p.date)
  }
  return { data: next, changed }
}

/** The dry run, in plain lines. */
export function describePlan(plan: Plan): string[] {
  const out: string[] = []
  const newDays = [...new Set(plan.adds.filter((a) => a.newDay).map((a) => a.date))]
  if (newDays.length) out.push(`New days: ${newDays.join(', ')}`)
  if (plan.adds.length) {
    out.push('Will add:')
    for (const a of plan.adds) out.push(`  ${a.date} ${a.field} = ${a.to}`)
  }
  if (plan.conflicts.length) {
    out.push('Differs from TRCK (nothing changes unless you pick the pasted value):')
    plan.conflicts.forEach((c, i) => out.push(`  ${i + 1}. ${c.date} ${c.field}: TRCK has "${c.trck}", pasted "${c.pasted}"`))
  }
  for (const n of plan.notes) out.push(`Note: ${n}`)
  if (!plan.adds.length && !plan.conflicts.length) out.push('Nothing to change. TRCK already has all of this.')
  return out
}
