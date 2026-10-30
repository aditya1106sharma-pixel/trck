import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Sections' })
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

async function setUp(page: Page, kg = '70') {
  await page.goto('/')
  await page.getByLabel('Body weight in kg').fill(kg)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(tabs(page)).toBeVisible()
}

test('a new person sees setup, fitting the phone, and starts clean', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Set up' })).toBeVisible()
  expect(await sideways(page)).toBe(false)
  await page.getByLabel('Body weight in kg').fill('70')
  await expect(page.getByLabel('Daily protein target in g')).toHaveValue('125')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(tabs(page)).toBeVisible()
  expect(await sideways(page)).toBe(false)
  await expect(page.getByRole('button', { name: /^Less / })).toHaveCount(0)
  await tabs(page).getByRole('button', { name: 'Plan' }).click()
  await expect(page.getByLabel('Protein g', { exact: true })).toHaveValue('125')
  await page.reload()
  await expect(tabs(page)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Set up' })).toHaveCount(0)
})

test('someone with logged days skips setup', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('trck:v1', JSON.stringify({ version: 1, days: { '2026-10-30': { w: 3 } }, settings: {} })))
  await page.goto('/')
  await expect(tabs(page)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Set up' })).toHaveCount(0)
})

test('a logged food is still there after a reload', async ({ page }) => {
  await setUp(page)
  await page.getByRole('button', { name: /^Add .*grams protein/ }).first().click()
  const less = page.getByRole('button', { name: /^Less / })
  await expect(less.first()).toBeVisible()
  await page.reload()
  await expect(less.first()).toBeVisible()
})

test('Plan shows the version that was built', async ({ page }) => {
  await setUp(page)
  await tabs(page).getByRole('button', { name: 'Plan' }).click()
  await expect(page.getByTestId('version')).toHaveText(version)
})
