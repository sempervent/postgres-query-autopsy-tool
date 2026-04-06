import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/** Bundled copies of `tests/backend.unit/.../postgres-json/*` (keeps Dockerized Playwright mounts small). */
function postgresJsonFixture(fileName: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', fileName)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
  const health = await request.get('/api/health')
  expect(health.ok(), 'API must be reachable at the same origin as baseURL (docker :3000 or Vite :5173 with proxy)').toBeTruthy()
})

test('Analyze: copy node reference populates clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })

  const copyBtn = page.getByTestId('analyze-copy-node-reference')
  await expect(copyBtn).toBeVisible({ timeout: 30_000 })
  await copyBtn.click()

  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toMatch(/Seq Scan|users/i)
  expect(clip).toMatch(/node\s+[^\s]+/i)
})

test('Analyze: paste fixture, persist, reopen in fresh tab, restore node deep link', async ({ page, context }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()

  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()

  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByLabel('Analyze workspace')).toBeVisible({ timeout: 30_000 })

  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]analysis=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  await expect(reopen.getByText('Summary & metadata')).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByLabel('Analyze workspace')).toBeVisible({ timeout: 30_000 })

  const findingBtn = reopen.getByRole('button', { name: /^Finding:/ }).first()
  await findingBtn.click()
  await expect(reopen).toHaveURL(/[?&]node=/, { timeout: 15_000 })

  const withNodeUrl = reopen.url()
  const deep = await context.newPage()
  await deep.goto(withNodeUrl)
  await expect(deep.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  await expect(deep.getByLabel('Analyze workspace')).toBeVisible({ timeout: 30_000 })
  await deep.close()
  await reopen.close()
})

test('Compare: two fixtures, persist, reopen, findings diff visible', async ({ page, context }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()

  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'Findings diff' })).toBeVisible({ timeout: 30_000 })

  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]comparison=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByText('Summary', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByRole('heading', { name: 'Findings diff' })).toBeVisible({ timeout: 30_000 })
  await reopen.close()
})

test('Compare: selected pair shell appears, heavy pair detail becomes available', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })
  await expect(page.getByText('Key metric deltas')).toBeVisible({ timeout: 45_000 })
})

test('Compare: continuity summary cue appears after real compare (seq vs index)', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  const cue = page.getByTestId('compare-continuity-summary-cue')
  await expect(cue).toBeVisible({ timeout: 30_000 })
  await expect(cue).toContainText(/narrower access|strategy shift/i)
  await expect(page.getByText(/Continuity ·/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/same relation|sequential scan|index-backed/i).first()).toBeVisible({ timeout: 15_000 })
})

test('Compare: continuity summary shows regression cue for index vs bitmap heap', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('rewrite_access_idx_shipments.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('rewrite_access_bitmap_shipments.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  const cue = page.getByTestId('compare-continuity-summary-cue')
  await expect(cue).toBeVisible({ timeout: 30_000 })
  await expect(cue).toContainText(/bitmap|regression|heap/i)
  await expect(page.getByText(/Continuity ·/)).toBeVisible()
})

test('Analyze reopen: corrupt artifact shows explicit error (422)', async ({ page, request }) => {
  const res = await request.post('/api/e2e/seed/corrupt-analysis', {
    data: { analysisId: 'e2e-corrupt-analysis' },
  })
  expect(res.ok(), await res.text()).toBeTruthy()

  await page.goto('/?analysis=e2e-corrupt-analysis')
  await expect(page.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  const err = page.getByTestId('analyze-page-error')
  await expect(err).toBeVisible()
  await expect(err).toContainText(/read|corrupt|unreadable/i)
})

test('Analyze reopen: future schema shows explicit error (409)', async ({ page, request }) => {
  const res = await request.post('/api/e2e/seed/future-schema-analysis', {
    data: { analysisId: 'e2e-future-schema-analysis' },
  })
  expect(res.ok(), await res.text()).toBeTruthy()

  await page.goto('/?analysis=e2e-future-schema-analysis')
  await expect(page.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  const err = page.getByTestId('analyze-page-error')
  await expect(err).toBeVisible()
  await expect(err).toContainText(/unsupported|format|schema/i)
})

test('Compare: legacy suggestion= id resolves to canonical row (alsoKnownAs)', async ({ page, request }) => {
  const seed = await request.post('/api/e2e/seed/comparison-suggestion-alias')
  expect(seed.ok(), await seed.text()).toBeTruthy()
  const body = (await seed.json()) as {
    comparisonId: string
    canonicalSuggestionId: string
    legacySuggestionId: string
  }

  await page.goto(
    `/compare?comparison=${encodeURIComponent(body.comparisonId)}&suggestion=${encodeURIComponent(body.legacySuggestionId)}`,
  )
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })

  const row = page.locator(`[data-artifact="compare-suggestion"][data-artifact-id="${body.canonicalSuggestionId}"]`)
  await expect(row).toBeVisible({ timeout: 30_000 })
  await expect(row).toHaveClass(/pqat-suggestionItem--highlight/)
})
