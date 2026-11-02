import { describe, expect, it } from 'vitest'
import { chatBrief } from './brief'
import { blankData } from './store'
import { blankDay } from './types'

describe('chat brief', () => {
  const d = blankData()
  d.days['2026-11-01'] = { ...blankDay(), u: 1, done: true, cig: 4, w: 9, s: { creatine: true },
    f: [{ id: 'a', n: 'Egg', p: 6.3, k: 72, q: 4 }], lift: { pulldown: [{ w: 45, r: 10 }, { w: 45, r: 10 }, { w: 45, r: 9 }] } }
  const now = new Date(2026, 10, 2, 20).getTime()
  const t = chatBrief(d, '2026-11-02', now)
  it('holds targets, routine targets, the suggested session, habits and the sync log', () => {
    expect(t).toMatch(/Day 4 of 60, started 2026-10-30/)
    expect(t).toMatch(/protein 140 g/)
    expect(t).toMatch(/- pulldown: Lat pulldown \(back\), 3 x 8 to 12, step 2.5 kg, next: 45 kg x 11/)
    expect(t).toMatch(/TRCK'S SUGGESTED SESSION TODAY/)
    expect(t).toMatch(/- 2026-11-01: score \d+, protein 25 g, water 9, tea or coffee 0, cigarettes 4, cardio 0 min, supplements creatine, session done/)
    expect(t).toMatch(/MY LOG, LAST 7 DAYS\nTRCK-SYNC v1\ndate=2026-10-27/)
    expect(t).toMatch(/date=2026-11-01 .*top_sets=pulldown 45x10,10,9/)
  })
  it('does not plan back while it is recovering', () => {
    const plan = t.split("TRCK'S SUGGESTED SESSION TODAY")[1].split('MY WEEK')[0]
    expect(plan).not.toMatch(/\(pulldown\)/)
    expect(plan).toMatch(/back \(recovering/)
  })
  it('uses no em dashes or doubled full stops', () => { expect(t).not.toMatch(/\u2014|\.\./) })
})
