// The trainer's answers as cards. A reply (from Claude, pasted back) is read strictly: bad JSON, unknown muscles and absurd
// numbers never reach the log. A reply that is not JSON still shows as a note, so the person is never left with nothing.
import { CATALOG, MUSCLES, muscleLabel } from './catalog'
import { addDays, fmt } from './dates'
import { allExercises } from './muscles'
import { blankDay, type AppData, type Day, type Exercise, type MuscleId, type Settings } from './types'

export const MAX_CARDS = 8
export const MAX_SETS = 10
export const MAX_KG = 500
export const MAX_REPS = 100

export type SetIn = { w: number; r: number }
export type Card =
  | { type: 'exercise'; name: string; muscles: MuscleId[]; summary: string; cues: string[]; safety: string }
  | { type: 'advice'; title: string; body: string; action: 'rest' | 'swap' | 'push' | 'info'; muscles: MuscleId[] }
  | { type: 'log'; lift: string; muscles: MuscleId[]; sets: SetIn[]; day?: string }
  | { type: 'soreness'; muscle: MuscleId; level: 1 | 2 | 3; note: string; day?: string }
  | { type: 'measure'; key: MeasureKey; value: number; day?: string }
  | { type: 'diary'; text: string; day?: string }
  | { type: 'note'; text: string }

/** Cards that change the log. Only these wait for the person to agree. */
export type ChangeCard = Extract<Card, { type: 'log' | 'soreness' | 'measure' | 'diary' }>
export const isChange = (c: Card): c is ChangeCard => c.type === 'log' || c.type === 'soreness' || c.type === 'measure' || c.type === 'diary'

export type MeasureKey = 'wt' | 'waist' | 'chest' | 'arm' | 'thigh' | 'hip'
const MEASURE: Record<MeasureKey, { label: string; unit: string; lo: number; hi: number }> = {
  wt: { label: 'weight', unit: 'kg', lo: 25, hi: 300 }, waist: { label: 'waist', unit: 'cm', lo: 40, hi: 250 },
  chest: { label: 'chest', unit: 'cm', lo: 40, hi: 250 }, arm: { label: 'arm', unit: 'cm', lo: 10, hi: 100 },
  thigh: { label: 'thigh', unit: 'cm', lo: 20, hi: 120 }, hip: { label: 'hip', unit: 'cm', lo: 40, hi: 250 },
}

export type Parsed = { ok: true; cards: Card[]; dropped: number; text?: string } | { ok: false; error: string }

const IDS = new Set<string>(MUSCLES.map((m) => m.id))
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const muscles = (v: unknown): MuscleId[] => (Array.isArray(v) ? v.filter((x): x is MuscleId => typeof x === 'string' && IDS.has(x)).slice(0, 4) : [])
const dayIn = (v: unknown): string | undefined => (typeof v === 'string' && (v === 'today' || v === 'yesterday' || /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : undefined)
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Pulls the JSON object out of a reply that may sit inside a code fence or a sentence. */
function extract(raw: string): unknown {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)
  const body = fence ? fence[1] : raw
  const a = body.indexOf('{')
  const b = body.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('no json')
  return JSON.parse(body.slice(a, b + 1))
}

export function readCard(c: unknown): Card | null {
  if (!c || typeof c !== 'object') return null
  const o = c as Record<string, unknown>
  switch (o.type) {
    case 'exercise': {
      const name = text(o.name, 60)
      if (!name) return null
      const cues = Array.isArray(o.cues) ? o.cues.map((x) => text(x, 140)).filter(Boolean).slice(0, 5) : []
      return { type: 'exercise', name, muscles: muscles(o.muscles), summary: text(o.summary, 300), cues, safety: text(o.safety, 200) }
    }
    case 'advice': {
      const title = text(o.title, 80)
      const body = text(o.body, 500)
      if (!title && !body) return null
      const action = o.action === 'rest' || o.action === 'swap' || o.action === 'push' ? o.action : 'info'
      return { type: 'advice', title: title || 'Advice', body, action, muscles: muscles(o.muscles) }
    }
    case 'log': {
      const lift = text(o.lift, 60)
      const m = muscles(o.muscles)
      const sets = (Array.isArray(o.sets) ? o.sets : []).slice(0, MAX_SETS).flatMap((x): SetIn[] => {
        const w = num((x as { w?: unknown })?.w)
        const r = num((x as { r?: unknown })?.r)
        return w != null && r != null && w > 0 && w <= MAX_KG && r >= 1 && r <= MAX_REPS ? [{ w: Math.round(w * 10) / 10, r: Math.round(r) }] : []
      })
      // A log with no lift name, no muscle to count it under, or no believable set is dropped, never guessed.
      return lift && m.length && sets.length ? { type: 'log', lift, muscles: m, sets, day: dayIn(o.day) } : null
    }
    case 'soreness': {
      const muscle = typeof o.muscle === 'string' && IDS.has(o.muscle) ? (o.muscle as MuscleId) : null
      const level = num(o.level)
      return muscle && (level === 1 || level === 2 || level === 3) ? { type: 'soreness', muscle, level, note: text(o.note, 200), day: dayIn(o.day) } : null
    }
    case 'measure': {
      const key = typeof o.key === 'string' && o.key in MEASURE ? (o.key as MeasureKey) : null
      const value = num(o.value)
      return key && value != null && value >= MEASURE[key].lo && value <= MEASURE[key].hi ? { type: 'measure', key, value: Math.round(value * 10) / 10, day: dayIn(o.day) } : null
    }
    case 'diary': {
      const t = text(o.text, 300)
      return t ? { type: 'diary', text: t, day: dayIn(o.day) } : null
    }
    case 'note': {
      const t = text(o.text, 600)
      return t ? { type: 'note', text: t } : null
    }
    default:
      return null
  }
}

/** Reads a pasted reply. Plain text becomes one note card. Only an empty paste is refused. */
export function parseCoachReply(raw: string): Parsed {
  const trimmed = raw.trim().slice(0, 50_000)
  if (!trimmed) return { ok: false, error: 'Paste the reply first.' }
  let json: unknown
  try { json = extract(trimmed) } catch { return { ok: true, cards: [{ type: 'note', text: trimmed.slice(0, 1200) }], dropped: 0 } }
  const obj = json && typeof json === 'object' ? (json as { cards?: unknown; reply?: unknown }) : {}
  const reply = text(obj.reply, 1500) || undefined
  const list = obj.cards
  if (!Array.isArray(list)) {
    return reply ? { ok: true, cards: [], dropped: 0, text: reply } : { ok: true, cards: [{ type: 'note', text: trimmed.slice(0, 1200) }], dropped: 0 }
  }
  const cards = list.slice(0, MAX_CARDS * 2).map(readCard)
  const good = cards.filter((x): x is Card => !!x).slice(0, MAX_CARDS)
  const dropped = list.length - good.length
  if (!good.length && !reply) return { ok: false, error: 'Nothing in that reply looked right to log or show. Ask again, or paste a plain answer.' }
  return { ok: true, cards: good, dropped, text: reply }
}

/** Which day a change is for. Today, yesterday or a date in the last 30 days. Anything else is null, so it is skipped, never guessed. */
export function resolveDay(day: string | undefined, fallback: string, today: string): string | null {
  if (!day) return fallback
  if (day === 'today') return today
  if (day === 'yesterday') return addDays(today, -1)
  return day <= today && day >= addDays(today, -30) && !Number.isNaN(Date.parse(day)) ? day : null
}

const dayWords = (k: string | null, today: string) => (k == null ? 'a date I could not read' : k === today ? 'today' : k === addDays(today, -1) ? 'yesterday' : fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }))

/** One plain line for the "I am making these changes" list. */
export function describeChange(c: ChangeCard, today: string, fallback = today): string {
  const when = dayWords(resolveDay(c.day, fallback, today), today)
  if (c.type === 'log') return `Log ${c.lift}, ${c.sets.map((x) => `${x.w} kg x ${x.r}`).join(', ')}, for ${when}`
  if (c.type === 'soreness') return `Mark ${muscleLabel(c.muscle).toLowerCase()} sore ${['', 'a little', 'a lot', 'sharp'][c.level]}, for ${when}`
  if (c.type === 'measure') return `Save ${MEASURE[c.key].label} ${c.value} ${MEASURE[c.key].unit}, for ${when}`
  return `Add a note for ${when}: "${c.text}"`
}

/**
 * Applies the agreed changes to a copy of the data. Never overwrites: sets and notes are added, soreness can only go up.
 * A change with a date outside the last 30 days is skipped and counted. Touched days get a new edit time so sync keeps them.
 */
export function applyChanges(data: AppData, cards: Card[], today: string, fallback: string, now: number, newId: () => string): { data: AppData; applied: number; skipped: number } {
  const next = structuredClone(data)
  let applied = 0
  let skipped = 0
  for (const c of cards.filter(isChange).slice(0, MAX_CARDS)) {
    const k = resolveDay(c.day, fallback, today)
    if (!k) { skipped++; continue }
    const d = (next.days[k] ??= blankDay())
    if (c.type === 'log') {
      const found = findLift(c.lift, next.settings)
      const id = ensureLift(next.settings, c.lift, c.muscles, found?.id ?? newId())
      addSets(d, id, c.sets)
      next.su = now
    } else if (c.type === 'soreness') {
      d.sore = { ...d.sore, [c.muscle]: Math.max(d.sore?.[c.muscle] ?? 0, c.level) }
    } else if (c.type === 'measure') {
      if (c.key === 'wt') d.wt = c.value
      else if (c.key === 'waist') d.waist = c.value
      else d.meas = { ...d.meas, [c.key]: c.value }
    } else {
      d.note = d.note ? `${d.note}\n${c.text}` : c.text
    }
    d.u = now
    applied++
  }
  return { data: next, applied, skipped }
}

/** The last few turns, as plain text, for the next question. Cards and photos are left out. */
export function history(thread: { role: 'me' | 'coach'; text?: string }[], max = 8): { role: 'user' | 'model'; text: string }[] {
  return thread.filter((m) => (m.text ?? '').trim()).slice(-max).map((m) => ({ role: m.role === 'me' ? 'user' as const : 'model' as const, text: (m.text ?? '').slice(0, 800) }))
}

/** What went wrong asking the trainer, in words that lead to the Claude app instead of a dead end. */
export const COACH_FAILURE: Record<string, string> = {
  offline: 'You are offline, so the trainer cannot answer now.',
  'signed-out': 'Sign in under Plan, then Sync, to ask the trainer in the app.',
  cap: 'You have used today\'s free AI messages. They reset around 5:30 in the morning.',
  'not-set-up': 'The trainer is not switched on yet.',
  'not-allowed': 'The trainer is switched on only for some accounts, and this one is not on the list.',
  failed: 'The trainer could not answer this time.',
}

const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * The lift a name means: one already in the routine or the catalog, else null. An exact match, or a name that holds the other
 * as whole words when that one has two or more words ("Incline chest press" holds "Chest press"). A bare "Row" or "Press" matches
 * nothing, and two possible matches match nothing, so sets are never logged under the wrong lift. A new lift is made instead.
 */
export function findLift(name: string, s: Settings): Exercise | null {
  const n = norm(name)
  if (!n) return null
  const all = allExercises(s).concat(CATALOG.filter((c) => !allExercises(s).some((e) => e.id === c.id)))
  const exact = all.find((e) => norm(e.n) === n)
  if (exact) return exact
  const holds = (long: string, short: string) => short.split(' ').length >= 2 && ` ${long} `.includes(` ${short} `)
  const near = all.filter((e) => { const m = norm(e.n); return holds(n, m) || holds(m, n) })
  return near.length === 1 ? near[0] : null
}

/** Makes sure a lift exists and is on, so its sets count towards the muscles. Returns its id. Changes the settings draft. */
export function ensureLift(s: Settings, name: string, m: MuscleId[], newId: string): string {
  const found = findLift(name, s)
  if (found) {
    const mine = s.extra.find((e) => e.id === found.id)
    if (mine) mine.off = false
    else if (CATALOG.some((c) => c.id === found.id)) s.extra.push({ ...found, x: true })
    return found.id
  }
  const main = m[0]
  const rest = m.slice(1, 3)
  s.extra.push({ id: newId, n: name.slice(0, 60), m: { [main]: 1, ...Object.fromEntries(rest.map((r) => [r, 0.5])) }, s: 3, lo: 8, hi: 12, inc: 2.5, x: true })
  return newId
}

/** Adds sets to a day under a lift id. Never overwrites sets already logged. Changes the day draft. */
export function addSets(d: Day, id: string, sets: SetIn[]): void {
  const arr = (d.lift[id] ??= [])
  for (const x of sets) arr.push({ w: x.w, r: x.r })
}

export const demoLink = (name: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' form')}`

/** What to say to Claude. The week comes first so the answer can lean on it, and the reply shape is fixed so it can be read back. */
export function claudePrompt(context: string, question: string): string {
  return [
    'You are my strength trainer for a personal gym log. Answer from my week below. I am a beginner doing body recomposition (skinny fat), so be practical, short and plain.',
    '',
    'My week:',
    context,
    '',
    question.trim() ? `My question: ${question.trim().slice(0, 500)}` : 'My question: (see the photo or clip I attached)',
    '',
    'Rules: say what you can see and what you cannot judge. Never say my form is right or wrong with certainty. If I mention sharp pain, swelling or pain that does not ease, tell me to stop and see a doctor. This is not medical advice. If I say I did sets, put them in a log card. Muscle ids to use: ' + MUSCLES.map((m) => m.id).join(', ') + '.',
    '',
    'Reply with JSON only, in this shape (use only the cards you need, at most 6):',
    '{"cards":[',
    ' {"type":"exercise","name":"Pec deck","muscles":["chest"],"summary":"one or two lines on what it is and how it fits my week","cues":["short cue","short cue"],"safety":"one short safety line"},',
    ' {"type":"advice","title":"short title","body":"the advice, citing my week","action":"rest|swap|push|info","muscles":["back"]},',
    ' {"type":"log","lift":"Pec deck","muscles":["chest"],"sets":[{"w":20,"r":12},{"w":20,"r":12}]},',
    ' {"type":"soreness","muscle":"back","level":1,"note":"one line"},',
    ' {"type":"note","text":"anything else"}',
    ']}',
    'Soreness level: 1 a little, 2 a lot, 3 sharp. Weights are kg. Do not add any text outside the JSON.',
  ].join('\n')
}
