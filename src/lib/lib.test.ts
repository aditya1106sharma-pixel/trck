import { describe, expect, it } from 'vitest'
import { addDays, todayKey, weekStart } from './dates'
import { advise, fuelData } from './fuel'
import { band, hoursLeft, overloadHint, prevSession, routine, weekEffective } from './muscles'
import { addBackup, loadFrom, MAX_BACKUPS, migrate, parseImport, readBackups, saveBackup, type Migration } from './store'
import { level, score, streaks } from './score'
import { applySetup, needsSetup, proteinFor, showSetup, validWeight } from './setup'
import { blankDay, DEFAULT_SETTINGS, type Day } from './types'
import { ROUTINE } from './catalog'

const S = DEFAULT_SETTINGS
const day = (o: Partial<Day>): Day => ({ ...blankDay(), ...o })
const food = (p: number, k = 100, f = 1) => ({ id: 'x' + p, n: 'F' + p, p, f, cb: 0, k, q: 1 })

describe('dates', () => {
  it('rolls the day at 5 am', () => {
    expect(todayKey(new Date(2026, 9, 31, 1, 30).getTime())).toBe('2026-10-30')
    expect(todayKey(new Date(2026, 9, 31, 5, 1).getTime())).toBe('2026-10-31')
  })
  it('starts weeks on Monday', () => { expect(weekStart('2026-10-31')).toBe('2026-10-26') })
  it('adds days across month ends', () => { expect(addDays('2026-10-31', 1)).toBe('2026-11-01') })
})

describe('score', () => {
  it('is zero for an unlogged day, with no free habit points', () => {
    expect(score(day({}), S).total).toBe(0)
    expect(score(undefined, S).total).toBe(0)
  })
  it('adds up the five parts', () => {
    const d = day({ f: [food(140)], s: { creatine: true, omega: true, d3k2: true, mag: true }, w: 12, cig: 6, done: true })
    expect(score(d, S)).toMatchObject({ p: 30, s: 20, w: 10, t: 20, cg: 10, cp: 10, total: 100 })
  })
  it('loses habit points over the cap', () => {
    const d = day({ f: [food(70)], cig: 7 })
    expect(score(d, S).cg).toBe(0)
  })
  it('counts a streak only from days at 60 or more', () => {
    const good = day({ f: [food(140)], s: { creatine: true, omega: true }, w: 12, done: true })
    const days = { '2026-10-28': good, '2026-10-29': good, '2026-10-30': day({ w: 1 }), '2026-10-31': good }
    expect(streaks(days, S, '2026-10-31')).toEqual({ cur: 1, best: 2 })
  })
  it('keeps yesterday streak alive until today is scored', () => {
    const good = day({ f: [food(140)], s: { creatine: true, omega: true }, w: 12, done: true })
    expect(streaks({ '2026-10-30': good }, S, '2026-10-31').cur).toBe(1)
  })
  it('moves up plates with XP', () => {
    const g = day({ f: [food(140)], s: { creatine: true, omega: true, d3k2: true, mag: true }, w: 12, done: true })
    const days: Record<string, Day> = {}
    for (let i = 0; i < 7; i++) days[addDays('2026-10-01', i)] = g
    expect(level(days, S).cur.kg).toBe(10)
  })
})

describe('muscles', () => {
  it('weights helpers at half a set', () => {
    const d = day({ lift: { chest: [{ w: 20, r: 10 }, { w: 20, r: 10 }, { w: 20, r: 10 }] } })
    const eff = weekEffective({ '2026-10-26': d }, S, '2026-10-28')
    expect(eff.chest).toBe(3)
    expect(eff.triceps).toBe(1.5)
  })
  it('ignores empty sets', () => {
    const d = day({ lift: { chest: [{ w: null, r: null }, { w: 20, r: 0 }] } })
    expect(weekEffective({ '2026-10-26': d }, S, '2026-10-26').chest ?? 0).toBe(0)
  })
  it('recovers 48 hours after the usual finish hour', () => {
    const d = day({ lift: { chest: [{ w: 20, r: 10 }, { w: 20, r: 10 }] } })
    const days = { '2026-10-26': d }
    const at = new Date(2026, 9, 27, 23, 0).getTime()
    expect(hoursLeft(days, S, 'chest', at)).toBeCloseTo(24, 0)
    expect(hoursLeft(days, S, 'chest', new Date(2026, 9, 29, 0, 0).getTime())!).toBeLessThan(0)
  })
  it('never trained is null, one set does not count as trained', () => {
    const d = day({ lift: { curl: [{ w: 10, r: 10 }] } })
    expect(hoursLeft({ '2026-10-26': d }, S, 'biceps')).toBeNull()
  })
  it('bands a muscle against its range', () => {
    expect(band('chest', 4, 1)).toBe('low')
    expect(band('chest', 12, 1)).toBe('ok')
    expect(band('chest', 20, 1)).toBe('high')
    expect(band('forearms', 5, 1)).toBe('ind')
  })
  it('lists removed extras out of the routine', () => {
    const s = { ...S, extra: [{ ...ROUTINE[0], id: 'z', off: true }] }
    expect(routine(s).some((e) => e.id === 'z')).toBe(false)
  })
})

describe('progressive overload', () => {
  const ex = ROUTINE.find((e) => e.id === 'chest')!
  it('asks for the first weight', () => { expect(overloadHint(ex, null).kind).toBe('first') })
  it('adds weight once every set hits the top', () => {
    const d = day({ lift: { chest: [{ w: 30, r: 12 }, { w: 30, r: 12 }, { w: 30, r: 12 }] } })
    const h = overloadHint(ex, prevSession({ '2026-10-26': d }, 'chest', '2026-10-28'))
    expect(h.kind).toBe('add')
    expect(h.text).toContain('32.5')
  })
  it('asks for more reps otherwise', () => {
    const d = day({ lift: { chest: [{ w: 30, r: 12 }, { w: 30, r: 10 }, { w: 30, r: 9 }] } })
    expect(overloadHint(ex, prevSession({ '2026-10-26': d }, 'chest', '2026-10-28')).kind).toBe('beat')
  })
  it('does not add weight on fewer sets than planned', () => {
    const d = day({ lift: { chest: [{ w: 30, r: 12 }] } })
    expect(overloadHint(ex, prevSession({ '2026-10-26': d }, 'chest', '2026-10-28')).kind).toBe('beat')
  })
})

describe('fuel advice', () => {
  it('flags fat over target and names the source', () => {
    const d = day({ f: [{ id: 'a', n: 'Cooking oil', p: 0, f: 4.5, cb: 0, k: 40, q: 20, t: 'fat' }, food(100, 800, 30)] })
    const fd = fuelData({ '2026-10-30': d }, ['2026-10-30'])
    const a = advise(fd, S, 'day')
    expect(a.cut.join(' ')).toContain('Cooking oil')
  })
  it('suggests protein when short', () => {
    const fd = fuelData({ '2026-10-30': day({ f: [food(40, 300, 5)] }) }, ['2026-10-30'])
    expect(advise(fd, S, 'day').add.join(' ')).toContain('short')
  })
  it('returns nothing without food', () => { expect(advise(fuelData({}, ['2026-10-30']), S, 'day')).toEqual({ cut: [], add: [] }) })
})

describe('import', () => {
  it('reads the prototype export shape', () => {
    const j = JSON.stringify({ days: { '2026-10-30': { f: [{ n: 'Egg', p: 6, k: 80, q: 2 }], w: 5 } }, cfg: { protein: 150 } })
    const r = parseImport(j)
    expect(r.settings.protein).toBe(150)
    expect(r.days['2026-10-30'].f).toHaveLength(1)
    expect(r.days['2026-10-30'].lift).toEqual({})
  })
  it('rejects junk', () => { expect(() => parseImport('{"x":1}')).toThrow() })
  it('drops bad date keys', () => { expect(Object.keys(parseImport('{"days":{"nope":{}}}').days)).toHaveLength(0) })
})

describe('first run', () => {
  const fresh = parseImport('{"days":{}}')
  it('turns body weight into a protein target to the nearest 5 g', () => {
    expect(proteinFor(70)).toBe(125)
    expect(proteinFor(78)).toBe(140)
  })
  it('keeps the target in a sane range', () => {
    expect(proteinFor(30)).toBe(60)
    expect(proteinFor(250)).toBe(300)
  })
  it('accepts only believable weights', () => {
    expect([29, 30, 250, 251].map(validWeight)).toEqual([false, true, true, false])
  })
  it('asks a new account, with no days, to set up', () => { expect(needsSetup(fresh)).toBe(true) })
  it('never asks someone who already has logged days', () => {
    expect(needsSetup(parseImport('{"days":{"2026-10-30":{"w":3}}}'))).toBe(false)
  })
  it('does not overwrite someone who only changed settings', () => {
    expect(needsSetup({ ...fresh, su: 1730000000000 })).toBe(false)
  })
  it('waits for a signed-in person log before asking, and never when locked', () => {
    const o = { locked: false, loading: false, email: null as string | null, state: 'signed-out' }
    expect(showSetup(fresh, o)).toBe(true)
    expect(showSetup(fresh, { ...o, loading: true })).toBe(false) // still finding out who is signed in
    expect(showSetup(fresh, { ...o, email: 'a@b.c', state: 'syncing' })).toBe(false)
    expect(showSetup(fresh, { ...o, email: 'a@b.c', state: 'error' })).toBe(false)
    expect(showSetup(fresh, { ...o, email: 'a@b.c', state: 'ok' })).toBe(true) // new account, empty cloud
    expect(showSetup(fresh, { ...o, locked: true })).toBe(false)
  })
  it('stops asking once set up, and keeps everything else', () => {
    const s = { ...DEFAULT_SETTINGS, foods: [{ n: 'Egg', p: 6, f: 5, cb: 0, u: '1', t: 'x' }] }
    applySetup(s, { protein: 125, start: '2026-11-02' })
    expect(s).toMatchObject({ protein: 125, start: '2026-11-02', ready: true, kcal: DEFAULT_SETTINGS.kcal })
    expect(s.foods).toHaveLength(1)
    expect(needsSetup({ ...fresh, settings: s })).toBe(false)
  })
  it('starts a new account clean: no days, and not the old start date', () => {
    const s = { ...DEFAULT_SETTINGS }
    applySetup(s, { protein: 125, start: '2027-01-05' })
    expect(Object.keys(fresh.days)).toHaveLength(0)
    expect(s.start).not.toBe(DEFAULT_SETTINGS.start)
  })
  it('keeps the flag through an import', () => {
    const j = JSON.stringify({ days: {}, settings: { ...DEFAULT_SETTINGS, ready: true } })
    expect(parseImport(j).settings.ready).toBe(true)
  })
})

describe('schema version', () => {
  const addNote: Migration = (r) => ({ ...r, extra: 'kept' })
  it('treats data with no version as version 1', () => {
    expect(migrate({ days: {} }, { 1: addNote }, 2)).toMatchObject({ version: 2, extra: 'kept' })
  })
  it('runs each step in order and stamps the new version', () => {
    const steps = { 1: (r: Record<string, unknown>) => ({ ...r, a: 1 }), 2: (r: Record<string, unknown>) => ({ ...r, b: (r.a as number) + 1 }) }
    expect(migrate({ version: 1 }, steps, 3)).toEqual({ version: 3, a: 1, b: 2 })
  })
  it('leaves current data alone', () => {
    const raw = { version: 1, days: { x: 1 } }
    expect(migrate(raw, {}, 1)).toBe(raw)
  })
  it('refuses data from a newer app instead of dropping fields', () => {
    expect(() => migrate({ version: 3 }, {}, 2)).toThrow(/newer version/)
  })
  it('stops when a step is missing', () => { expect(() => migrate({ version: 1 }, {}, 2)).toThrow(/version 1/) })
  it('stamps imports with the current version', () => { expect(parseImport('{"days":{}}').version).toBe(1) })
})

describe('local backups', () => {
  const mem = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
  }
  it('keeps only the last 5', () => {
    let list: ReturnType<typeof readBackups> = []
    for (let i = 1; i <= 7; i++) list = addBackup(list, { at: i, reason: 'import', json: String(i) })
    expect(list.map((b) => b.json)).toEqual(['3', '4', '5', '6', '7'])
    expect(MAX_BACKUPS).toBe(5)
  })
  it('saves, reads back, and skips an identical copy', () => {
    const m = mem()
    saveBackup('{"a":1}', 'before import', m, 10)
    saveBackup('{"a":1}', 'before import', m, 20)
    saveBackup('{"a":2}', 'before upgrade', m, 30)
    expect(readBackups(m).map((b) => [b.at, b.reason])).toEqual([[10, 'before import'], [30, 'before upgrade']])
  })
  it('keeps fewer copies when storage is nearly full, and never throws', () => {
    const m = mem()
    for (let i = 0; i < 5; i++) saveBackup(`{"n":${i}}`, 'import', m, i)
    const tight = { getItem: m.getItem, setItem: (k: string, v: string) => { if (v.length > 120) throw new Error('quota'); m.setItem(k, v) } }
    expect(() => saveBackup('{"n":9}', 'import', tight, 99)).not.toThrow()
    expect(readBackups(m).at(-1)?.json).toBe('{"n":9}')
    expect(readBackups(m).length).toBeLessThan(5)
  })
  it('locks and keeps a copy when the device holds data from a newer app', () => {
    const m = mem()
    const newer = JSON.stringify({ version: 99, days: { '2026-10-30': { w: 4 } } })
    const r = loadFrom(newer, m)
    expect(r.locked).toBe(true)
    expect(r.data.days).toEqual({})
    expect(readBackups(m)).toMatchObject([{ reason: 'unreadable', json: newer }])
  })
  it('keeps a copy of damaged data but still lets the app start', () => {
    const m = mem()
    expect(loadFrom('{oops', m).locked).toBe(false)
    expect(readBackups(m)).toMatchObject([{ reason: 'unreadable', json: '{oops' }])
  })
  it('starts clean, with no backup, when nothing is stored', () => {
    const m = mem()
    expect(loadFrom(null, m)).toMatchObject({ locked: false, data: { days: {} } })
    expect(readBackups(m)).toEqual([])
  })
  it('ignores a damaged backup list', () => {
    expect(readBackups({ getItem: () => 'not json', setItem: () => {} })).toEqual([])
  })
})

import { mergeData } from './merge'
describe('sync merge', () => {
  const base = { version: 1 as const, days: {}, settings: DEFAULT_SETTINGS }
  it('keeps the newest edit of each day and never drops a day', () => {
    const a = { ...base, days: { '2026-10-30': day({ w: 3, u: 100 }), '2026-10-31': day({ w: 1, u: 50 }) } }
    const b = { ...base, days: { '2026-10-30': day({ w: 9, u: 200 }), '2026-11-01': day({ w: 2, u: 10 }) } }
    const m = mergeData(a, b)
    expect(m.days['2026-10-30'].w).toBe(9)
    expect(Object.keys(m.days).sort()).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })
  it('is stable when merged twice', () => {
    const a = { ...base, days: { '2026-10-30': day({ w: 3, u: 100 }) }, su: 5 }
    const b = { ...base, days: { '2026-10-30': day({ w: 9, u: 200 }) }, su: 9, settings: { ...DEFAULT_SETTINGS, protein: 150 } }
    const m = mergeData(a, b)
    expect(JSON.stringify(mergeData(m, b))).toBe(JSON.stringify(m))
    expect(m.settings.protein).toBe(150)
  })
})
