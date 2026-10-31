import { describe, expect, it } from 'vitest'
import {
  applyMine, claudePrompt, extractJson, failureOf, fitSize, gramsPerUnit, matchFood, mealConf, mealParts, mealRange,
  parseReply, photoEntry, spreadOf, type PhotoPart,
} from './photo'
import { exportJson, normDay, parseImport } from './store'
import type { Food } from './types'

const good = JSON.stringify({
  items: [
    { name: 'Grilled chicken', grams: 150, protein: 46, fat: 5.4, carbs: 0, kcal: 235, confidence: 0.8 },
    { name: 'Roti', grams: 80, count: 2, protein: 6, fat: 5, carbs: 36, kcal: 210, confidence: 0.7 },
    { name: 'Dal', grams: 150, protein: 9, fat: 3, carbs: 20, kcal: 143, confidence: 0.5 },
  ],
  questions: ['How much oil went into the dal?', 'Was the chicken skinless?'],
  fat_tsp: 1,
})
const ok = (t: string) => {
  const r = parseReply(t)
  if (!r.ok) throw new Error(r.error)
  return r.reply
}

describe('photo reply parsing', () => {
  it('reads a good reply into editable parts', () => {
    const r = ok(good)
    expect(r.parts.map((x) => x.n)).toEqual(['Grilled chicken', 'Roti', 'Dal'])
    expect(r.parts[1].u).toBe('2 · 80 g')
    expect(r.fatTsp).toBe(1)
    expect(r.parts.every((x) => x.q === 1 && x.t === 'photo' && !x.mine)).toBe(true)
  })
  it('rejects bad JSON gently', () => {
    const r = parseReply('{"items": [ {"name": "Roti", ')
    expect(r.ok).toBe(false)
    expect(parseReply('').ok).toBe(false)
    expect(parseReply('Sorry, I cannot see any food.').ok).toBe(false)
  })
  it('rejects a reply with no items list', () => {
    expect(parseReply('{"questions":["what is it?"]}').ok).toBe(false)
    expect(parseReply('{"items":"roti"}').ok).toBe(false)
    expect(parseReply('[1,2,3]').ok).toBe(false)
  })
  it('drops items with missing or negative fields and keeps the rest', () => {
    const r = ok(JSON.stringify({ items: [
      { name: 'Roti', grams: 40, protein: 3, fat: 2.5, carbs: 18, kcal: 105, confidence: 0.7 },
      { name: 'Mystery', grams: 100, protein: 5 },
      { name: 'Negative', grams: 100, protein: -3, fat: 1, carbs: 1, kcal: 10 },
      { grams: 100, protein: 3, fat: 1, carbs: 1, kcal: 30 },
      null, 'rice',
    ] }))
    expect(r.parts.map((x) => x.n)).toEqual(['Roti'])
    expect(r.dropped).toEqual(['Mystery', 'Negative'])
    expect(r.questions).toEqual([])
  })
  it('drops absurd values like 20,000 kcal or 5 kg', () => {
    const r = parseReply(JSON.stringify({ items: [
      { name: 'Biryani', grams: 400, protein: 2000, fat: 1000, carbs: 2000, kcal: 20000, confidence: 0.9 },
      { name: 'Rice', grams: 5000, protein: 20, fat: 2, carbs: 200, kcal: 900, confidence: 0.9 },
    ] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Biryani, Rice/)
  })
  it('replaces kcal that disagrees badly with the macros', () => {
    const r = ok(JSON.stringify({ items: [{ name: 'Paneer', grams: 100, protein: 18, fat: 21, carbs: 2, kcal: 20000, confidence: 0.6 }] }))
    expect(r.parts[0].k).toBe(4 * 18 + 4 * 2 + 9 * 21)
  })
  it('fills missing kcal from the macros and accepts numbers as text', () => {
    const r = ok('{"items":[{"name":"Egg","grams":"50","protein":"6.3","fat":"5","carbs":"0.4","confidence":"high"}]}')
    expect(r.parts[0].k).toBe(Math.round(4 * 6.3 + 4 * 0.4 + 9 * 5))
    expect(r.parts[0].conf).toBe(0.85)
  })
  it('reads JSON inside a code fence, as Claude often replies', () => {
    expect(ok('Here you go:\n```json\n' + good + '\n```\nEnjoy.').parts).toHaveLength(3)
    expect(extractJson('text {"a":1} text')).toEqual({ a: 1 })
  })
  it('moves oil, ghee or butter items into the fat question', () => {
    const r = ok(JSON.stringify({ items: [
      { name: 'Dal', grams: 150, protein: 9, fat: 3, carbs: 20, kcal: 143, confidence: 0.5 },
      { name: 'Ghee', grams: 9, protein: 0, fat: 9, carbs: 0, kcal: 81, confidence: 0.4 },
    ], fat_tsp: 0 }))
    expect(r.parts.map((x) => x.n)).toEqual(['Dal'])
    expect(r.fatTsp).toBe(2)
  })
  it('caps fat teaspoons and clamps confidence', () => {
    const r = ok(JSON.stringify({ items: [{ name: 'Rice', grams: 150, protein: 4, fat: 0.4, carbs: 45, kcal: 200, confidence: 7 }], fat_tsp: 99 }))
    expect(r.fatTsp).toBe(10)
    expect(r.parts[0].conf).toBe(0.07)
  })
  it('drops the model\'s own fat questions because the app always asks, and keeps at most 3 others', () => {
    const r = ok(JSON.stringify({ items: JSON.parse(good).items, questions: ['Any butter?', 'Was there mayo?', 'Skin on?', 'How many pieces?', 'Bone in?', 'Which rice?'] }))
    expect(r.questions).toEqual(['Skin on?', 'How many pieces?', 'Bone in?'])
  })
  it('limits a reply to 15 items and trims long names', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ name: 'Item ' + i + 'x'.repeat(80), grams: 10, protein: 1, fat: 1, carbs: 1, kcal: 17, confidence: 0.5 }))
    const r = ok(JSON.stringify({ items }))
    expect(r.parts).toHaveLength(15)
    expect(r.parts[0].n.length).toBe(60)
  })
})

describe('photo: your values win', () => {
  const mine: Food[] = [{ n: 'Roti', p: 4, f: 1, cb: 20, u: '1 medium', t: 'custom' }]
  it('matches names and aliases, your own list first', () => {
    expect(matchFood('Chapati', mine)?.p).toBe(4)
    expect(matchFood('Roti', [])?.p).toBe(3) // built in
    expect(matchFood('steamed rice', [])?.n).toBe('Rice')
    expect(matchFood('Chicken curry', [])).toBeNull()
  })
  it('reads grams from a unit', () => {
    expect(gramsPerUnit('100 g cooked')).toBe(100)
    expect(gramsPerUnit('250 ml')).toBe(250)
    expect(gramsPerUnit('1 medium')).toBeNull()
  })
  it('uses your values, scaled by count for pieces and grams for weighed foods', () => {
    const parts = applyMine(ok(good).parts, mine)
    const roti = parts.find((x) => x.n === 'Roti')!
    expect(roti).toMatchObject({ p: 4, f: 1, cb: 20, q: 2, mine: true, u: '1 medium' })
    const chicken = parts.find((x) => x.n === 'Chicken')!
    expect(chicken).toMatchObject({ p: 31, q: 1.5, mine: true }) // 150 g of "100 g cooked"
    const dal = parts.find((x) => x.n === 'Dal')!
    expect(dal.mine).toBe(false) // "1 bowl" with no count keeps the model's numbers
  })
})

describe('photo: range and logged entry', () => {
  const part = (k: number, conf: number, mine = false, p = 10): PhotoPart => ({ n: 'X' + k, p, f: 1, cb: 1, k, q: 1, g: 100, conf, mine })
  it('widens the range as confidence drops', () => {
    expect(spreadOf({ conf: 0.9, mine: false })).toBe(0.15)
    expect(spreadOf({ conf: 0.6, mine: false })).toBe(0.3)
    expect(spreadOf({ conf: 0.2, mine: false })).toBe(0.45)
    expect(spreadOf({ conf: 0.2, mine: true })).toBe(0.1)
  })
  it('shows a range, with the added fat counted on both ends', () => {
    const r = mealRange([part(400, 0.9), part(200, 0.3)], 2)
    expect(r.lo).toBe(Math.round((400 * 0.85 + 200 * 0.55 + 82) / 10) * 10)
    expect(r.hi).toBe(Math.round((400 * 1.15 + 200 * 1.45 + 82) / 10) * 10)
    expect(r.lo).toBeLessThan(r.hi)
    expect(r.p).toBe(20)
  })
  it('logs a built meal marked as a photo, with the fat as its own line, and skips removed items', () => {
    const parts = [part(300, 0.8), { ...part(100, 0.4), q: 0 }]
    const e = photoEntry('id1', '  ', parts, 1.5)
    expect(e).toMatchObject({ n: 'Photo meal', m: 1, q: 1, src: 'photo', conf: 0.8 })
    expect(e.parts!.map((x) => x.n)).toEqual(['X300', 'Cooking oil'])
    expect(e.parts![1].q).toBe(1.5)
    expect(e.k).toBe(Math.round(300 + 1.5 * 41))
    expect(mealParts(parts, 0)).toHaveLength(1)
    expect(mealConf([])).toBe(0)
  })
})

describe('photo: plumbing', () => {
  it('shrinks to 1024 px on the long side and never enlarges', () => {
    expect(fitSize(4032, 3024)).toEqual({ w: 1024, h: 768 })
    expect(fitSize(3024, 4032)).toEqual({ w: 768, h: 1024 })
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 })
    expect(fitSize(0, 600)).toEqual({ w: 0, h: 0 })
  })
  it('turns every failure into a reason that leads to the Claude fallback', () => {
    expect(failureOf(0, null)).toBe('offline')
    expect(failureOf(401, {})).toBe('signed-out')
    expect(failureOf(429, { error: 'cap' })).toBe('cap')
    expect(failureOf(503, { error: 'no-key' })).toBe('not-set-up')
    expect(failureOf(404, null)).toBe('not-set-up')
    expect(failureOf(502, { error: 'model' })).toBe('failed')
  })
  it('the Claude prompt asks the fat question and wants JSON in our shape', () => {
    const p = claudePrompt('chicken, 2 rotis, little oil')
    expect(p).toMatch(/oil, ghee or butter/)
    expect(p).toMatch(/chicken, 2 rotis, little oil/)
    expect(p).toMatch(/"items"/)
    expect(p).not.toMatch(/—/)
    expect(parseReply(p).ok).toBe(true) // the example in the prompt is itself a valid reply
  })
})

describe('stored fields added in 0.6.0', () => {
  it('a 0.5.0 log with none of the new fields loads unchanged', () => {
    const old = { version: 1, days: { '2026-10-30': { f: [{ id: 'a', n: 'Egg', p: 6.3, k: 70, q: 2 }], lift: { legpress: [{ w: 60, r: 10 }] }, w: 4 } }, settings: { protein: 140 } }
    const d = parseImport(JSON.stringify(old))
    const day = d.days['2026-10-30']
    expect(day.plan).toBeUndefined()
    expect(day.f[0]).toEqual({ id: 'a', n: 'Egg', p: 6.3, k: 70, q: 2 })
    expect(d.settings.noEq).toBeUndefined()
    expect(d.version).toBe(1)
  })
  it('the new fields survive export and import', () => {
    const data = parseImport(JSON.stringify({ version: 1, days: { '2026-10-31': {
      f: [{ id: 'p', n: 'Photo meal', p: 40, k: 500, q: 1, m: 1, src: 'photo', conf: 0.6, parts: [] }], plan: ['legpress', 'rdl'],
    } }, settings: { noEq: ['legpress_m'] } }))
    const again = parseImport(exportJson(data))
    expect(again.days['2026-10-31'].f[0]).toMatchObject({ src: 'photo', conf: 0.6 })
    expect(again.days['2026-10-31'].plan).toEqual(['legpress', 'rdl'])
    expect(again.settings.noEq).toEqual(['legpress_m'])
  })
  it('bad values in the new fields are dropped, not crashed on', () => {
    const d = normDay({ plan: 'legpress' as unknown as string[], f: [{ id: 'x', n: 'X', p: 1, k: 1, q: 1, conf: 7 }] })
    expect(d.plan).toBeUndefined()
    expect(d.f[0].conf).toBeUndefined()
  })
})
