import { describe, expect, it } from 'vitest'
import { addSets, claudePrompt, demoLink, ensureLift, findLift, parseCoachReply, readCard, type Card } from './coach'
import { buildContext, measDue, measOf, measTrend } from './context'
import { atHour } from './dates'
import { hoursLeft, soreLeft } from './muscles'
import { planSession } from './plan'
import { parseImport, normDay } from './store'
import { blankDay, DEFAULT_SETTINGS, type Day, type Settings } from './types'

const S: Settings = { ...DEFAULT_SETTINGS, hour: 23 }
const T = '2026-11-01'
const NOW = atHour(T, 20)
const day = (o: Partial<Day>): Day => ({ ...blankDay(), ...o })
// Aditya's real October 30 upper body day, the one the examples are built on.
const oct30 = day({ lift: {
  chest: [{ w: 14, r: 12 }, { w: 18, r: 12 }, { w: 23, r: 8 }],
  pulldown: [{ w: 25, r: 12 }, { w: 25, r: 12 }, { w: 32, r: 8 }],
  row: [{ w: 14, r: 12 }, { w: 18, r: 9 }, { w: 14, r: 12 }],
  ohp: [{ w: 7.5, r: 16 }, { w: 7.5, r: 8 }],
  curl: [{ w: 5, r: 12 }, { w: 5, r: 10 }],
  pushdown: [{ w: 9.1, r: 12 }, { w: 9.1, r: 12 }],
}, f: [{ id: 'a', n: 'Egg', p: 6.3, k: 70, q: 2 }], s: { creatine: true } })

const good = JSON.stringify({ cards: [
  { type: 'exercise', name: 'Pec deck', muscles: ['chest', 'shoulders'], summary: 'A chest fly machine.', cues: ['Seat at mid chest', 'Squeeze'], safety: 'Start light.' },
  { type: 'advice', title: 'Rest your back', body: 'You did 6 sets of back on Oct 30.', action: 'rest', muscles: ['back'] },
  { type: 'log', lift: 'Pec deck', muscles: ['chest'], sets: [{ w: 20, r: 12 }, { w: 20, r: 12 }] },
  { type: 'soreness', muscle: 'back', level: 1, note: 'a little' },
  { type: 'note', text: 'Nice work.' },
] })
const cards = (raw: string): Card[] => { const p = parseCoachReply(raw); if (!p.ok) throw new Error(p.error); return p.cards }

describe('trainer reply cards', () => {
  it('reads every card type', () => {
    expect(cards(good).map((c) => c.type)).toEqual(['exercise', 'advice', 'log', 'soreness', 'note'])
  })
  it('reads JSON inside a code fence, as Claude often replies', () => {
    expect(cards('Here you go:\n```json\n' + good + '\n```').length).toBe(5)
  })
  it('shows plain text as one note, so there is never a dead end', () => {
    const c = cards('Your back is probably sore from pulldowns. Rest it tonight.')
    expect(c).toEqual([{ type: 'note', text: 'Your back is probably sore from pulldowns. Rest it tonight.' }])
  })
  it('shows broken JSON as a note too, and refuses only an empty paste', () => {
    expect(cards('{"cards":[{"type":"exercise","name":').map((c) => c.type)).toEqual(['note'])
    expect(parseCoachReply('   ').ok).toBe(false)
  })
  it('drops absurd sets, empty logs, and logs with no muscle or no name', () => {
    const bad = JSON.stringify({ cards: [
      { type: 'log', lift: 'Leg press', muscles: ['quads'], sets: [{ w: 5000, r: 10 }, { w: 60, r: 0 }, { w: -4, r: 10 }, { w: 80, r: 10 }] },
      { type: 'log', lift: 'Ghost lift', muscles: ['quads'], sets: [{ w: 99999, r: 10 }] },
      { type: 'log', lift: 'No muscle', muscles: [], sets: [{ w: 20, r: 10 }] },
      { type: 'log', lift: '', muscles: ['chest'], sets: [{ w: 20, r: 10 }] },
    ] })
    const c = cards(bad)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ type: 'log', lift: 'Leg press', sets: [{ w: 80, r: 10 }] })
  })
  it('drops unknown muscles, bad soreness levels and unknown card types, and says how many were dropped', () => {
    const raw = JSON.stringify({ cards: [
      { type: 'soreness', muscle: 'traps', level: 2 },
      { type: 'soreness', muscle: 'back', level: 7 },
      { type: 'soreness', muscle: 'back', level: 2, note: 'a lot' },
      { type: 'video', url: 'https://example.com' },
      { type: 'advice', title: 'Hi', body: 'Body', muscles: ['chest', 'wings'] },
    ] })
    const p = parseCoachReply(raw)
    expect(p.ok && p.dropped).toBe(3)
    expect(p.ok && p.cards.map((c) => c.type)).toEqual(['soreness', 'advice'])
    expect(p.ok && p.cards[1]).toMatchObject({ muscles: ['chest'] })
  })
  it('refuses a reply where nothing is usable, and keeps at most 8 cards', () => {
    expect(parseCoachReply('{"cards":[{"type":"video"},{"type":"log","lift":"x","muscles":[],"sets":[]}]}').ok).toBe(false)
    const many = JSON.stringify({ cards: Array.from({ length: 30 }, (_, i) => ({ type: 'note', text: 'n' + i })) })
    expect(cards(many)).toHaveLength(8)
  })
  it('never lets a reply put a link in a card, because the demo link is built by the app', () => {
    expect(demoLink('Pec deck & row')).toBe('https://www.youtube.com/results?search_query=Pec%20deck%20%26%20row%20form')
    const c = cards(JSON.stringify({ cards: [{ type: 'exercise', name: 'Pec deck', url: 'https://evil.example', muscles: ['chest'] }] }))
    expect(JSON.stringify(c)).not.toContain('evil')
  })
})

describe('logging from a card', () => {
  it('finds a lift already in the routine or the catalog, and none for a new machine', () => {
    expect(findLift('Chest press', S)?.id).toBe('chest')
    expect(findLift('hammer curl', S)?.id).toBe('c_hammer')
    expect(findLift('Pec deck', S)).toBeNull()
    expect(findLift('', S)).toBeNull()
  })
  it('adds a new machine as a lift with the right muscles, so its sets count', () => {
    const s = structuredClone(S)
    const id = ensureLift(s, 'Pec deck', ['chest', 'shoulders'], 'x_new')
    expect(id).toBe('x_new')
    expect(s.extra[0]).toMatchObject({ id: 'x_new', n: 'Pec deck', m: { chest: 1, shoulders: 0.5 }, x: true })
  })
  it('brings a catalog lift or a removed lift back, and leaves a routine lift alone', () => {
    const s = structuredClone(S)
    expect(ensureLift(s, 'Hammer curl', ['biceps'], 'x1')).toBe('c_hammer')
    expect(s.extra.map((e) => e.id)).toEqual(['c_hammer'])
    s.extra[0].off = true
    ensureLift(s, 'Hammer curl', ['biceps'], 'x2')
    expect(s.extra[0].off).toBe(false)
    expect(s.extra).toHaveLength(1)
    ensureLift(s, 'Chest press', ['chest'], 'x3')
    expect(s.extra).toHaveLength(1)
  })
  it('adds sets without touching sets already logged', () => {
    const d = day({ lift: { chest: [{ w: 14, r: 12 }] } })
    addSets(d, 'chest', [{ w: 18, r: 10 }])
    addSets(d, 'x_new', [{ w: 20, r: 12 }])
    expect(d.lift.chest).toEqual([{ w: 14, r: 12 }, { w: 18, r: 10 }])
    expect(d.lift.x_new).toEqual([{ w: 20, r: 12 }])
  })
})

describe('soreness only ever delays', () => {
  const d = (level: number) => ({ '2026-10-30': oct30, '2026-11-01': day({ sore: { back: level } }) })
  it('sore a lot holds a muscle back through the next day, past the 48 hour rule', () => {
    // Back was trained Oct 30 at 23:00, so by the 48 hour rule alone it is Ready on Nov 1 at 23:00.
    expect(hoursLeft({ '2026-10-30': oct30 }, S, 'back', atHour(T, 12))).toBeGreaterThan(0)
    expect(hoursLeft({ '2026-10-30': oct30 }, S, 'back', atHour(T, 23) + 36e5)).toBeLessThanOrEqual(0)
    expect(hoursLeft(d(2), S, 'back', atHour('2026-11-02', 20))).toBeGreaterThan(0) // would be Ready, soreness says wait
    expect(hoursLeft(d(2), S, 'back', atHour('2026-11-03', 6))).toBeLessThanOrEqual(0)
  })
  it('sharp holds longer, and a little never holds anything', () => {
    expect(hoursLeft(d(3), S, 'back', atHour('2026-11-03', 20))).toBeGreaterThan(0)
    expect(soreLeft(d(1), 'back', NOW)).toBeNull()
    expect(hoursLeft(d(1), S, 'back', atHour('2026-11-02', 20))).toBeLessThanOrEqual(0)
  })
  it('never makes a muscle ready sooner than the 48 hour rule', () => {
    const fresh = { '2026-11-01': { ...oct30, sore: { back: 2 } } as Day }
    const withSore = hoursLeft({ ...fresh, '2026-11-01': { ...fresh['2026-11-01'] } }, S, 'back', atHour(T, 23))
    const without = hoursLeft({ '2026-11-01': oct30 }, S, 'back', atHour(T, 23))
    expect(withSore!).toBeGreaterThanOrEqual(without!)
  })
  it('a sore muscle that was never trained still waits, then is free', () => {
    const only = { '2026-11-01': day({ sore: { quads: 2 } }) }
    expect(hoursLeft(only, S, 'quads', NOW)).toBeGreaterThan(0)
    expect(hoursLeft(only, S, 'quads', atHour('2026-11-03', 6))).toBeNull()
  })
  it('keeps a sore muscle out of tonight\'s session, using soreness told today', () => {
    const all = { '2026-10-30': oct30 }
    const before = planSession(all, S, T, atHour(T, 23) + 36e5)
    expect(before.skipped.find((x) => x.mu === 'back')?.why ?? '').not.toMatch(/Recovering/)
    const after = planSession({ ...all, [T]: day({ sore: { back: 2 } }) }, S, T, atHour(T, 23) + 36e5)
    expect(after.lifts.some((l) => l.muscles.includes('back'))).toBe(false)
    expect(after.skipped.find((x) => x.mu === 'back')?.why).toMatch(/Recovering/)
  })
})

describe('the week context', () => {
  const days = { '2026-10-30': oct30, '2026-10-31': day({}), [T]: day({ sore: { back: 1 }, wt: 80, waist: 92, meas: { arm: 31 } }) }
  const c = buildContext(days, S, T, atHour(T, 23) + 36e5)
  it('names the goal, the protein target and the real sets with their weights', () => {
    expect(c).toMatch(/recomposition/)
    expect(c).toMatch(/Protein target 140 g/)
    expect(c).toMatch(/Chest press 14x12, 18x12, 23x8/)
    expect(c).toMatch(/Lat pulldown 25x12, 25x12, 32x8/)
    expect(c).toMatch(/\(kg x reps\)/)
  })
  it('says what is ready, what is recovering, and what is sore', () => {
    expect(c).toMatch(/Ready to train: .*chest/)
    expect(c).toMatch(/Soreness told to the app: back a little/)
    expect(c).toMatch(/Sets this week so far.*chest 3 of 10 to 16/)
  })
  it('says no measurements when there are none, and gives one line each when there are', () => {
    expect(buildContext({ '2026-10-30': oct30 }, S, T, NOW)).toMatch(/Measurements: none yet/)
    expect(c).toMatch(/Measurements: .*weight 80 kg/)
    expect(c).toMatch(/waist 92 cm/)
    expect(c).toMatch(/arm 31 cm/)
  })
  it('does not invent anything when nothing is logged, and stays short', () => {
    const empty = buildContext({}, S, T, NOW)
    expect(empty).toMatch(/nothing logged/)
    expect(empty).toMatch(/Protein: nothing logged recently/)
    expect(c.split(/\s+/).length).toBeLessThan(400)
  })
  it('the prompt carries the week, the question, the doctor rule and the reply shape', () => {
    const p = claudePrompt(c, 'Is the pec deck ok tonight?')
    expect(p).toMatch(/My week:/)
    expect(p).toMatch(/Is the pec deck ok tonight\?/)
    expect(p).toMatch(/doctor/)
    expect(p).toMatch(/"type":"log"/)
    expect(p).not.toMatch(/—/)
    expect(claudePrompt(c, '')).toMatch(/see the photo or clip/)
  })
})

describe('measurements', () => {
  const days = { '2026-10-18': day({ waist: 94 }), '2026-11-01': day({ waist: 92, meas: { arm: 31 } }) }
  it('reads each measurement from its own field', () => {
    expect(measOf(days['2026-11-01'], 'waist')).toBe(92)
    expect(measOf(days['2026-11-01'], 'arm')).toBe(31)
    expect(measOf(days['2026-11-01'], 'chest')).toBeNull()
    expect(measOf(day({ wt: 0 }), 'wt')).toBeNull()
  })
  it('gives first, latest and count', () => {
    expect(measTrend(days, 'waist')).toEqual({ first: { k: '2026-10-18', v: 94 }, last: { k: '2026-11-01', v: 92 }, n: 2 })
    expect(measTrend(days, 'hip')).toBeNull()
  })
  it('counts days until the next set is due, every 14 days unless changed', () => {
    expect(measDue(days, S, '2026-11-01')).toBe(14)
    expect(measDue(days, S, '2026-11-10')).toBe(5)
    expect(measDue(days, S, '2026-11-20')).toBeLessThan(0)
    expect(measDue(days, { ...S, measDays: 7 }, '2026-11-05')).toBe(3)
    expect(measDue({}, S, T)).toBeNull()
  })
})

describe('stored fields added in 0.7.0', () => {
  it('a 0.6.3 log loads unchanged, with no new fields appearing', () => {
    const old = { version: 1, days: { '2026-10-30': { f: [{ id: 'a', n: 'Egg', p: 6.3, k: 70, q: 2 }], lift: { chest: [{ w: 14, r: 12 }] }, w: 12, wt: null, waist: null } }, settings: { protein: 140 } }
    const d = parseImport(JSON.stringify(old))
    expect(d.days['2026-10-30'].sore).toBeUndefined()
    expect(d.days['2026-10-30'].meas).toBeUndefined()
    expect(d.settings.measDays).toBeUndefined()
    expect(d.days['2026-10-30'].lift.chest).toEqual([{ w: 14, r: 12 }])
  })
  it('keeps good soreness and measurements, and drops bad ones without crashing', () => {
    const keep = normDay({ sore: { back: 2, chest: 1 }, meas: { arm: 31.5, hip: 95 } })
    expect(keep.sore).toEqual({ back: 2, chest: 1 })
    expect(keep.meas).toEqual({ arm: 31.5, hip: 95 })
    const bad = normDay({ sore: { back: 9, wings: 2, chest: 'a lot' } as never, meas: { arm: -3, neck: 40 } as never })
    expect(bad.sore).toBeUndefined()
    expect(bad.meas).toBeUndefined()
    expect(normDay({ sore: 'back' as never, meas: [1, 2] as never }).sore).toBeUndefined()
  })
  it('survives an export and import round trip', () => {
    const raw = { version: 1, days: { '2026-11-01': { sore: { quads: 3 }, meas: { thigh: 55 } } }, settings: { measDays: 21 } }
    const d = parseImport(JSON.stringify(raw))
    const again = parseImport(JSON.stringify(d))
    expect(again.days['2026-11-01'].sore).toEqual({ quads: 3 })
    expect(again.days['2026-11-01'].meas).toEqual({ thigh: 55 })
    expect(again.settings.measDays).toBe(21)
  })
})

describe('review fixes in 0.7.0', () => {
  it('a bare Row, Curl or Press never matches a lift, so sets are not logged under the wrong one', () => {
    expect(findLift('Row', S)).toBeNull()
    expect(findLift('Curl', S)).toBeNull()
    expect(findLift('Press', S)).toBeNull()
    expect(findLift('Leg', S)).toBeNull()
  })
  it('a longer name that holds one lift as whole words still finds it, but not when two lifts could match', () => {
    expect(findLift('Seated cable row machine', S)?.id).toBe('row')
    expect(findLift('Incline dumbbell press', S)?.id).toBe('c_incline')
    const twin: Settings = { ...S, extra: [{ id: 'x_wide', n: 'Wide chest press', m: { chest: 1 }, s: 3, lo: 8, hi: 12, inc: 2.5, x: true }] }
    expect(findLift('Wide chest press machine', twin)).toBeNull() // Chest press and Wide chest press are both held, so neither is guessed
    expect(findLift('Wide chest press', twin)?.id).toBe('x_wide') // an exact name always wins
  })
  it('reads one card the same way as a whole reply, so a damaged saved thread is cleaned', () => {
    expect(readCard({ type: 'log', lift: 'Leg press', muscles: ['quads'], sets: [{ w: 60, r: 10 }] })).toMatchObject({ type: 'log' })
    expect(readCard({ type: 'log', lift: 'Leg press' })).toBeNull() // no muscles or sets, would have thrown in the screen
    expect(readCard({ type: 'exercise', name: 'Pec deck' })).toMatchObject({ cues: [], muscles: [] })
    expect(readCard(null)).toBeNull()
    expect(readCard('x')).toBeNull()
  })
  it('prototype keys in a reply do nothing', () => {
    const c = cards('{"cards":[{"type":"advice","title":"Hi","body":"Body","__proto__":{"polluted":true},"constructor":{"x":1}}]}')
    expect(c).toHaveLength(1)
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
  it('a huge paste is cut before it is read, and still shows as a note', () => {
    const p = parseCoachReply('x'.repeat(500_000))
    expect(p.ok && p.cards[0].type === 'note' && p.cards[0].text.length <= 1200).toBe(true)
  })
  it('fractional soreness levels and the wrong kind of value are dropped', () => {
    expect(normDay({ sore: { back: 2.5 } }).sore).toBeUndefined()
    expect(normDay({ sore: { back: 2.5, chest: 2 } }).sore).toEqual({ chest: 2 })
  })
  it('a sore, never trained muscle says Recovering, not Not trained yet (the hours are positive)', () => {
    expect(hoursLeft({ '2026-11-01': day({ sore: { calves: 2 } }) }, S, 'calves', NOW)).toBeGreaterThan(0)
  })
})
