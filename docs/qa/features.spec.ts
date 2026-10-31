import { expect, test, type Page } from '@playwright/test'

// 0.6.0: photo meal logging against a mocked Edge Function, and the next session card.
// These run on the e2e build (`npm run build:e2e`), which believes Supabase lives at http://127.0.0.1:54321.
test.use({ baseURL: 'http://localhost:4174/', viewport: { width: 360, height: 780 } })

const USER = '00000000-0000-4000-8000-000000000001'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64')
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Sections' })
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const REPLY = {
  items: [
    { name: 'Grilled chicken', grams: 150, protein: 46, fat: 5.4, carbs: 0, kcal: 235, confidence: 0.8 },
    { name: 'Chapati', grams: 80, count: 2, protein: 6, fat: 5, carbs: 36, kcal: 210, confidence: 0.7 },
    { name: 'Bhindi sabzi', grams: 120, protein: 3, fat: 6, carbs: 10, kcal: 106, confidence: 0.4 },
  ],
  questions: ['Was the chicken skinless?', 'Any butter on the rotis?'],
  fat_tsp: 1,
}

/** Signed in as a fake user, with a set up log, and every Supabase call mocked. */
async function signedIn(page: Page, days: Record<string, unknown> = {}) {
  await page.addInitScript(([uid, d]) => {
    const now = Math.floor(Date.now() / 1000)
    localStorage.setItem('sb-127-auth-token', JSON.stringify({
      access_token: 'e2e-token', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
      user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' },
    }))
    localStorage.setItem('trck:owner', uid as string)
    if (!localStorage.getItem('trck:v1')) localStorage.setItem('trck:v1', JSON.stringify({ version: 1, days: d, settings: { ready: true, start: '2026-10-30' }, su: 1 }))
  }, [USER, days] as const)
  await page.route('**/auth/v1/**', (r) => r.fulfill({ json: { id: USER, aud: 'authenticated', email: 'e2e@example.com' } }))
  await page.route('**/rest/v1/trck_state**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.fulfill({ status: 201, body: '' })))
}

async function openPhoto(page: Page) {
  await page.goto('/')
  await expect(tabs(page)).toBeVisible()
  await page.getByRole('button', { name: 'Add meal photo' }).click()
  await expect(page.getByText(/Google may use it to improve its models/)).toBeVisible()
}

test('a meal photo is read, checked, and logged only on confirm', async ({ page }) => {
  await signedIn(page)
  let sent: { image?: string; note?: string } = {}
  await page.route('**/functions/v1/meal-photo', async (r) => {
    sent = r.request().postDataJSON()
    expect(r.request().headers().authorization).toBe('Bearer e2e-token')
    await r.fulfill({ json: { ...REPLY, used: 1, cap: 20 } })
  })
  await openPhoto(page)
  await page.getByLabel(/What is in it/).fill('chicken, 2 rotis, little oil')
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: PNG })

  await expect(page.getByRole('heading', { name: /About \d+ to \d+ kcal/ })).toBeVisible()
  expect(sent.note).toBe('chicken, 2 rotis, little oil')
  expect(sent.image?.length).toBeGreaterThan(50)
  await expect(page.getByText('How much oil, ghee or butter went in?')).toBeVisible()
  await expect(page.getByText(/your values/).first()).toBeVisible() // Chapati became your Roti, chicken your Chicken
  await expect(page.getByText('Was the chicken skinless?')).toBeVisible()
  await expect(page.getByText('Any butter on the rotis?')).toHaveCount(0) // the app asks about fat itself
  await expect(page.getByRole('button', { name: /^Less / })).toHaveCount(0) // nothing logged yet
  expect(await sideways(page)).toBe(false)
  await page.screenshot({ path: `test-results/photo-review-${test.info().project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Oil, ghee or butter teaspoons plus' }).click()
  await page.getByRole('button', { name: 'Bhindi sabzi minus' }).click()
  await page.getByLabel('Also save as a favourite meal').check()
  await page.getByRole('button', { name: 'Log meal' }).click()

  await expect(page.getByText(/from a photo/)).toBeVisible()
  const stored = await page.evaluate(() => localStorage.getItem('trck:v1') ?? '')
  const all = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '').join(''))
  expect(all).not.toContain(sent.image!.slice(0, 40)) // the photo is kept nowhere
  const data = JSON.parse(stored)
  const entry = Object.values(data.days as Record<string, { f: { src?: string; parts: { n: string; q: number }[] }[] }>).flatMap((d) => d.f).find((f) => f.src === 'photo')!
  expect(entry.parts.find((p) => p.n === 'Cooking oil')?.q).toBe(1.5)
  expect(data.settings.meals.length).toBe(1)
})

test('over the daily cap, the Claude fallback still gets the meal logged', async ({ page }) => {
  await signedIn(page)
  await page.route('**/functions/v1/meal-photo', (r) => r.fulfill({ status: 429, json: { error: 'cap', cap: 20 } }))
  await openPhoto(page)
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText(/20 photos today, the daily limit/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy a prompt for Claude' })).toBeVisible()

  await page.getByLabel("Claude's reply").fill('not json at all')
  await page.getByRole('button', { name: 'Read the reply' }).click()
  await expect(page.getByRole('alert')).toContainText('not readable')

  await page.getByLabel("Claude's reply").fill('Sure:\n```json\n' + JSON.stringify(REPLY) + '\n```')
  await page.getByRole('button', { name: 'Read the reply' }).click()
  await page.getByRole('button', { name: 'Log meal' }).click()
  await expect(page.getByText(/from a photo/)).toBeVisible()
})

test('offline, the photo flow offers the Claude prompt instead of failing', async ({ page, context }) => {
  await signedIn(page)
  await openPhoto(page)
  await context.setOffline(true)
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText(/You are offline/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy a prompt for Claude' })).toBeVisible()
  await context.setOffline(false)
})

test('the day after an upper body session, Train suggests legs and core, and Start fills Train', async ({ page }) => {
  const y = new Date(Date.now() - 5 * 36e5)
  y.setDate(y.getDate() - 1)
  const sets = (n: number) => Array.from({ length: n }, () => ({ w: 30, r: 10 }))
  await signedIn(page, { [key(y)]: { lift: { chest: sets(3), pulldown: sets(3), row: sets(3), ohp: sets(3), curl: sets(2), pushdown: sets(2) }, done: true } })
  await page.goto('/')
  await tabs(page).getByRole('button', { name: 'Train' }).click()
  await expect(page.getByRole('heading', { name: "Today's session" })).toBeVisible()
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: "Today's session" }) })
  for (const n of ['Leg press', 'Romanian deadlift', 'Standing calf raise', 'Cable crunch']) await expect(card.getByText(n, { exact: true })).toBeVisible()
  await expect(card.getByText(/Quads: ready, 0 of 8 sets this week/)).toBeVisible()
  await expect(card.getByText('Chest press', { exact: true })).toHaveCount(0)
  expect(await sideways(page)).toBe(false)
  await page.screenshot({ path: `test-results/session-card-${test.info().project.name}.png`, fullPage: true })

  await card.getByRole('button', { name: 'Swap Leg press' }).click()
  await expect(card.getByText('Leg press', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Start this session' }).click()
  await expect(page.getByRole('heading', { name: /Today's session: \d+ lifts/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Standing calf raise', level: 3 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chest press', level: 3 })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show all lifts' }).click()
  await expect(page.getByRole('heading', { name: 'Chest press', level: 3 })).toBeVisible()
})

test('signing in with an emailed code, no password, and the log arrives from the cloud', async ({ page }) => {
  const asked: string[] = []
  const yest = new Date(Date.now() - 5 * 36e5)
  yest.setDate(yest.getDate() - 1)
  const cloud = { days: { [key(yest)]: { f: [{ id: 'a', n: 'Egg', p: 6.3, k: 70, q: 3 }], w: 5, u: 5 } }, settings: { ready: true, start: '2026-10-30' }, version: 1, su: 5 }
  await page.route('**/auth/v1/otp**', async (r) => { asked.push(r.request().postDataJSON().email); await r.fulfill({ json: {} }) })
  await page.route('**/auth/v1/verify**', async (r) => {
    const b = r.request().postDataJSON()
    if (b.token !== '123456') return r.fulfill({ status: 403, json: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } })
    const now = Math.floor(Date.now() / 1000)
    await r.fulfill({ json: { access_token: 'e2e-token', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
      user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' } } })
  })
  await page.route('**/auth/v1/user**', (r) => r.fulfill({ json: { id: USER, aud: 'authenticated', email: 'e2e@example.com' } }))
  await page.route('**/rest/v1/trck_state**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ json: [{ data: cloud, updated_at: '2026-10-31T10:00:00.000Z' }] }) : r.fulfill({ status: 200, json: [{ user_id: USER }] })))
  await page.addInitScript(() => { if (!localStorage.getItem('trck:v1')) localStorage.setItem('trck:v1', JSON.stringify({ version: 1, days: {}, settings: { ready: true, start: '2026-10-30' }, su: 1 })) })

  await page.goto('/')
  await tabs(page).getByRole('button', { name: 'Plan' }).click()
  await expect(page.getByLabel('Password')).toHaveCount(0) // the code is the way in, no password field first
  await page.getByLabel('Email', { exact: true }).fill('e2e@example.com')
  await page.getByRole('button', { name: 'Email me a sign in link' }).click()
  await expect(page.getByLabel('Code from the email')).toBeVisible()
  expect(asked).toEqual(['e2e@example.com'])

  await page.getByLabel('Code from the email').fill('000 000')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(/wrong or has expired/)).toBeVisible()

  await page.getByLabel('Code from the email').fill('123 456')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(/Signed in as e2e@example.com/)).toBeVisible()
  await tabs(page).getByRole('button', { name: 'Today' }).click()
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page.getByRole('button', { name: 'Less Egg' })).toBeVisible() // yesterday's log came down from the cloud
})

test('tapping the emailed sign in link signs you in, wipes the address, and brings the log down', async ({ page }) => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
  const yest = new Date(Date.now() - 5 * 36e5)
  yest.setDate(yest.getDate() - 1)
  const cloud = { days: { [key(yest)]: { f: [{ id: 'a', n: 'Egg', p: 6.3, k: 70, q: 3 }], w: 5, u: 5 } }, settings: { ready: true, start: '2026-10-30' }, version: 1, su: 5 }
  await page.route('**/auth/v1/user**', (r) => r.fulfill({ json: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' } }))
  await page.route('**/rest/v1/trck_state**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ json: [{ data: cloud, updated_at: '2026-10-31T10:00:00.000Z' }] }) : r.fulfill({ status: 200, json: [{ user_id: USER }] })))
  await page.addInitScript(() => { if (!localStorage.getItem('trck:v1')) localStorage.setItem('trck:v1', JSON.stringify({ version: 1, days: {}, settings: { ready: true, start: '2026-10-30' }, su: 1 })) })

  await page.goto(`/#access_token=${jwt}&refresh_token=e2e-refresh&expires_in=3600&token_type=bearer&type=magiclink`)
  await expect(tabs(page)).toBeVisible()
  expect(page.url()).not.toContain('access_token') // the proof never stays in the address or history
  await tabs(page).getByRole('button', { name: 'Plan' }).click()
  await expect(page.getByText(/Signed in as e2e@example.com/)).toBeVisible()
  await tabs(page).getByRole('button', { name: 'Today' }).click()
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page.getByRole('button', { name: 'Less Egg' })).toBeVisible()
})

test('after sign in with an empty account the screen holds still and sync does not repeat forever', async ({ page }) => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
  let reads = 0
  await page.route('**/auth/v1/user**', (r) => r.fulfill({ json: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' } }))
  await page.route('**/rest/v1/trck_state**', (r) => {
    if (r.request().method() === 'GET') { reads++; return r.fulfill({ json: [] }) } // an account with nothing saved yet
    return r.fulfill({ status: 201, body: '' })
  })
  await page.goto(`/#access_token=${jwt}&refresh_token=e2e-refresh&expires_in=3600&token_type=bearer&type=magiclink`)
  await expect(page.getByRole('heading', { name: 'Set up' })).toBeVisible()
  // Watch the screen for a few seconds. It must not flip between Set up and Today.
  const seen = new Set<string>()
  for (let i = 0; i < 18; i++) {
    seen.add((await page.getByRole('heading', { name: 'Set up' }).count()) ? 'setup' : 'other')
    await page.waitForTimeout(250)
  }
  expect([...seen]).toEqual(['setup'])
  expect(reads).toBeLessThanOrEqual(3) // one sync, maybe one more after the first save, never one every 1.5 seconds
  await expect(page.getByText(/Signed in as e2e@example.com/)).toBeVisible() // the Set up screen says who is signed in
})
