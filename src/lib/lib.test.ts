import { describe, expect, it } from 'vitest'
import { addDays, todayKey, weekStart } from './dates'
import { advise, fuelData } from './fuel'
import { band, hoursLeft, overloadHint, prevSession, routine, weekEffective } from './muscles'
import { friendlyAuthError, passwordProblem, recoveryKind, recoveryTokens, resetRedirect } from './auth'
import { clearOwner, ownerAction, readOwner, writeOwner } from './owner'
import { nextStamp, pushMerge, stable, type Remote } from './cas'
import { createSyncQueue } from './queue'
import { addBackup, blankData, loadFrom, MAX_BACKUPS, migrate, parseImport, readBackups, saveBackup, type Migration } from './store'
import { level, score, streaks } from './score'
import { applySetup, needsSetup, proteinFor, showSetup, validWeight } from './setup'
import { blankDay, DEFAULT_SETTINGS, type Day } from './types'
import { CATALOG, ROUTINE } from './catalog'

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

describe('one device, many people', () => {
  const mem = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } }
  }
  it('keeps the log when the same person signs in again', () => { expect(ownerAction('a', 'a', true)).toBe('keep') })
  it('clears and backs up a log that belongs to someone else, instead of merging it in', () => {
    expect(ownerAction('a', 'b', true)).toBe('clear')
  })
  it('lets a new person take an empty device', () => { expect(ownerAction('a', 'b', false)).toBe('adopt') })
  it('adopts a log that nobody has claimed yet, as from before owners were tracked', () => {
    expect(ownerAction(null, 'b', true)).toBe('adopt')
  })
  it('remembers and forgets the owner', () => {
    const m = mem()
    expect(readOwner(m)).toBeNull()
    writeOwner('a', m)
    expect(readOwner(m)).toBe('a')
    clearOwner(m)
    expect(readOwner(m)).toBeNull()
  })
  it('never throws when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') }, removeItem: () => { throw new Error('no') } }
    expect(readOwner(blocked)).toBeNull()
    expect(() => { writeOwner('a', blocked); clearOwner(blocked) }).not.toThrow()
  })
  it('a blank start is empty and asks for setup, so the next person starts clean', () => {
    const b = blankData()
    expect(Object.keys(b.days)).toHaveLength(0)
    expect(needsSetup(b)).toBe(true)
    expect(b.settings.start).toBe(DEFAULT_SETTINGS.start) // replaced when they finish setup
  })
})

describe('sync queue', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const gate = () => { let open!: () => void; const p = new Promise<void>((r) => { open = r }); return { p, open } }

  it('runs one sync at a time, in order', async () => {
    const q = createSyncQueue(); const log: string[] = []; const g = gate()
    const first = q.run(async () => { log.push('a start'); await g.p; log.push('a end'); return true })
    await tick()
    const second = q.run(async () => { log.push('b'); return true })
    await tick()
    expect(log).toEqual(['a start'])
    g.open()
    expect(await Promise.all([first, second])).toEqual([true, true])
    expect(log).toEqual(['a start', 'a end', 'b'])
  })
  it('lets two calls made before a run starts share it', async () => {
    const q = createSyncQueue(); let runs = 0
    const task = async () => { runs += 1; return true }
    await Promise.all([q.run(task), q.run(task), q.run(task)])
    expect(runs).toBe(1)
  })
  it('on stop, drops queued syncs and waits for the one in flight, which is told it is no longer current', async () => {
    const q = createSyncQueue(); const g = gate(); let sawCurrent: boolean | null = null; let queuedRan = false
    const inFlight = q.run(async (isCurrent) => { await g.p; sawCurrent = isCurrent(); return false })
    await tick()
    const queued = q.run(async () => { queuedRan = true; return true })
    let stopped = false
    const stopping = q.stop().then(() => { stopped = true })
    await tick()
    expect(stopped).toBe(false) // still waiting for the one in flight
    g.open()
    await stopping
    expect(sawCurrent).toBe(false)
    expect(await queued).toBe(false)
    expect(queuedRan).toBe(false)
    await inFlight
  })
  it('works again after a stop, and one failed sync does not block the next', async () => {
    const q = createSyncQueue()
    await q.stop()
    await expect(q.run(async () => { throw new Error('offline') })).rejects.toThrow('offline')
    let current: boolean | null = null
    expect(await q.run(async (isCurrent) => { current = isCurrent(); return true })).toBe(true)
    expect(current).toBe(true)
  })
})

describe('two devices saving at once', () => {
  const mk = (days: Record<string, number>) => parseImport(JSON.stringify({ days: Object.fromEntries(Object.entries(days).map(([k, u]) => [k, { w: u, u }])) }))
  const keys = (d: { days: Record<string, unknown> }) => Object.keys(d.days).sort()
  const always = async () => true

  /** An in-memory cloud row with a version stamp. `beforeWrite` lets a test run another device in the middle of a save. */
  function cloud(initial: ReturnType<typeof mk> | null) {
    let row = initial ? { data: initial as unknown, updated_at: 't0' } : null
    let n = 0
    const writes: string[] = []
    const remote = (beforeWrite?: () => Promise<void>): Remote => ({
      read: async () => (row ? { data: row.data, updated_at: row.updated_at } : null),
      write: async (data, expected) => {
        await beforeWrite?.()
        if ((row?.updated_at ?? null) !== expected) return { ok: false }
        row = { data, updated_at: 't' + ++n }
        writes.push(row.updated_at)
        return { ok: true }
      },
    })
    return { remote, writes, get data() { return row?.data as ReturnType<typeof mk> } }
  }
  const device = (c: ReturnType<typeof cloud>, start: ReturnType<typeof mk>, beforeWrite?: () => Promise<void>) => {
    let local = start
    const run = () => pushMerge({ remote: c.remote(beforeWrite), getLocal: () => local, apply: (m) => { local = m }, guard: always })
    return { run, get local() { return local } }
  }

  it('creates the row on a first save', async () => {
    const c = cloud(null)
    expect(await device(c, mk({ '2026-10-30': 10 })).run()).toBe('saved')
    expect(keys(c.data)).toEqual(['2026-10-30'])
  })
  it('keeps both edits when the other device saves in the middle of a save', async () => {
    const c = cloud(mk({ '2026-10-30': 10 }))
    const b = device(c, mk({ '2026-10-30': 10, '2026-10-31': 30 }))
    let injected = false
    const a = device(c, mk({ '2026-10-30': 10, '2026-11-01': 20 }), async () => {
      if (injected) return
      injected = true
      expect(await b.run()).toBe('saved') // B saves after A read, before A writes
    })
    expect(await a.run()).toBe('saved')
    expect(keys(c.data)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
    expect(keys(a.local)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']) // A now holds B's edit too
  })
  it('keeps both when two new devices both find no row', async () => {
    const c = cloud(null)
    const b = device(c, mk({ '2026-10-31': 30 }))
    let injected = false
    const a = device(c, mk({ '2026-11-01': 20 }), async () => { if (!injected) { injected = true; await b.run() } })
    expect(await a.run()).toBe('saved')
    expect(keys(c.data)).toEqual(['2026-10-31', '2026-11-01'])
  })
  it('does not write when the cloud already matches', async () => {
    const c = cloud(mk({ '2026-10-30': 10 }))
    expect(await device(c, mk({ '2026-10-30': 10 })).run()).toBe('saved')
    expect(c.writes).toEqual([])
  })
  it('pulls in a newer cloud edit without writing it back', async () => {
    const c = cloud(mk({ '2026-10-30': 10, '2026-10-31': 30 }))
    const d = device(c, mk({ '2026-10-30': 10 }))
    expect(await d.run()).toBe('saved')
    expect(keys(d.local)).toEqual(['2026-10-30', '2026-10-31'])
    expect(c.writes).toEqual([])
  })
  it('gives up as busy, never loops forever, when every save loses the race', async () => {
    const c = cloud(mk({ '2026-10-30': 10 }))
    let tries = 0
    const r = await pushMerge({
      remote: { read: async () => ({ data: mk({ '2026-10-30': 10 }), updated_at: 't0' }), write: async () => { tries++; return { ok: false } } },
      getLocal: () => mk({ '2026-10-30': 10, '2026-10-31': 30 }), apply: () => {}, guard: always,
    })
    expect(r).toBe('busy')
    expect(tries).toBe(4)
    expect(c.writes).toEqual([])
  })
  it('writes nothing once the guard says the person signed out', async () => {
    const c = cloud(mk({ '2026-10-30': 10 }))
    const r = await pushMerge({ remote: c.remote(), getLocal: () => mk({ '2026-10-30': 10, '2026-10-31': 30 }), apply: () => {}, guard: async () => false })
    expect(r).toBe('cancelled')
    expect(c.writes).toEqual([])
  })
  it('gives each write a later stamp than the one it read', () => {
    const before = '2026-10-31T10:00:00.500Z'
    expect(nextStamp(before, Date.parse(before) - 5000)).toBe('2026-10-31T10:00:00.501Z') // slow clock still moves forward
    expect(nextStamp(before, Date.parse(before) + 5000)).toBe('2026-10-31T10:00:05.500Z')
    expect(nextStamp(null, 0)).toBe('1970-01-01T00:00:00.000Z')
    expect(Date.parse(nextStamp('2026-10-31T10:00:00.123456+00:00', 0))).toBeGreaterThan(Date.parse('2026-10-31T10:00:00.123456+00:00')) // a row with microseconds
  })
  it('compares by content, not key order', () => {
    expect(stable({ b: 1, a: { d: [1, { y: 1, x: 2 }], c: 3 } })).toBe(stable({ a: { c: 3, d: [1, { x: 2, y: 1 }] }, b: 1 }))
    expect(stable({ a: 1 })).not.toBe(stable({ a: 2 }))
  })
})

describe('password reset', () => {
  it('asks for a long enough password, typed twice the same', () => {
    expect(passwordProblem('12345', '12345')).toMatch(/at least 6/)
    expect(passwordProblem('123456', '1234567')).toMatch(/do not match/)
    expect(passwordProblem('123456', '123456')).toBe('')
  })
  it('sends the person back to this app, not to a page with old tokens in it', () => {
    expect(resetRedirect({ origin: 'https://x.github.io', pathname: '/trck/' })).toBe('https://x.github.io/trck/')
  })
  it('recognises a good reset link from the address', () => {
    expect(recoveryKind('#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery')).toBe('recovery')
  })
  it('recognises a used or old reset link', () => {
    expect(recoveryKind('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toBe('expired')
  })
  it('ignores every other address, including a sign up link and a plain visit', () => {
    expect(recoveryKind('')).toBeNull()
    expect(recoveryKind('#access_token=abc&refresh_token=r&type=signup')).toBeNull()
    expect(recoveryKind('#type=recovery')).toBeNull() // no tokens, so nothing to use
    expect(recoveryKind('#type=recovery&access_token=abc')).toBeNull() // both tokens are needed
    expect(recoveryKind('', '?type=recovery&token_hash=x')).toBeNull() // the app does not use that kind of link
    expect(recoveryKind('', '?utm=1')).toBeNull()
  })
  it('pulls both tokens out of a good link, and nothing out of anything else', () => {
    expect(recoveryTokens('#access_token=a.b.c&refresh_token=r1&type=recovery')).toEqual({ access_token: 'a.b.c', refresh_token: 'r1' })
    expect(recoveryTokens('#access_token=a.b.c&refresh_token=r1&type=signup')).toBeNull()
    expect(recoveryTokens('#error=access_denied&error_code=otp_expired')).toBeNull()
  })
  it('turns Supabase wording into plain words', () => {
    expect(friendlyAuthError('email rate limit exceeded')).toMatch(/Too many tries/)
    expect(friendlyAuthError('For security purposes, you can only request this after 56 seconds.')).toMatch(/Too many tries/)
    expect(friendlyAuthError('Email address not authorized')).toMatch(/Ask Aditya/)
    expect(friendlyAuthError('Auth session missing!')).toMatch(/expired/)
    expect(friendlyAuthError('New password should be different from the old password.')).toMatch(/not used before/)
    expect(friendlyAuthError('something else')).toBe('something else')
  })
  it('leaves a wrong password, and other real sign in errors, in Supabase words', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Invalid login credentials')
    expect(friendlyAuthError('Email address "x" is invalid')).toBe('Email address "x" is invalid')
    expect(friendlyAuthError('User already registered')).toBe('User already registered')
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
  it('says so when not even one copy fits, so a caller can refuse to clear data', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('quota') } }
    expect(saveBackup('{"a":1}', 'before sign out', full)).toBe(false)
    expect(saveBackup('{"a":1}', 'before sign out', mem())).toBe(true)
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

import { liftTarget, MAX_MIN, MIN_PER_SET, planSession, swapLift, trainingStyle } from './plan'
import { atHour } from './dates'
describe('next session', () => {
  const T = '2026-10-31'
  const NOW = atHour(T, 20)
  const st = (n: number, w = 40, r = 10) => Array.from({ length: n }, () => ({ w, r }))
  const S23 = { ...DEFAULT_SETTINGS, hour: 23 }
  const upperYesterday = () => ({
    [addDays(T, -1)]: day({ lift: { chest: st(3), pulldown: st(3), row: st(3), ohp: st(3), curl: st(2), pushdown: st(2) } }),
  })
  const ids = (p: ReturnType<typeof planSession>) => p.lifts.map((l) => l.id)
  const UPPER_MAIN = ['chest', 'back', 'shoulders', 'biceps', 'triceps']

  it('plans legs and core the day after an upper body session (required example)', () => {
    const p = planSession(upperYesterday(), S23, T, NOW)
    expect(ids(p)).toEqual(expect.arrayContaining(['legpress', 'rdl', 'c_calf', 'crunch']))
    expect(p.lifts.find((l) => l.id === 'legpress')?.muscles).toEqual(['quads'])
    expect(p.lifts.find((l) => l.id === 'rdl')?.muscles).toEqual(['hamstrings', 'glutes'])
    expect(p.lifts.find((l) => l.id === 'c_calf')?.variation).toBe(true)
    for (const l of p.lifts) for (const [m, w] of Object.entries(l.ex.m)) if (w === 1) expect(UPPER_MAIN).not.toContain(m)
    expect(p.sets * MIN_PER_SET).toBeLessThanOrEqual(MAX_MIN)
    expect(p.minutes).toBe(p.sets * 3)
    expect(p.lifts[0].reason).toBe('Quads: ready, 0 of 8 sets this week')
    expect(p.lifts.find((l) => l.id === 'rdl')?.reason).toBe('Hamstrings and glutes: ready, 0 of 6 and 0 of 6 sets this week')
    expect(p.lifts.find((l) => l.id === 'c_calf')?.reason).toBe('Calves: ready, 0 of 6 sets this week. No calf lift in your routine yet.')
    expect(p.lifts.find((l) => l.id === 'c_legext')?.reason).toBe('Quads: still 5 short of 8 this week')
    expect(p.skipped).toContainEqual({ mu: 'chest', why: 'Recovering, ready in 27 h' })
  })
  it('gives a full body routine plan within the time cap with no history', () => {
    const p = planSession({}, S, T, NOW)
    const rt = new Set(ROUTINE.map((e) => e.id))
    expect(p.lifts.length).toBeGreaterThan(3)
    expect(p.lifts.every((l) => rt.has(l.id))).toBe(true)
    const m = p.lifts.flatMap((l) => l.muscles)
    expect(m).toEqual(expect.arrayContaining(['chest', 'back', 'quads', 'hamstrings']))
    expect(p.sets * MIN_PER_SET).toBeLessThanOrEqual(MAX_MIN)
    expect(p.style.kind).toBe('new')
    expect(p.skipped.every((x) => x.why === 'No time today')).toBe(true)
  })
  it('picks another quads lift when the leg press machine is off', () => {
    const p = planSession(upperYesterday(), { ...S23, noEq: ['legpress'] }, T, NOW)
    expect(ids(p)).not.toContain('legpress')
    const q = p.lifts.find((l) => l.muscles.includes('quads'))
    expect(['c_legext', 'c_goblet']).toContain(q?.id)
    expect(q?.variation).toBe(true)
  })
  it('ranks the lift with more history first', () => {
    const s = { ...S23, extra: ['c_legext', 'c_goblet'].map((id) => ({ ...CATALOG.find((c) => c.id === id)!, x: true })) }
    const days = { '2026-10-10': day({ lift: { c_goblet: st(3) } }), '2026-10-14': day({ lift: { c_goblet: st(3) } }), '2026-10-12': day({ lift: { c_legext: st(3) } }) }
    const p = planSession(days, { ...s, noEq: ['legpress'] }, T, NOW)
    expect(p.lifts.find((l) => l.muscles.includes('quads'))?.id).toBe('c_goblet')
  })
  it('does not plan a muscle above the top of its range', () => {
    const s = { ...S23, extra: [{ ...CATALOG.find((c) => c.id === 'c_calf')!, x: true }] }
    const p = planSession({ '2026-10-27': day({ lift: { c_calf: st(13) } }) }, s, T, NOW)
    expect(p.lifts.some((l) => l.ex.m.calves === 1)).toBe(false)
    expect(p.skipped).toContainEqual({ mu: 'calves', why: 'Done for this week' })
  })
  it('gives every lift a reason and target, and swaps never repeat a chosen lift', () => {
    for (const p of [planSession({}, S, T, NOW), planSession(upperYesterday(), S23, T, NOW)]) {
      const chosen = ids(p)
      for (const l of p.lifts) {
        expect(l.reason.length).toBeGreaterThan(0)
        expect(l.target.length).toBeGreaterThan(0)
        for (const a of l.alts) expect(chosen).not.toContain(a)
      }
    }
  })
  it('writes targets from the overload rule', () => {
    const days = { '2026-10-20': day({ lift: { legpress: st(3, 100, 12) } }), '2026-10-22': day({ lift: { rdl: [{ w: 35, r: 10 }, { w: 35, r: 9 }, { w: 30, r: 12 }] } }) }
    const ex = (id: string) => ROUTINE.find((e) => e.id === id)!
    expect(liftTarget(ex('legpress'), days, T)).toBe('105 kg x 8')
    expect(liftTarget(ex('rdl'), days, T)).toBe('35 kg x 11')
    expect(liftTarget(ex('rdl'), { '2026-10-22': day({ lift: { rdl: st(3, 35, 12) } }) }, T)).toBe('37.5 kg x 8')
    expect(liftTarget(ex('curl'), { '2026-10-22': day({ lift: { curl: [{ w: 10, r: 15 }] } }) }, T)).toBe('10 kg x 15')
    expect(planSession({}, S, T, NOW).lifts[0].target).toBe('Find a weight for 8 reps')
  })
  it('cycles swap options and keeps the time total right', () => {
    const p = planSession(upperYesterday(), { ...S23, noEq: ['legpress'] }, T, NOW)
    const i = p.lifts.findIndex((l) => l.alts.length > 0)
    expect(i).toBeGreaterThanOrEqual(0)
    const was = p.lifts[i].id
    const q = swapLift(p, i, upperYesterday(), S23, T)
    expect(q.lifts[i].id).toBe(p.lifts[i].alts[0])
    expect(q.lifts[i].alts).toContain(was)
    expect(q.minutes).toBe(q.sets * MIN_PER_SET)
  })
  it('detects full body and upper and lower styles', () => {
    const full: Record<string, Day> = {}
    for (const k of ['2026-10-06', '2026-10-09', '2026-10-13', '2026-10-16', '2026-10-20', '2026-10-23', '2026-10-27', '2026-10-30'])
      full[k] = day({ lift: { chest: st(3), legpress: st(3) } })
    expect(trainingStyle(full, S, T)).toEqual({ kind: 'full', text: 'Your last 8 sessions look like full body, about 2 a week.' })
    const split: Record<string, Day> = {}
    ;['2026-10-20', '2026-10-22', '2026-10-24', '2026-10-27', '2026-10-29'].forEach((k, i) => {
      split[k] = day({ lift: i % 2 ? { legpress: st(3), rdl: st(3) } : { chest: st(3), row: st(3) } })
    })
    expect(trainingStyle(split, S, T)).toEqual({ kind: 'upper-lower', text: 'Your last 5 sessions look like an upper and lower split, about 1.5 a week.' })
  })
  it('still uses a recovering muscle as a helper', () => {
    const p = planSession({ [addDays(T, -1)]: day({ lift: { pulldown: st(3), row: st(3) } }) }, S23, T, NOW)
    expect(hoursLeft({ [addDays(T, -1)]: day({ lift: { pulldown: st(3), row: st(3) } }) }, S23, 'back', NOW)).toBeGreaterThan(0)
    expect(ids(p)).toContain('rdl')
    expect(p.lifts.every((l) => l.ex.m.back !== 1)).toBe(true)
  })
})
