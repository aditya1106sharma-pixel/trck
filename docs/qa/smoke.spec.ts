import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

test('loads without scrolling sideways', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible()
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(wide).toBe(false)
})

test('a logged food is still there after a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Add .*grams protein/ }).first().click()
  const less = page.getByRole('button', { name: /^Less / })
  await expect(less.first()).toBeVisible()
  await page.reload()
  await expect(less.first()).toBeVisible()
})

test('Plan shows the version that was built', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Plan' }).click()
  await expect(page.getByTestId('version')).toHaveText(version)
})
