import { describe, expect, it } from 'vitest'
import { blankData, exportJson, normDay, parseImport } from './store'
import { applyImport, chatFoodId, exportLine, exportSync, parseSync, planImport, type Parsed } from './tracksync'
import { blankDay, type AppData, type Day } from './types'

const TODAY = '2026-11-02'
const day = (o: Partial<Day>): Day => ({ ...blankDay(), u: 1, ...o })

function sample(): AppData {
  const d = blankData()
  d.days['2026-10-31'] = day({
    wt: 72.4, sleep: 6.5, s: { creatine: true },
    f: [{ id: 'a', n: 'Egg', p: 6.3, f: 5, cb: 0.4, k: 72, q: 3 }, { id: 'b', n: 'Chicken', p: 31, f: 3.6, cb: 0, k: 165, q: 1.5 }],
  })
  d.days['2026-11-01'] = day({
    wt: 72.1, done: true, note: 'Felt strong\nshoulder | tight',
    f: [{ id: 'c', n: 'Protein scoop', p: 24, f: 1.5, cb: 3, k: 120, q: 2 }],
    lift: { pulldown: [{ w: 45, r: 10 }, { w: 45, r: 10 }, { w: 45, r: 9 }], row: [{ w: 40, r: 10 }, { w: 42.5, r: 8 }], curl: [{ w: null, r: null }] },
  })
  return d
}

const parse = (t: string, d: AppData): Parsed[] => {
  const r = parseSync(t, d.settings, TODAY)
  if (!r.ok) throw new Error(r.errors.join('\n'))
  return r.days
}
const run = (t: string, d: AppData, take: string[] = []) => {
  const plan = planImport(d, parse(t, d))
  return { plan, ...applyImport(d, plan, new Set(take), 99) }
}

describe('TRCK-SYNC export', () => {
  it('prints the header and the last N days oldest first, with missing tracked keys', () => {
    const out = exportSync(sample(), 3, TODAY).split('\n')
    expect(out[0]).toBe('TRCK-SYNC v1')
    expect(out[1]).toBe('date=2026-10-31 | weight_kg=72.4 | sleep_hrs=6.5 | protein_g=65.4 | kcal=463.5 | meals=Egg x3, Chicken x1.5 | session=rest | missing: notes')
    expect(out[2]).toBe('date=2026-11-01 | weight_kg=72.1 | protein_g=48 | kcal=240 | meals=Protein scoop x2 | session=back | top_sets=pulldown 45x10,10,9; row 40x10,42.5x8 | notes=Felt strong / shoulder / tight | missing: sleep_hrs')
    expect(out[3]).toBe('date=2026-11-02 | missing: weight_kg, sleep_hrs, protein_g, kcal, meals, session, top_sets, notes')
  })
  it('defaults to 2 days', () => { expect(exportSync(sample(), undefined, TODAY).split('\n')).toHaveLength(3) })
  it('prints chat-only values and a chat session label', () => {
    const d = day({ chat: { energy: '4', session: 'badminton', sleep_in: '00:30' } })
    expect(exportLine(d, '2026-10-30', blankData().settings)).toBe('date=2026-10-30 | sleep_in=00:30 | session=badminton | energy=4 | missing: weight_kg, sleep_hrs, protein_g, kcal, meals, top_sets, notes')
  })
})

describe('TRCK-SYNC import', () => {
  it('changes nothing when its own export comes back', () => {
    const d = sample()
    const r = run(exportSync(d, 5, TODAY), d)
    expect(r.plan.adds).toEqual([])
    expect(r.plan.conflicts).toEqual([])
    expect(r.changed).toEqual([])
    expect(exportJson(r.data)).toBe(exportJson(d))
  })
  it('creates a new day and stores every key, then a second import of the same text changes nothing', () => {
    const t = 'TRCK-SYNC v1\ndate=2026-10-30 | weight_kg=72.8 | sleep_in=00:30 | sleep_out=07:15 | sleep_hrs=6.75 | sleep_q=3 | steps=8400 | protein_g=118.35 | kcal=2100 | meals=eggs, dal rice | session=badminton | top_sets=Lat pulldown 40x12 | gummy=none | energy=4 | hunger=2 | gut=3 | notes=ok'
    const d = sample()
    const r = run(t, d)
    const nd = r.data.days['2026-10-30']
    expect(r.changed).toEqual(['2026-10-30'])
    expect(nd).toMatchObject({ wt: 72.8, sleep: 6.75, note: 'ok', u: 99, lift: { pulldown: [{ w: 40, r: 12 }] } })
    expect(nd.f).toEqual([{ id: chatFoodId('2026-10-30'), n: 'eggs, dal rice', p: 118.35, k: 2100, q: 1, t: 'chat' }])
    expect(nd.chat).toEqual({ sleep_in: '00:30', sleep_out: '07:15', sleep_q: '3', steps: '8400', session: 'badminton', gummy: 'none', energy: '4', hunger: '2', gut: '3' })
    const again = run(t, r.data)
    expect(again.plan.adds).toEqual([])
    expect(again.plan.conflicts).toEqual([])
    expect(again.changed).toEqual([])
  })
  it('never clears a stored value with a blank, and leaves lifts not named alone', () => {
    const d = sample()
    const r = run('TRCK-SYNC v1\ndate=2026-11-01 | weight_kg= | notes= | top_sets=row 40x10,42.5x8', d)
    expect(r.changed).toEqual([])
    expect(r.data.days['2026-11-01'].wt).toBe(72.1)
  })
  it('lists a different value as a conflict and keeps TRCK unless picked', () => {
    const d = sample()
    const t = 'TRCK-SYNC v1\ndate=2026-10-31 | weight_kg=72.6 | energy=3\ndate=2026-11-01 | top_sets=pulldown 47.5x10,10,9'
    const kept = run(t, d)
    expect(kept.plan.conflicts.map((c) => c.id)).toEqual(['2026-10-31:weight_kg', '2026-11-01:top_sets:pulldown'])
    expect(kept.data.days['2026-10-31'].wt).toBe(72.4)
    expect(kept.data.days['2026-10-31'].chat).toEqual({ energy: '3' })
    expect(kept.changed).toEqual(['2026-10-31'])
    const took = run(t, d, ['2026-10-31:weight_kg', '2026-11-01:top_sets:pulldown'])
    expect(took.data.days['2026-10-31'].wt).toBe(72.6)
    expect(took.data.days['2026-11-01'].lift.pulldown).toEqual([{ w: 47.5, r: 10 }, { w: 47.5, r: 10 }, { w: 47.5, r: 9 }])
    expect(took.data.days['2026-11-01'].lift.row).toEqual(d.days['2026-11-01'].lift.row)
    expect(d.days['2026-10-31'].wt).toBe(72.4) // the input is not changed
  })
  it('raises a food total with one chat entry and never lowers foods logged in the app', () => {
    const d = sample()
    const up = run('TRCK-SYNC v1\ndate=2026-10-31 | protein_g=80', d, ['2026-10-31:protein_g'])
    const f = up.data.days['2026-10-31'].f
    expect(f.slice(0, 2)).toEqual(d.days['2026-10-31'].f)
    expect(f[2]).toMatchObject({ id: chatFoodId('2026-10-31'), n: 'Logged in chat', p: 14.6, k: 0 })
    expect(run('TRCK-SYNC v1\ndate=2026-10-31 | protein_g=80', up.data).plan.conflicts).toEqual([])
    const down = run('TRCK-SYNC v1\ndate=2026-10-31 | protein_g=50 | meals=eggs', d)
    expect(down.plan.conflicts).toEqual([])
    expect(down.plan.notes.join(' ')).toMatch(/protein_g: kept 65.4/)
    expect(down.plan.notes.join(' ')).toMatch(/meals: kept/)
    expect(down.changed).toEqual([])
  })
})

describe('TRCK-SYNC checks', () => {
  const S = blankData().settings
  const errs = (t: string) => { const r = parseSync(t, S, TODAY); return r.ok ? [] : r.errors }
  it('needs the header', () => { expect(errs('date=2026-11-01')).toEqual(['The first line must be "TRCK-SYNC v1".']) })
  it('skips code fences and the missing note', () => {
    expect(parseSync('```text\nTRCK-SYNC v1\ndate=2026-11-01 | missing: kcal\n```', S, TODAY).ok).toBe(true)
  })
  it('rejects unknown keys, bad dates and out of range values', () => {
    const e = errs('TRCK-SYNC v1\ndate=2026-11-31\ndate=01-11-2026\ndate=2026-11-05\ndate=2026-11-01 | mood=5 | energy=7 | sleep_in=25:00 | weight_kg=heavy | steps=1.5 | sleep_hrs=6.125')
    expect(e).toHaveLength(9)
    expect(e.join('\n')).toMatch(/unknown key "mood"/)
    expect(e.join('\n')).toMatch(/after today/)
  })
  it('rejects a lift not in the routine, a first set with no weight and duplicate dates', () => {
    expect(errs('TRCK-SYNC v1\ndate=2026-11-01 | top_sets=deadlift 100x5')[0]).toMatch(/not a lift in your routine/)
    expect(errs('TRCK-SYNC v1\ndate=2026-11-01 | top_sets=row 10,10')[0]).toMatch(/needs a weight/)
    expect(errs('TRCK-SYNC v1\ndate=2026-11-01\ndate=2026-11-01')[0]).toMatch(/more than one line/)
  })
})

describe('chat field in storage', () => {
  it('keeps known string values and drops the rest', () => {
    const d = normDay({ chat: { energy: '4', mood: '5', gut: 3, steps: ' ' } as never })
    expect(d.chat).toEqual({ energy: '4' })
    expect(normDay({}).chat).toBeUndefined()
  })
  it('survives a file export and import', () => {
    const a = blankData()
    a.days['2026-11-01'] = day({ chat: { session: 'badminton' } })
    expect(parseImport(exportJson(a)).days['2026-11-01'].chat).toEqual({ session: 'badminton' })
  })
})
