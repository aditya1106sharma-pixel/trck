import { FAT_TIPS, FOODS } from './catalog'
import { winKeys } from './dates'
import { carbG, expand, fatG, kcal, kcalOf, protein, type Days, type Expanded } from './score'
import type { FoodEntry, Part, Settings } from './types'

export type FuelData = {
  n: number // days with food logged
  avg: { p: number; f: number; cb: number; k: number } | null
  list: Expanded[]
  unknownFat: number
}

export function fuelData(days: Days, keys: string[]): FuelData {
  let n = 0
  const t = { p: 0, f: 0, cb: 0, k: 0 }
  let list: Expanded[] = []
  let unknownFat = 0
  for (const k of keys) {
    const d = days[k]
    if (!d || !d.f.length) continue
    n++
    t.p += protein(d); t.f += fatG(d); t.cb += carbG(d); t.k += kcal(d)
    unknownFat += d.f.filter((x) => x.f == null).length
    list = list.concat(expand(d))
  }
  return { n, avg: n ? { p: t.p / n, f: t.f / n, cb: t.cb / n, k: t.k / n } : null, list, unknownFat }
}

export type Ranked = { arr: [string, number][]; tot: number }

export function rank(list: Expanded[], key: 'f' | 'k', skipTag?: string): Ranked {
  const m: Record<string, number> = {}
  let tot = 0
  for (const x of list) {
    if (skipTag && x.t === skipTag) continue
    const v = key === 'k' ? x.k * x.q : (x.f ?? 0) * x.q
    if (!v) continue
    m[x.n] = (m[x.n] ?? 0) + v
    tot += v
  }
  return { arr: Object.entries(m).sort((a, b) => b[1] - a[1]), tot }
}

export type Advice = { cut: string[]; add: string[] }

const proteinOptions = [
  { n: 'Egg white', times: 4, label: '4 egg whites' },
  { n: 'Chicken', times: 1, label: '100 g chicken' },
  { n: 'Protein scoop', times: 1, label: '1 protein scoop' },
  { n: 'Soya chunks', times: 1, label: '30 g soya chunks' },
]

export function proteinSuggestions(): string[] {
  return proteinOptions.map((o) => {
    const f = FOODS.find((x) => x.n === o.n)!
    const k = kcalOf({ p: f.p, cb: f.cb, f: f.f }) * o.times
    return `${o.label}: +${Math.round(f.p * o.times)} g protein for ${Math.round(k)} kcal`
  })
}

/** Room to cut and room to add, on an average logged day. */
export function advise(fd: FuelData, s: Settings, label: string): Advice {
  const cut: string[] = []
  const add: string[] = []
  const a = fd.avg
  if (!a) return { cut, add }
  const df = a.f - s.fat
  const dk = a.k - s.kcal
  const dp = s.protein - a.p
  const fatR = rank(fd.list, 'f')
  const kR = rank(fd.list, 'k', 'protein')
  if (df > s.fat * 0.1) {
    cut.push(`Fat is ${Math.round(df)} g over your ${s.fat} g target on your ${label}, about ${Math.round(df * 9)} kcal.`)
    for (const [name, v] of fatR.arr.slice(0, 3)) {
      cut.push(`${name} gives ${Math.round(v / fd.n)} g of fat a day. ${FAT_TIPS[name] ?? 'Trim the portion by a third.'}`)
    }
  } else if (df < -s.fat * 0.2) {
    add.push(`You have about ${Math.round(-df)} g of fat to spare, roughly ${Math.round(-df * 9)} kcal. A level tablespoon of peanut butter (8 g) or a cheese cube (6 g) fits without trouble.`)
  } else cut.push('Fat is close to target, so there is no need to cut it.')
  if (dk > s.kcal * 0.1) {
    const top = kR.arr.slice(0, 3).map(([n, v]) => `${n} (${Math.round(v / fd.n)} kcal)`).join(', ')
    cut.push(`Calories run ${Math.round(dk)} over target on your ${label}.${top ? ` Biggest non protein sources: ${top}.` : ''}`)
  } else if (dk < -s.kcal * 0.1) {
    add.push(`Calories are ${Math.round(-dk)} under target. Add them around training, for example a banana and a cup of rice (about 310 kcal) before you lift.`)
  }
  if (dp > s.protein * 0.1) {
    add.push(`Protein is ${Math.round(dp)} g short. Cheapest ways in:`)
    add.push(...proteinSuggestions())
  } else add.push('Protein is on target. Keep it spread across 4 meals.')
  if (!cut.length) cut.push('Nothing stands out to cut right now.')
  return { cut, add }
}

export type MealTip = { name: string; kcal: number; p: number; f: number; tips: string[] }

export function mealTips(days: Days, keys: string[]): MealTip[] {
  const seen = new Set<string>()
  const out: MealTip[] = []
  for (const k of keys) {
    for (const x of days[k]?.f ?? []) {
      if (!x.parts || seen.has(x.n)) continue
      seen.add(x.n)
      out.push(tipFor(x))
    }
  }
  return out
}

function sumParts(parts: Part[]) {
  return parts.reduce((a, x) => ({ p: a.p + x.p * x.q, f: a.f + x.f * x.q, cb: a.cb + x.cb * x.q, k: a.k + x.k * x.q }), { p: 0, f: 0, cb: 0, k: 0 })
}

function tipFor(x: FoodEntry): MealTip {
  const parts = x.parts ?? []
  const s = sumParts(parts)
  const veg = parts.filter((p) => p.t === 'veg').reduce((a, p) => a + p.q, 0)
  const per100 = s.k > 0 ? (s.p / s.k) * 100 : 0
  const tips: string[] = []
  if (s.p < 25) tips.push(`Protein is ${Math.round(s.p)} g. Add 2 egg whites (+7 g protein, +34 kcal) or 100 g chicken (+31 g).`)
  if (veg < 2) tips.push('Light on vegetables. Add 100 g mushrooms, spinach or capsicum for about 25 kcal. The volume and fibre keep you full.')
  if (s.f > 25) tips.push(`Fat is ${Math.round(s.f)} g. Cut the oil to 1 teaspoon and use 1 cheese cube, not 2, to save about 70 kcal.`)
  if (per100 < 6 && s.k > 250) tips.push(`Only ${Math.round(per100 * 10) / 10} g of protein per 100 kcal. Aim for 8 or more for a lean meal.`)
  if (!tips.length) tips.push('This one is solid. Protein, vegetables and fat are all in a good place.')
  return { name: x.n, kcal: Math.round(s.k), p: Math.round(s.p), f: Math.round(s.f), tips }
}

export const fuelKeysFor = (mode: 'day' | 'week', sel: string, today: string) => (mode === 'week' ? winKeys(today, 7) : [sel])
