import { expect, test, type Page, type Route } from '@playwright/test'

// The gym app on the e2e build, which believes Supabase lives at http://127.0.0.1:54321. Every call is mocked here.
const BASE = 'http://localhost:4174/gym/'
const USER = '00000000-0000-0000-0000-0000000000aa'
const GYM = '00000000-0000-0000-0000-0000000000g1'.replace('g', '0')
const MONTHLY = '00000000-0000-0000-0000-0000000000p1'.replace('p', '0')
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const shift = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }

const gym = { id: GYM, slug: 'forge', name: 'Forge Fitness', phone: '+919800000000', address: 'MG Road', time_zone: 'Asia/Kolkata', templates: {}, join_open: true }
const plans = [{ id: MONTHLY, gym_id: GYM, name: 'Monthly', months: 1, days: 0, price: 1500, active: true, sort: 1 }]
const client = (id: string, name: string, phone: string) => ({
  id, gym_id: GYM, user_id: null, full_name: name, phone, email: null, dob: null, gender: null, goal: null, emergency_name: null, emergency_phone: null,
  source: null, health: {}, health_flag: false, health_note: null, consent_whatsapp: true, notes: null, archived: false, created_at: '2026-10-01T00:00:00Z',
})

async function mockTrack(page: Page) {
  await page.route('**/rest/v1/rpc/track', (r) => r.fulfill({ status: 204, body: '' }))
  await page.route('**/rest/v1/rpc/log_error', (r) => r.fulfill({ status: 204, body: '' }))
}

async function signedIn(page: Page) {
  await page.addInitScript((uid) => {
    const now = Math.floor(Date.now() / 1000)
    localStorage.setItem('trck-gym-auth', JSON.stringify({
      access_token: 'e2e-token', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
      user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' },
    }))
  }, USER)
  await page.route('**/auth/v1/**', (r) => r.fulfill({ json: { id: USER, aud: 'authenticated', email: 'owner@example.com' } }))
  await mockTrack(page)
}

/** A small gym: one request waiting, one plan ending in 2 days, one member owing money. Changes as the app writes. */
function gymState() {
  const today = todayIST()
  return {
    today,
    requests: [{
      id: 'r1', gym_id: GYM, status: 'pending', full_name: 'Priya Nair', phone: '+919004051288', email: 'priya@example.com', dob: '1998-05-02', gender: 'Female',
      goal: 'Get fit', emergency_name: null, emergency_phone: null, source: 'Instagram', plan_interest: MONTHLY, health: { joint: true }, health_flag: true,
      health_note: 'Old knee injury', consent_whatsapp: true, client_id: null, reject_reason: null, created_at: `${today}T04:00:00Z`, decided_at: null,
    }] as Record<string, unknown>[],
    clients: [client('c1', 'Arjun Singh', '+919811145678'), client('c2', 'Sneha Kulkarni', '+919920033415')],
    memberships: [
      { id: 'm1', gym_id: GYM, client_id: 'c1', plan_id: MONTHLY, plan_name: 'Monthly', start_date: shift(today, -28), end_date: shift(today, 2), price: 1500, status: 'active' },
      { id: 'm2', gym_id: GYM, client_id: 'c2', plan_id: MONTHLY, plan_name: 'Monthly', start_date: shift(today, -5), end_date: shift(today, 25), price: 1500, status: 'active' },
    ] as Record<string, unknown>[],
    payments: [
      { id: 'p1', receipt_no: 1, gym_id: GYM, client_id: 'c1', membership_id: 'm1', amount: 1500, method: 'upi', paid_on: shift(today, -28), voided: false },
      { id: 'p2', receipt_no: 2, gym_id: GYM, client_id: 'c2', membership_id: 'm2', amount: 500, method: 'cash', paid_on: shift(today, -5), voided: false },
    ] as Record<string, unknown>[],
  }
}

async function mockGym(page: Page, role: 'owner' | 'staff', s: ReturnType<typeof gymState>, onRpc: (name: string, body: Record<string, unknown>) => unknown = () => null) {
  await page.route('**/rest/v1/rpc/whoami', (r) => r.fulfill({ json: { role, gym_id: GYM, email: 'owner@example.com' } }))
  await page.route('**/rest/v1/gyms**', (r) => r.fulfill({ json: gym }))
  const table = (rows: () => unknown[]) => (r: Route) => (r.request().method() === 'GET' ? r.fulfill({ json: rows() }) : r.fulfill({ status: 201, body: '' }))
  await page.route('**/rest/v1/plans**', table(() => plans))
  await page.route('**/rest/v1/staff**', table(() => [{ id: 's1', gym_id: GYM, email: 'owner@example.com', user_id: USER, role: 'owner', name: 'Owner', created_at: '2026-01-01' }]))
  await page.route('**/rest/v1/join_requests**', table(() => s.requests))
  await page.route('**/rest/v1/clients**', table(() => s.clients))
  await page.route('**/rest/v1/memberships**', table(() => s.memberships))
  await page.route('**/rest/v1/payments**', table(() => s.payments))
  await page.route('**/rest/v1/messages**', table(() => []))
  for (const fn of ['approve_join_request', 'reject_join_request', 'add_membership', 'add_payment', 'insights']) {
    await page.route(`**/rest/v1/rpc/${fn}`, async (r) => r.fulfill({ json: onRpc(fn, r.request().postDataJSON() as Record<string, unknown>) }))
  }
}

test('a new member joins with the public form, fitting the phone', async ({ page }) => {
  await mockTrack(page)
  let sent: Record<string, unknown> | null = null
  await page.route('**/rest/v1/rpc/join_info', (r) => r.fulfill({ json: { name: 'Forge Fitness', open: true, plans: [{ id: MONTHLY, name: 'Monthly', price: 1500, months: 1, days: 0 }] } }))
  await page.route('**/rest/v1/rpc/submit_join_request', async (r) => { sent = (r.request().postDataJSON() as { p: Record<string, unknown> }).p; await r.fulfill({ json: 'new-id' }) })
  await page.goto(BASE + '#/join/forge')
  await expect(page.getByRole('heading', { name: 'Join Forge Fitness' })).toBeVisible()
  expect(await sideways(page)).toBe(false)

  await page.getByLabel('Full name').fill('Rohan Mehta')
  await page.getByLabel('Mobile number (WhatsApp)').fill('98765')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Use a 10 digit mobile number.')).toBeVisible()
  await page.getByLabel('Mobile number (WhatsApp)').fill('098765 43210')
  await page.getByLabel(/Gmail address/).fill('Rohan@Example.com')
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible()
  await page.getByRole('button', { name: 'Build muscle' }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.getByRole('heading', { name: 'Health and consent' })).toBeVisible()
  expect(await sideways(page)).toBe(false)
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByText('Answer each question with yes or no.')).toBeVisible()
  for (const group of await page.getByRole('group').filter({ has: page.getByRole('button', { name: 'No' }) }).all()) await group.getByRole('button', { name: 'No' }).click()
  await page.getByText(/My answers are true/).click()
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible()

  expect(sent).not.toBeNull()
  const p = sent as unknown as Record<string, unknown>
  expect(p.phone).toBe('+919876543210')
  expect(p.email).toBe('rohan@example.com')
  expect(p.goal).toBe('Build muscle')
  expect(p.consent_terms).toBe(true)
  expect(Object.values(p.health as Record<string, boolean>).every((v) => v === false)).toBe(true)
  expect('website' in p).toBe(false)
})

test('a wrong join link says so', async ({ page }) => {
  await mockTrack(page)
  await page.route('**/rest/v1/rpc/join_info', (r) => r.fulfill({ json: null }))
  await page.goto(BASE + '#/join/nope')
  await expect(page.getByText('This join link is not right.')).toBeVisible()
})

test('signed out people see Google sign in', async ({ page }) => {
  await page.goto(BASE)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  expect(await sideways(page)).toBe(false)
})

test('the owner sees today, approves a request and gets a welcome message to send', async ({ page }) => {
  await signedIn(page)
  const s = gymState()
  let approved: Record<string, unknown> | null = null
  await mockGym(page, 'owner', s, (fn, body) => {
    if (fn !== 'approve_join_request') return null
    approved = body
    s.requests[0] = { ...s.requests[0], status: 'approved', client_id: 'c3', decided_at: `${s.today}T05:00:00Z` }
    s.clients.push({ ...client('c3', 'Priya Nair', '+919004051288'), email: 'priya@example.com' })
    s.memberships.push({ id: 'm3', gym_id: GYM, client_id: 'c3', plan_id: MONTHLY, plan_name: 'Monthly', start_date: s.today, end_date: shift(s.today, 29), price: 1500, status: 'active' })
    s.payments.push({ id: 'p3', receipt_no: 3, gym_id: GYM, client_id: 'c3', membership_id: 'm3', amount: 1500, method: 'upi', paid_on: s.today, voided: false })
    return { client_id: 'c3', membership_id: 'm3', payment_id: 'p3' }
  })
  await page.goto(BASE)
  const nav = page.getByRole('navigation', { name: 'Sections' })
  await expect(nav.getByRole('button', { name: /Money/ })).toBeVisible()
  await expect(page.getByText('waiting to join', { exact: true })).toBeVisible()
  await expect(page.getByText('Arjun Singh')).toBeVisible() // ending in 2 days
  await expect(page.getByText('₹1,000 due')).toBeVisible() // Sneha
  expect(await sideways(page)).toBe(false)

  await page.getByRole('button', { name: /Priya Nair/ }).first().click()
  await expect(page.getByText('Old knee injury')).toBeVisible()
  await page.getByRole('button', { name: 'Approve and start a plan' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByRole('dialog', { name: 'Send on WhatsApp' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: /^Message/ })).toHaveValue(/Hi Priya, welcome to Forge Fitness! Your Monthly plan runs from .* Paid in full: ₹1,500\./)
  const wa = page.getByRole('link', { name: 'Open WhatsApp' })
  await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/919004051288\?text=Hi%20Priya/)

  const a = approved as unknown as Record<string, unknown>
  expect(a.p_request).toBe('r1')
  expect(a.p_plan).toBe(MONTHLY)
  expect(a.p_price).toBe(1500)
  expect(a.p_paid).toBe(1500)
  expect(a.p_method).toBe('upi')
})

test('a renewal reminder is filled in from Today', async ({ page }) => {
  await signedIn(page)
  await mockGym(page, 'owner', gymState())
  await page.goto(BASE)
  await page.getByRole('button', { name: 'WhatsApp Arjun Singh' }).click()
  await expect(page.getByRole('textbox', { name: /^Message/ })).toHaveValue(/Hi Arjun, your Monthly plan at Forge Fitness ends in 2 days/)
})

test('staff do not see money totals', async ({ page }) => {
  await signedIn(page)
  await mockGym(page, 'staff', gymState())
  await page.goto(BASE)
  const nav = page.getByRole('navigation', { name: 'Sections' })
  await expect(nav.getByRole('button', { name: 'Clients' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Money' })).toHaveCount(0)
})

test('a member sees days left and payments', async ({ page }) => {
  await signedIn(page)
  const today = todayIST()
  await page.route('**/rest/v1/rpc/whoami', (r) => r.fulfill({ json: { role: 'client', gym_id: GYM, client_id: 'c1', email: 'rohan@example.com' } }))
  await page.route('**/rest/v1/rpc/my_home', (r) => r.fulfill({ json: {
    client: { id: 'c1', full_name: 'Rohan Mehta', phone: '+919876543210', email: 'rohan@example.com' },
    gym: { name: 'Forge Fitness', phone: '+919800000000', address: 'MG Road', today },
    memberships: [{ id: 'm1', client_id: 'c1', plan_name: 'Quarterly', start_date: shift(today, -10), end_date: shift(today, 22), price: 4000, status: 'active' }],
    payments: [{ id: 'p1', receipt_no: 7, client_id: 'c1', membership_id: 'm1', amount: 4000, method: 'upi', paid_on: shift(today, -10) }],
  } }))
  await page.goto(BASE)
  await expect(page.getByText('Hi Rohan')).toBeVisible()
  await expect(page.locator('.big')).toContainText('23')
  await expect(page.getByText('receipt 7')).toBeVisible()
  expect(await sideways(page)).toBe(false)
})
