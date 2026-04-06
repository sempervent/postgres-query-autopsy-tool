/**
 * Phase 56–57 — canonical workstation visual regression.
 * Requires: API + web with `PQAT_E2E_ENABLED=true` (`.env.testing` Docker stack).
 * Access-denied frame uses `page.route` (403) so it stays deterministic without a second auth stack.
 * Update baselines (Linux, same as CI): from repo root, with stack up:
 *   docker compose --env-file .env.testing --profile testing run --rm \
 *     -e PLAYWRIGHT_CLI_ARGS="--project=e2e-visual --update-snapshots" playwright
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

function postgresJsonFixture(fileName: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', fileName)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
  const health = await request.get('/api/health')
  expect(health.ok(), 'API must be reachable (same origin as baseURL)').toBeTruthy()
})

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.addInitScript(() => {
    // Phase 65: lock dark theme for deterministic pixels (canonical visual baseline).
    try {
      localStorage.setItem('pqat_theme_v1', 'dark')
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.setAttribute('data-effective-theme', 'dark')
    document.documentElement.setAttribute('data-theme-preference', 'dark')
    document.documentElement.style.colorScheme = 'dark'
    document.documentElement.setAttribute('data-visual-regression', '1')
  })
})

async function waitForStableCanvas(page: Page) {
  await page.evaluate(() => document.fonts.ready)
}

/** Wait until React Flow has laid out at least one node (reduces graph flake on screenshots). */
async function waitForReactFlowNodes(page: Page) {
  await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 45_000 })
}

test('visual snapshot: Analyze happy path', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  await page.goto('/')
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByLabel('Analyze workspace')).toBeVisible({ timeout: 45_000 })
  await page.locator('.react-flow').waitFor({ state: 'visible', timeout: 45_000 }).catch(() => {})
  await waitForReactFlowNodes(page)
  await expect(page.getByRole('button', { name: /^Finding:/ }).first()).toBeVisible({ timeout: 30_000 })
  await waitForStableCanvas(page)
  await expect(page).toHaveScreenshot('analyze-happy.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('visual snapshot: Compare happy path', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  await page.goto('/compare')
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'Findings diff' })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })
  await expect(page.getByText('Key metric deltas')).toBeVisible({ timeout: 45_000 })
  await waitForStableCanvas(page)
  await expect(page).toHaveScreenshot('compare-happy.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('visual snapshot: Analyze corrupt artifact banner', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const res = await request.post('/api/e2e/seed/corrupt-analysis', {
    data: { analysisId: 'e2e-visual-corrupt-analysis' },
  })
  expect(res.ok(), await res.text()).toBeTruthy()

  await page.goto('/?analysis=e2e-visual-corrupt-analysis')
  await expect(page.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  const err = page.getByTestId('analyze-page-error')
  await expect(err).toBeVisible()
  await expect(err).toContainText(/corrupt|read|unreadable/i)
  await waitForStableCanvas(page)
  await expect(page).toHaveScreenshot('analyze-error-corrupt.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('visual snapshot: Analyze access denied (403)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const deniedId = 'e2e-visual-access-denied'
  await page.route(`**/api/analyses/${encodeURIComponent(deniedId)}`, (route) => {
    void route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: '{}',
    })
  })

  await page.goto(`/?analysis=${encodeURIComponent(deniedId)}`)
  await expect(page.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  const err = page.getByTestId('analyze-page-error')
  await expect(err).toBeVisible()
  await expect(err.getByText('Access blocked')).toBeVisible()
  await expect(err).toContainText(/access denied/i)
  await waitForStableCanvas(page)
  await expect(page).toHaveScreenshot('analyze-error-access-denied.png', {
    fullPage: true,
    animations: 'disabled',
  })
})
