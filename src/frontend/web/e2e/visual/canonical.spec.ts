/**
 * Phase 56–57 — canonical workstation visual regression.
 * Phase 75 — region-targeted screenshots for Analyze/Compare happy paths (avoids brittle full-page height drift).
 * Requires: API + web with `PQAT_E2E_ENABLED=true` (`.env.testing` Docker stack).
 * Access-denied frame uses `page.route` (403) so it stays deterministic without a second auth stack.
 * Update baselines (Linux, same as CI): from repo root, with stack up:
 *   docker compose --env-file .env.testing --profile testing run --rm \
 *     -e PLAYWRIGHT_CLI_ARGS="--project=e2e-visual --update-snapshots" playwright
 * Phase 92: Analyze summary snapshot uses data-testid analyze-visual-summary-contract (metrics + plan briefing only),
 * not the full summary card (share/metadata/footer).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import {
  expectStableRegionScreenshot,
  waitForFontsReady,
  waitForGraphLayoutSettled,
} from './visualTestHelpers'

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

test('visual snapshot: Analyze happy path (story surfaces)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  await page.goto('/')
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByLabel('Analyze workspace')).toBeVisible({ timeout: 45_000 })
  await page.locator('.react-flow').waitFor({ state: 'visible', timeout: 45_000 }).catch(() => {})
  await waitForGraphLayoutSettled(page)
  await expect(page.getByRole('button', { name: /^Finding:/ }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Findings list')).toBeVisible({ timeout: 30_000 })
  await waitForFontsReady(page)

  await expectStableRegionScreenshot(page.getByTestId('analyze-visual-summary-contract'), 'analyze-happy-summary.png')
  await expectStableRegionScreenshot(page.getByLabel('Analyze workspace'), 'analyze-happy-workspace.png')
  await expectStableRegionScreenshot(page.getByLabel('Findings list'), 'analyze-happy-findings.png')
})

test('visual snapshot: Compare happy path (story surfaces)', async ({ page }) => {
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
  // Phase 90: summary shell uses aria-labelledby="compare-summary-heading" (h2 "Summary"), not aria-label="Compare summary".
  const compareSummaryRegion = page.locator('[aria-labelledby="compare-summary-heading"]')
  await expect(compareSummaryRegion).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Compare navigator')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Compare pair inspector')).toBeVisible({ timeout: 30_000 })
  await waitForFontsReady(page)

  await expectStableRegionScreenshot(compareSummaryRegion, 'compare-happy-summary.png')
  await expectStableRegionScreenshot(page.getByLabel('Compare navigator'), 'compare-happy-navigator.png')
  await expectStableRegionScreenshot(page.getByLabel('Compare pair inspector'), 'compare-happy-pair.png')
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
  await waitForFontsReady(page)
  await expectStableRegionScreenshot(err, 'analyze-error-corrupt.png')
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
  await waitForFontsReady(page)
  await expectStableRegionScreenshot(err, 'analyze-error-access-denied.png')
})
