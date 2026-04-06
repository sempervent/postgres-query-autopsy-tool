/**
 * Phase 66 — DOM-level theme smoke (no screenshot baselines).
 * Requires API + web reachable at baseURL (same as persisted-flows).
 */
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
  const health = await request.get('/api/health')
  expect(health.ok(), 'API must be reachable at the same origin as baseURL').toBeTruthy()
})

/** Clear theme storage once per test — do not use `addInitScript` (it runs on every navigation, breaking reload persistence). */
test.beforeEach(async ({ page }) => {
  await page.goto('about:blank')
  await page.evaluate(() => {
    try {
      localStorage.removeItem('pqat_theme_v1')
    } catch {
      /* ignore */
    }
  })
})

test('appearance: system follows color scheme; dark and light persist across reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme-preference', 'system')
  await expect(html).toHaveAttribute('data-effective-theme', 'light')
  await expect(page.getByTestId('theme-appearance-select')).toHaveValue('system')
  await expect(page.locator('.pqat-themeSelect__effective')).toContainText(/→\s*Light/i)

  await page.getByTestId('theme-appearance-select').selectOption('dark')
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(html).toHaveAttribute('data-effective-theme', 'dark')
  await expect(html).toHaveAttribute('data-theme-preference', 'dark')

  await page.reload()
  await expect(html).toHaveAttribute('data-theme-preference', 'dark')
  await expect(html).toHaveAttribute('data-effective-theme', 'dark')

  await page.getByTestId('theme-appearance-select').selectOption('light')
  await expect(html).toHaveAttribute('data-effective-theme', 'light')

  await page.reload()
  await expect(html).toHaveAttribute('data-effective-theme', 'light')

  await page.getByTestId('theme-appearance-select').selectOption('system')
  await expect(html).toHaveAttribute('data-theme-preference', 'system')
  await expect(html).toHaveAttribute('data-effective-theme', 'light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html).toHaveAttribute('data-effective-theme', 'dark')
  await expect(page.locator('.pqat-themeSelect__effective')).toContainText(/→\s*Dark/i)
})

test('appearance: workstation shell uses theme tokens on both skins', async ({ page }) => {
  await page.goto('/')
  const topBar = page.locator('.topBar')
  await expect(topBar).toBeVisible()

  await page.getByTestId('theme-appearance-select').selectOption('light')
  const lightBg = await topBar.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(lightBg.length).toBeGreaterThan(4)

  await page.getByTestId('theme-appearance-select').selectOption('dark')
  const darkBg = await topBar.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(darkBg.length).toBeGreaterThan(4)
  expect(darkBg).not.toBe(lightBg)
})
