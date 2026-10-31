// Photo meal logging: everything here is pure so it can be tested. The photo itself never reaches this file.
// Numbers from a photo are rough. The person checks every item before anything is logged.
import { FOODS, INGREDIENTS } from './catalog'
import { kcalOf } from './score'
import type { Food, FoodEntry, Part } from './types'

export const PHOTO_CAP = 20 // photos a person can read a day; the Edge Function enforces it
export const MAX_SIDE = 1024 // longest side of the photo sent, in px
export const MAX_ITEMS = 15
export const MAX_ITEM_KCAL = 3000 // one item over this is not a real portion
export const MAX_ITEM_GRAMS = 2000
export const MAX_FAT_TSP = 10
const FAT_PER_TSP = 4.5 // g, matches Cooking oil in INGREDIENTS

/** Fits a photo inside a square of `max` px, keeping its shape. Never makes it bigger. */
export function fitSize(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 }
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.round(w * k), h: Math.round(h * k) }
}

/** One item on the review screen. Values are per unit, like a Part, so the same stepper edits it. */
export type PhotoPart = Part & { conf: number; mine: boolean; g: number }
export type PhotoReply = { parts: PhotoPart[]; questions: string[]; fatTsp: number; dropped: string[] }
export type Parsed = { ok: true; reply: PhotoReply } | { ok: false; error: string }

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const r1 = (n: number) => Math.round(n * 10) / 10
const half = (n: number) => Math.max(0.5, Math.round(n * 2) / 2)

function confOf(v: unknown): number {
  if (typeof v === 'string') {
    const w = v.trim().toLowerCase()
    if (w === 'high') return 0.85
    if (w === 'medium') return 0.6
    if (w === 'low') return 0.35
  }
  const n = num(v)
  if (n == null) return 0.5
  const c = n > 1 && n <= 100 && Number.isInteger(n) ? n / 100 : n // some replies use percent
  return Math.max(0, Math.min(1, c))
}

/** Pulls the JSON object out of a reply that may be wrapped in a code fence or a sentence. */
export function extractJson(text: string): unknown {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = fence ? fence[1] : text
  const a = body.indexOf('{')
  const b = body.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('no json')
  return JSON.parse(body.slice(a, b + 1))
}

const FAT_NAME = /^(cooking\s+)?(oil|ghee|butter|refined oil|mustard oil|olive oil)$/i
const FAT_Q = /\b(oil|ghee|butter|sauce|mayo|mayonnaise|cream|dressing|tadka|tempering)\b/i

/**
 * Reads the model's (or Claude's) reply strictly. Bad JSON, missing fields and absurd values never reach the log.
 * Items over 3,000 kcal or 2 kg are dropped and named in `dropped`. kcal that disagrees badly with the macros is
 * replaced by the kcal from the macros, because the macros are the finer estimate.
 */
export function parseReply(text: string): Parsed {
  let raw: unknown
  try { raw = extractJson(text) } catch { return { ok: false, error: 'The reply was not readable. Try again, or copy a prompt for Claude.' } }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { items?: unknown }).items)) {
    return { ok: false, error: 'The reply had no list of foods. Try again, or copy a prompt for Claude.' }
  }
  const j = raw as { items: unknown[]; questions?: unknown; fat_tsp?: unknown }
  const parts: PhotoPart[] = []
  const dropped: string[] = []
  let fatTsp = Math.max(0, Math.min(MAX_FAT_TSP, num(j.fat_tsp) ?? 0))

  for (const it of j.items.slice(0, MAX_ITEMS * 2)) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim().replace(/\s+/g, ' ').slice(0, 60) : ''
    if (!name) continue
    const g = num(o.grams)
    const p = num(o.protein)
    const f = num(o.fat)
    const cb = num(o.carbs)
    let k = num(o.kcal)
    if (g == null || p == null || f == null || cb == null || g <= 0 || p < 0 || f < 0 || cb < 0) { dropped.push(name); continue }
    if (FAT_NAME.test(name)) { fatTsp = Math.min(MAX_FAT_TSP, fatTsp + g / FAT_PER_TSP); continue }
    const fromMacros = 4 * p + 4 * cb + 9 * f
    if (k == null || k <= 0 || (fromMacros > 0 && Math.abs(k - fromMacros) / fromMacros > 0.35)) k = fromMacros
    if (p + f + cb > g * 1.05) { dropped.push(name); continue } // macros cannot weigh more than the food
    if (g > MAX_ITEM_GRAMS || k > MAX_ITEM_KCAL || p > 300 || f > 300 || cb > 600 || k <= 0) { dropped.push(name); continue }
    const count = num(o.count)
    parts.push({
      n: name, p: r1(p), f: r1(f), cb: r1(cb), k: Math.round(k), q: 1, g: Math.round(g),
      u: count && count >= 1 && count <= 20 ? `${Math.round(count)} · ${Math.round(g)} g` : `${Math.round(g)} g`,
      t: 'photo', conf: confOf(o.confidence), mine: false,
    })
    if (parts.length >= MAX_ITEMS) break
  }
  if (!parts.length) return { ok: false, error: dropped.length ? `Nothing believable in that reply (${dropped.join(', ')}). Try again, or add it by hand.` : 'No food found in the photo. Try again, or add it by hand.' }

  const questions = (Array.isArray(j.questions) ? j.questions : [])
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, 140))
    .filter((x) => x && !FAT_Q.test(x)) // the fat question is always asked by the app itself
    .slice(0, 3)
  return { ok: true, reply: { parts, questions, fatTsp: Math.round(fatTsp * 2) / 2, dropped } }
}

// Your own values win. Names the model may use for foods on the list.
const ALIAS: Record<string, string> = {
  chapati: 'roti', chapathi: 'roti', phulka: 'roti', rotis: 'roti', chapatis: 'roti',
  eggs: 'egg', 'boiled egg': 'egg', 'boiled eggs': 'egg', 'whole egg': 'egg',
  daal: 'dal', dhal: 'dal', 'dal tadka': 'dal', 'yellow dal': 'dal',
  'steamed rice': 'rice', 'white rice': 'rice', 'cooked rice': 'rice', chawal: 'rice',
  dahi: 'curd', yogurt: 'curd', yoghurt: 'curd',
  'chicken breast': 'chicken', 'grilled chicken': 'chicken', 'boiled chicken': 'chicken',
  'egg whites': 'egg white', bananas: 'banana', 'paneer cubes': 'paneer',
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

/** The food on the person's list that this item is, if any. Their own foods come before the built in ones. */
export function matchFood(name: string, mine: Food[]): Food | null {
  const n = norm(name)
  const key = ALIAS[n] ?? n
  return mine.concat(FOODS).find((f) => norm(f.n) === key || norm(f.n) === n) ?? null
}

/** Grams in one unit of a food, when its unit says so ("100 g cooked", "250 ml"). */
export function gramsPerUnit(u: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(g|ml)\b/i.exec(u.trim())
  return m ? Number(m[1]) : null
}

/**
 * Swaps the model's numbers for the person's own where the item is on their list.
 * Weighed units scale by grams, pieces scale by the count. With neither, the model's numbers stay.
 */
export function applyMine(parts: PhotoPart[], mine: Food[]): PhotoPart[] {
  return parts.map((x) => {
    const f = matchFood(x.n, mine)
    if (!f) return x
    const per = gramsPerUnit(f.u)
    const count = /^(\d+) · /.exec(x.u ?? '')?.[1]
    const perPiece = /^1\s/.test(f.u) // "1 medium" scales by pieces; "2 small" or "1 cup" of rice do not
    const q = per ? x.g / per : count && perPiece && !/\bcup|bowl|katori|ladle|tbsp|tsp\b/i.test(f.u) ? Number(count) : null
    if (!q) return x
    return { ...x, n: f.n, p: f.p, f: f.f, cb: f.cb, k: kcalOf(f), q: half(q), u: f.u, t: f.t, mine: true, conf: Math.max(x.conf, 0.8) }
  })
}

/** How unsure an item is, as a share of its kcal. Your own values are close to exact. */
export function spreadOf(x: { conf: number; mine: boolean }): number {
  if (x.mine) return 0.1
  return x.conf >= 0.8 ? 0.15 : x.conf >= 0.5 ? 0.3 : 0.45
}

const fatPart = (): Food => INGREDIENTS.find((f) => f.n === 'Cooking oil')!

/** A range, not a false exact number. The added fat is counted exactly because the person told us. */
export function mealRange(parts: PhotoPart[], fatTsp: number): { lo: number; hi: number; p: number } {
  const fat = kcalOf(fatPart()) * fatTsp
  let lo = fat
  let hi = fat
  let p = 0
  for (const x of parts) {
    const k = x.k * x.q
    lo += k * (1 - spreadOf(x))
    hi += k * (1 + spreadOf(x))
    p += x.p * x.q
  }
  const ten = (n: number) => Math.round(n / 10) * 10
  return { lo: ten(lo), hi: ten(hi), p: Math.round(p) }
}

/** kcal weighted confidence for the whole meal, 0 to 1. */
export function mealConf(parts: PhotoPart[]): number {
  const tot = parts.reduce((a, x) => a + x.k * x.q, 0)
  if (!tot) return 0
  return Math.round((parts.reduce((a, x) => a + x.conf * x.k * x.q, 0) / tot) * 100) / 100
}

/** The parts that get stored: plain Parts, with the added fat as its own line so the Fuel tab can see it. */
export function mealParts(parts: PhotoPart[], fatTsp: number): Part[] {
  const out: Part[] = parts.filter((x) => x.q > 0).map(({ n, p, f, cb, k, q, t, u }) => ({ n, p, f, cb, k, q, t, u }))
  if (fatTsp > 0) {
    const o = fatPart()
    out.push({ n: o.n, p: o.p, f: o.f, cb: o.cb, k: kcalOf(o), q: fatTsp, t: o.t, u: o.u })
  }
  return out
}

/** The logged entry: a built meal marked as from a photo. Only new optional fields are used. */
export function photoEntry(id: string, name: string, parts: PhotoPart[], fatTsp: number): FoodEntry {
  const ps = mealParts(parts, fatTsp)
  const s = ps.reduce((a, x) => ({ p: a.p + x.p * x.q, f: a.f + x.f * x.q, cb: a.cb + x.cb * x.q, k: a.k + x.k * x.q }), { p: 0, f: 0, cb: 0, k: 0 })
  return { id, n: name.trim() || 'Photo meal', p: r1(s.p), f: r1(s.f), cb: r1(s.cb), k: Math.round(s.k), q: 1, m: 1, parts: ps, src: 'photo', conf: mealConf(parts) }
}

export const defaultName = (parts: PhotoPart[]) => {
  const names = parts.slice(0, 2).map((x) => x.n)
  return names.join(' and ') + (parts.length > 2 ? ' and more' : '')
}

export type Failure = 'offline' | 'signed-out' | 'cap' | 'not-set-up' | 'not-allowed' | 'failed'

/** What went wrong, from the Edge Function's answer. Every case leads to the Claude fallback, never a dead end. */
export function failureOf(status: number, body: unknown): Failure {
  const e = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined
  if (status === 0) return 'offline'
  if (status === 401 || e === 'signed-out') return 'signed-out'
  if (status === 429 || e === 'cap') return 'cap'
  if (status === 403 || e === 'not-allowed') return 'not-allowed'
  if (status === 404 || e === 'no-key') return 'not-set-up'
  return 'failed'
}

export const FAILURE_TEXT: Record<Failure, string> = {
  offline: 'You are offline, so the photo cannot be read now.',
  'signed-out': 'Reading photos needs you signed in. Sign in under Plan, Sync.',
  cap: `That is ${PHOTO_CAP} photos today, the daily limit. It resets at 5:30 am.`,
  'not-set-up': 'Photo reading is not switched on yet.',
  'not-allowed': 'Photo reading is switched on only for some accounts, and this one is not on the list.',
  failed: 'The photo could not be read this time.',
}

/** The same questions as the photo reader, for Claude. Attach the photo there, then paste the reply back here. */
export function claudePrompt(note: string): string {
  return [
    'I am attaching a photo of a meal I ate in India. Please estimate it for my food log.',
    note.trim() ? `My note about it: "${note.trim().slice(0, 300)}". My note beats the photo.` : '',
    '',
    'Before you answer, ask me anything that would change the numbers a lot. Always ask how much oil, ghee or butter went in and whether there were sauces, mayo or cream, because photos miss hidden fat.',
    '',
    'Then list every separate food or ingredient as its own item, not one total. Use Indian names and household units (roti, katori, ladle). For each item give the cooked weight in grams, the count if it comes in pieces, protein, fat and carbs in grams, kcal, and your confidence from 0 to 1. Put cooking oil, ghee or butter in fat_tsp (teaspoons), not as an item, and leave that fat out of the fat and kcal of each item so it is not counted twice.',
    '',
    'Reply with JSON only, in exactly this shape:',
    '{"items":[{"name":"Roti","grams":80,"count":2,"protein":6,"fat":5,"carbs":36,"kcal":210,"confidence":0.7}],"questions":[],"fat_tsp":1}',
    '',
    'These are rough numbers for a personal log, not medical advice.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
}
