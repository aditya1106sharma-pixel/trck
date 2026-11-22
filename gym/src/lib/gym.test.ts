import { describe, expect, it } from 'vitest'
import { cell, clientsCsv } from './csv'
import { friendlyError, isNetworkError } from './errors'
import { addDays, addMonths, ageOn, daysBetween, fmtDate, membershipEnd, planLength, todayIn } from './dates'
import { funnelFrom, pct, revenueByMonth } from './insights'
import { blankJoin, checkStep, HEALTH_QUESTIONS, toPayload } from './join'
import { buildVars, DEFAULT_TEMPLATES, paymentLine, render, suggestedKind, templateFor } from './messages'
import { inr, parseAmount } from './money'
import { displayPhone, normalizePhone, waLink } from './phone'
import { buildRows, clientStatus, dueOn, endsInWords, filterRows, todayLists } from './status'
import type { Client, JoinRequest, Membership, Payment } from './types'

const mem = (id: string, start: string, end: string, price = 1500, extra: Partial<Membership> = {}): Membership =>
  ({ id, client_id: 'c1', plan_name: 'Monthly', start_date: start, end_date: end, price, status: 'active', ...extra })
const pay = (id: string, amount: number, membership_id: string | null, extra: Partial<Payment> = {}): Payment =>
  ({ id, receipt_no: 1, client_id: 'c1', membership_id, amount, method: 'upi', paid_on: '2026-01-01', ...extra })
const client = (id: string, name: string, extra: Partial<Client> = {}): Client => ({
  id, gym_id: 'g', user_id: null, full_name: name, phone: '+919876543210', email: null, dob: null, gender: null, goal: null,
  emergency_name: null, emergency_phone: null, source: null, health: {}, health_flag: false, health_note: null,
  consent_whatsapp: true, notes: null, archived: false, created_at: '2026-01-01T00:00:00Z', ...extra,
})

describe('phone numbers', () => {
  it('reads the ways people type an Indian mobile', () => {
    for (const raw of ['9876543210', '98765 43210', '+91 98765 43210', '+919876543210', '919876543210', '09876543210', '098765-43210', '(+91) 98765-43210'])
      expect(normalizePhone(raw), raw).toBe('+919876543210')
  })
  it('refuses numbers that cannot be a mobile', () => {
    for (const raw of ['', '12345', '5876543210', '98765432100', 'abcdefghij', '+91 12345 67890']) expect(normalizePhone(raw), raw).toBeNull()
  })
  it('keeps a foreign number typed with its code', () => {
    expect(normalizePhone('+1 415 555 2671')).toBe('+14155552671')
    expect(normalizePhone('+44 1')).toBeNull()
  })
  it('shows and links numbers', () => {
    expect(displayPhone('+919876543210')).toBe('98765 43210')
    expect(displayPhone('+14155552671')).toBe('+14155552671')
    expect(waLink('+919876543210', 'Hi Rohan, 50% off & more?')).toBe('https://wa.me/919876543210?text=Hi%20Rohan%2C%2050%25%20off%20%26%20more%3F')
  })
})

describe('dates', () => {
  it('works out today at the gym, not on the phone', () => {
    // 20:00 UTC on 22 Nov is already 23 Nov in India.
    expect(todayIn('Asia/Kolkata', new Date('2026-11-22T20:00:00Z'))).toBe('2026-11-23')
    expect(todayIn('Asia/Kolkata', new Date('2026-11-22T18:00:00Z'))).toBe('2026-11-22')
  })
  it('adds months like the database does', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })
  it('ends plans on the same days as membership_end() in schema.sql', () => {
    // Same four cases as supabase/gym/test/rls.sql, so app and database can never disagree.
    expect(membershipEnd('2026-01-15', 1, 0)).toBe('2026-02-14')
    expect(membershipEnd('2026-01-31', 1, 0)).toBe('2026-02-27')
    expect(membershipEnd('2026-03-01', 0, 7)).toBe('2026-03-07')
    expect(membershipEnd('2026-01-01', 12, 0)).toBe('2026-12-31')
  })
  it('counts days and formats dates', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2)
    expect(daysBetween('2026-03-29', '2026-03-28')).toBe(-1)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(fmtDate('2026-02-07')).toBe('7 Feb 2026')
    expect(fmtDate('2026-02-07', true)).toBe('7 Feb')
    expect(fmtDate('nonsense')).toBe('')
    expect(planLength(1, 0)).toBe('1 month')
    expect(planLength(0, 7)).toBe('7 days')
    expect(planLength(3, 15)).toBe('3 months and 15 days')
    expect(ageOn('1996-03-14', '2026-03-13')).toBe(29)
    expect(ageOn('1996-03-14', '2026-03-14')).toBe(30)
  })
})

describe('money', () => {
  it('writes rupees the Indian way', () => {
    expect(inr(0)).toBe('₹0')
    expect(inr(999)).toBe('₹999')
    expect(inr(1500)).toBe('₹1,500')
    expect(inr(148000)).toBe('₹1,48,000')
    expect(inr(12345678)).toBe('₹1,23,45,678')
    expect(inr(-500)).toBe('-₹500')
  })
  it('reads typed amounts', () => {
    expect(parseAmount('1,500')).toBe(1500)
    expect(parseAmount('₹ 4000')).toBe(4000)
    expect(parseAmount('Rs. 750')).toBe(750)
    expect(parseAmount('1500.00')).toBe(1500)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('12abc')).toBeNull()
    expect(parseAmount('99999999')).toBeNull()
  })
})

describe('where a client stands', () => {
  const today = '2026-02-20'
  it('active with days left', () => {
    const s = clientStatus([mem('m1', '2026-02-01', '2026-03-31')], [pay('p1', 1500, 'm1')], today)
    expect(s.state).toBe('active')
    expect(s.daysLeft).toBe(39)
    expect(s.due).toBe(0)
    expect(s.nextStart).toBe('2026-04-01')
  })
  it('ending inside a week, including the last day', () => {
    expect(clientStatus([mem('m1', '2026-01-28', '2026-02-27')], [], today).state).toBe('ending')
    const last = clientStatus([mem('m1', '2026-01-21', '2026-02-20')], [], today)
    expect(last.state).toBe('ending')
    expect(last.daysLeft).toBe(0)
    expect(endsInWords(0)).toBe('today')
    expect(endsInWords(1)).toBe('tomorrow')
    expect(endsInWords(5)).toBe('in 5 days')
  })
  it('a renewal already added means not ending', () => {
    const s = clientStatus([mem('m1', '2026-01-28', '2026-02-27'), mem('m2', '2026-02-28', '2026-03-27')], [], today)
    expect(s.state).toBe('active')
    expect(s.coveredThrough).toBe('2026-03-27')
    expect(s.nextStart).toBe('2026-03-28')
  })
  it('expired, and a renewal starts today, not back at the old end', () => {
    const s = clientStatus([mem('m1', '2026-01-01', '2026-01-31')], [], today)
    expect(s.state).toBe('expired')
    expect(s.daysSinceEnd).toBe(20)
    expect(s.nextStart).toBe(today)
  })
  it('cancelled plans count for nothing, voided payments count for nothing', () => {
    const s = clientStatus([mem('m1', '2026-02-01', '2026-03-31', 1500, { status: 'cancelled' })], [pay('p1', 1500, 'm1')], today)
    expect(s.state).toBe('none')
    expect(s.due).toBe(0)
    const v = clientStatus([mem('m1', '2026-02-01', '2026-03-31')], [pay('p1', 1000, 'm1', { voided: true }), pay('p2', 500, 'm1')], today)
    expect(v.due).toBe(1000)
    expect(v.paid).toBe(500)
  })
  it('upcoming plan', () => {
    const s = clientStatus([mem('m1', '2026-03-01', '2026-03-31')], [], today)
    expect(s.state).toBe('upcoming')
    expect(s.nextStart).toBe('2026-04-01')
  })
  it('due never goes below zero on a plan', () => {
    expect(dueOn(mem('m1', '2026-02-01', '2026-03-31', 1000), [pay('p1', 1200, 'm1')])).toBe(0)
  })
})

describe('the Today lists', () => {
  const today = '2026-02-20'
  const clients = [client('c1', 'Arjun'), client('c2', 'Priya'), client('c3', 'Old'), client('c4', 'Gone', { archived: true }), client('c5', 'Long ago')]
  const ms: Membership[] = [
    mem('m1', '2026-01-23', '2026-02-22', 1500, { client_id: 'c1' }),
    mem('m2', '2026-02-01', '2026-04-30', 4000, { client_id: 'c2' }),
    mem('m3', '2026-01-01', '2026-02-10', 1500, { client_id: 'c3' }),
    mem('m4', '2026-02-01', '2026-02-21', 1500, { client_id: 'c4' }),
    mem('m5', '2025-06-01', '2025-06-30', 1500, { client_id: 'c5' }),
  ]
  const ps: Payment[] = [pay('p1', 1500, 'm1', { client_id: 'c1' }), pay('p2', 2500, 'm2', { client_id: 'c2' }), pay('p5', 1500, 'm5', { client_id: 'c5' })]
  const req = (id: string, created: string, status: JoinRequest['status'] = 'pending') => ({ id, status, created_at: created }) as JoinRequest
  const rows = buildRows(clients, ms, ps, today)
  const t = todayLists(rows, [req('r2', '2026-02-19'), req('r1', '2026-02-18'), req('r3', '2026-02-01', 'approved')])

  it('lists who to act on, oldest request first, archived never', () => {
    expect(t.requests.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(t.ending.map((r) => r.client.full_name)).toEqual(['Arjun'])
    expect(t.expired.map((r) => r.client.full_name)).toEqual(['Old'])
    expect(t.dues.map((r) => r.client.full_name)).toEqual(['Priya', 'Old'])
    expect(t.counts).toEqual({ active: 2, ending: 1, expired: 1, requests: 2, due: 3000 })
  })
  it('filters and searches the client list', () => {
    expect(filterRows(rows, 'all', '').map((r) => r.client.id)).toEqual(['c1', 'c5', 'c3', 'c2'])
    expect(filterRows(rows, 'archived', '').map((r) => r.client.id)).toEqual(['c4'])
    expect(filterRows(rows, 'due', '').length).toBe(2)
    expect(filterRows(rows, 'all', 'pri').map((r) => r.client.id)).toEqual(['c2'])
    expect(filterRows(rows, 'all', '43210').length).toBe(4)
    expect(filterRows(rows, 'expired', '').map((r) => r.client.id)).toEqual(['c5', 'c3'])
  })
})

describe('WhatsApp messages', () => {
  const gym = { name: 'Forge Fitness', templates: {} }
  it('fills blanks and tidies empty ones', () => {
    expect(render('Hi {first}, {missing}welcome to {gym}.', { first: 'Rohan', gym: 'Forge' })).toBe('Hi Rohan, welcome to Forge.')
    expect(render('Ends {ends_in} ({end}).', { ends_in: 'today' })).toBe('Ends today.')
  })
  it('uses the owner wording when there is one', () => {
    expect(templateFor(gym, 'renewal')).toBe(DEFAULT_TEMPLATES.renewal)
    expect(templateFor({ templates: { renewal: 'Renew please {first}' } }, 'renewal')).toBe('Renew please {first}')
    expect(templateFor({ templates: { renewal: '   ' } }, 'renewal')).toBe(DEFAULT_TEMPLATES.renewal)
  })
  it('says what was paid', () => {
    expect(paymentLine(1500, 0)).toBe('Paid in full: ₹1,500.')
    expect(paymentLine(1000, 500)).toBe('Paid ₹1,000, ₹500 still due.')
    expect(paymentLine(0, 1500)).toBe('Amount due: ₹1,500.')
    expect(paymentLine(0, 0)).toBe('')
  })
  it('writes a full welcome and renewal for a real case', () => {
    const ms = [mem('m1', '2026-01-31', '2026-02-27')]
    const ps = [pay('p1', 1000, 'm1')]
    const status = clientStatus(ms, ps, '2026-02-25')
    const v = buildVars({ gym, name: ' Rohan  Mehta ', status, payments: ps, membership: ms[0] })
    expect(render(DEFAULT_TEMPLATES.welcome, v)).toBe('Hi Rohan, welcome to Forge Fitness! Your Monthly plan runs from 31 Jan 2026 to 27 Feb 2026. Paid ₹1,000, ₹500 still due. See you at the gym.')
    expect(render(DEFAULT_TEMPLATES.renewal, v)).toBe('Hi Rohan, your Monthly plan at Forge Fitness ends in 2 days (27 Feb 2026). Renew at the desk or reply here to keep going.')
    expect(suggestedKind(status)).toBe('renewal')
  })
  it('a receipt message names the payment', () => {
    const ms = [mem('m1', '2026-01-31', '2026-02-27')]
    const p = pay('p9', 1500, 'm1', { receipt_no: 42, paid_on: '2026-01-31' })
    const status = clientStatus(ms, [p], '2026-02-01')
    expect(render(DEFAULT_TEMPLATES.received, buildVars({ gym, name: 'Rohan', status, payments: [p], payment: p })))
      .toBe('Thanks Rohan, we received ₹1,500 at Forge Fitness on 31 Jan 2026. Receipt no. 42. Nothing is due now.')
  })
})

describe('join form', () => {
  const today = '2026-11-22'
  it('checks each step', () => {
    const f = blankJoin()
    expect(Object.keys(checkStep(0, f, today))).toEqual(['full_name', 'phone'])
    f.full_name = 'Rohan Mehta'; f.phone = '98765 43210'; f.email = 'rohan@'
    expect(checkStep(0, f, today)).toEqual({ email: 'Check the email address.' })
    f.email = ''
    expect(checkStep(0, f, today)).toEqual({})
    f.dob = '2020-01-01'
    expect(checkStep(1, f, today).dob).toBeTruthy()
    f.dob = '1996-03-14'
    expect(checkStep(1, f, today)).toEqual({})
    expect(Object.keys(checkStep(2, f, today))).toEqual(['health', 'consent_terms'])
    for (const h of HEALTH_QUESTIONS) f.health[h.key] = false
    f.consent_terms = true
    expect(checkStep(2, f, today)).toEqual({})
  })
  it('sends tidy values and drops the health note when every answer is no', () => {
    const f = { ...blankJoin(), full_name: ' Rohan   Mehta ', phone: '098765 43210', email: ' Rohan@X.com ', health: { heart: false }, health_note: 'none', consent_terms: true }
    const p = toPayload(f)
    expect(p.full_name).toBe('Rohan Mehta')
    expect(p.phone).toBe('+919876543210')
    expect(p.email).toBe('rohan@x.com')
    expect(p.health_note).toBeNull()
    expect('website' in p).toBe(false)
    expect(toPayload({ ...f, health: { heart: true } }).health_note).toBe('none')
  })
})

describe('insights', () => {
  it('adds up money by month and skips voided payments', () => {
    const ps = [pay('a', 1500, null, { paid_on: '2026-11-02' }), pay('b', 4000, null, { paid_on: '2026-11-20' }), pay('c', 999, null, { paid_on: '2026-11-21', voided: true }),
      pay('d', 1500, null, { paid_on: '2026-10-31' }), pay('e', 1500, null, { paid_on: '2025-01-01' })]
    const r = revenueByMonth(ps, '2026-11-22', 3)
    expect(r).toEqual([{ month: '2026-09', total: 0, count: 0 }, { month: '2026-10', total: 1500, count: 1 }, { month: '2026-11', total: 5500, count: 2 }])
  })
  it('works out the join funnel', () => {
    expect(funnelFrom({ join_viewed: 40, join_submitted: 10, request_approved: 8 }, 25)).toEqual({ viewed: 25, submitted: 10, approved: 8 })
    expect(pct(8, 10)).toBe(80)
    expect(pct(1, 0)).toBeNull()
  })
})

describe('clients sheet', () => {
  it('quotes awkward cells and defuses spreadsheet formulas', () => {
    expect(cell('Rohan')).toBe('Rohan')
    expect(cell('Mehta, Rohan')).toBe('"Mehta, Rohan"')
    expect(cell('Say "hi"')).toBe('"Say ""hi"""')
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(cell('+91 98765')).toBe("'+91 98765")
    expect(cell(null)).toBe('')
  })
  it('writes one row per client with status and money due', () => {
    const rows = buildRows([client('c1', 'Rohan Mehta', { email: 'r@x.com' })], [mem('m1', '2026-02-01', '2026-02-28')], [pay('p1', 1000, 'm1')], '2026-02-10')
    const lines = clientsCsv(rows).trim().split('\r\n')
    expect(lines[0]).toBe('Name,Phone,Email,Status,Plan,Covered till,Due (Rs),Goal,Joined,Archived')
    expect(lines[1]).toBe('Rohan Mehta,98765 43210,r@x.com,Active,Monthly,28 Feb 2026,500,,1 Jan 2026,No')
  })
})

describe('error wording', () => {
  it('keeps our own rule messages and rewords the rest', () => {
    expect(friendlyError({ code: 'P0001', message: 'Pick a plan.' })).toBe('Pick a plan.')
    expect(friendlyError({ message: 'TypeError: Failed to fetch' })).toMatch(/No connection/)
    expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint "clients_gym_id_phone_key"' })).toMatch(/phone number already exists/)
    expect(friendlyError({ code: '42501', message: 'permission denied for table payments' })).toMatch(/do not have access/)
    expect(friendlyError({ message: 'JWT expired' })).toMatch(/signed out/)
    expect(friendlyError({ code: 'XX000', message: 'internal' })).toMatch(/Something went wrong/)
    expect(isNetworkError('Load failed')).toBe(true)
  })
})
