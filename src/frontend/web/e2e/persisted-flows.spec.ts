import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { installE2eClipboardCapture, readE2eCapturedClipboard } from './helpers/e2eClipboardCapture'

/** Bundled copies of `tests/backend.unit/.../postgres-json/*` (keeps Dockerized Playwright mounts small). */
function postgresJsonFixture(fileName: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', fileName)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
  const health = await request.get('/api/health')
  expect(health.ok(), 'API must be reachable at the same origin as baseURL (docker :3000 or Vite :5173 with proxy)').toBeTruthy()
})

/** Capture `navigator.clipboard.writeText` payloads for assertions (see e2e/helpers/e2eClipboardCapture.ts). */
test.beforeEach(async ({ page }) => {
  await installE2eClipboardCapture(page)
})

test('Analyze: copy node reference writes expected reference text', async ({ page }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })

  const copyBtn = page.getByTestId('analyze-copy-node-reference')
  await expect(copyBtn).toBeVisible({ timeout: 30_000 })
  await copyBtn.click()

  const clip = await readE2eCapturedClipboard(page)
  expect(clip.length).toBeGreaterThan(0)
  expect(clip).toMatch(/Seq Scan|users/i)
  expect(clip).toMatch(/node\s+[^\s]+/i)
})

test('Analyze: Copy for ticket on optimization suggestion writes structured payload', async ({ page }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })

  const optHeading = page.getByRole('heading', { name: 'Optimization suggestions' })
  await expect(optHeading).toBeVisible({ timeout: 45_000 })
  await optHeading.scrollIntoViewIfNeeded()

  const copyTicket = page.getByTestId('analyze-suggestion-copy-ticket').first()
  await expect(copyTicket).toBeVisible({ timeout: 15_000 })
  await copyTicket.click()

  const clip = await readE2eCapturedClipboard(page)
  expect(clip.length).toBeGreaterThan(40)
  expect(clip).toMatch(/Family:|Try next:/)
  expect(clip).toMatch(/\[[^\]]+\]/)
})

test('Compare: copy pair reference writes human-readable pair context', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const copyRef = page.getByTestId('compare-copy-pair-reference')
  await expect(copyRef).toBeVisible({ timeout: 30_000 })
  await copyRef.click()

  const clip = await readE2eCapturedClipboard(page)
  expect(clip.length).toBeGreaterThan(0)
  expect(clip).toMatch(/Plan [AB] node|→|Seq Scan|Index/i)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toMatch(/Rewrite outcome:/i)
})

test('Compare: Copy for ticket on compare suggestion writes structured payload', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const nextSteps = page.getByText('Next steps after this change', { exact: true })
  await expect(nextSteps).toBeVisible({ timeout: 45_000 })
  await nextSteps.scrollIntoViewIfNeeded()

  const copyTicket = page.getByTestId('compare-suggestion-copy-ticket').first()
  await expect(copyTicket).toBeVisible({ timeout: 20_000 })
  await copyTicket.click()

  const clip = await readE2eCapturedClipboard(page)
  expect(clip.length).toBeGreaterThan(40)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toMatch(/Family:|Try next:/)
  expect(clip).toMatch(/\[[^\]]+\]/)
})

test('Compare: Copy link includes URL and PQAT compare line', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  await page.getByTestId('compare-copy-deep-link').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toMatch(/^https?:\/\//m)
  expect(clip).toContain('PQAT compare:')
})

test('Analyze: Copy share link includes URL and PQAT analysis line', async ({ page }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })

  const copyShare = page.getByRole('button', { name: /Copy share link/i }).first()
  await expect(copyShare).toBeVisible({ timeout: 30_000 })
  await copyShare.click()

  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toMatch(/^https?:\/\//m)
  expect(clip).toContain('PQAT analysis:')
})

test('Analyze: suggested EXPLAIN copy captures wrapped SQL', async ({ page }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.locator('details').filter({ hasText: 'Optional: source SQL query' }).locator('summary').click()
  await page.locator('details').filter({ hasText: 'Optional: source SQL query' }).locator('textarea').first().fill('SELECT 1 AS probe')
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })

  await page.locator('details').filter({ hasText: 'Suggested EXPLAIN command' }).locator('summary').click()
  await page.getByTestId('analyze-copy-suggested-explain').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toContain('EXPLAIN (')
  expect(clip).toMatch(/SELECT\s+1/i)
})

test('Analyze: Plan briefing exposes ordered inspect steps (structured Start here)', async ({ page }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByLabel('Ordered inspect steps')).toBeVisible({ timeout: 30_000 })
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

test('Compare: deep link from Copy link restores pair param and rewrite outcome', async ({ page, context }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })
  await expect(page).toHaveURL(/[?&]pair=pair_/, { timeout: 45_000 })

  await page.getByTestId('compare-copy-deep-link').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toMatch(/Pair ref:\s*pair_/i)
  const lines = clip.split('\n').map((l) => l.trim()).filter(Boolean)
  const deepUrl = lines.find((l) => /^https?:\/\//.test(l))
  expect(deepUrl, 'clipboard should include an absolute URL line').toBeTruthy()

  const reopen = await context.newPage()
  await reopen.goto(deepUrl!)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen).toHaveURL(/[?&]comparison=/)
  await expect(reopen).toHaveURL(/[?&]pair=pair_/, { timeout: 45_000 })
  await expect(reopen.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByLabel('Rewrite outcome for this pair')).toBeVisible({ timeout: 45_000 })
  await reopen.close()
})

test('Compare: Copy for ticket on same-pair suggestion includes Pair scope line', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const nextSteps = page.getByRole('heading', { name: 'Next steps after this change' })
  await expect(nextSteps).toBeVisible({ timeout: 45_000 })
  await nextSteps.scrollIntoViewIfNeeded()

  const samePairRow = page.locator('li').filter({ hasText: 'Same pair as sidebar' }).first()
  await expect(samePairRow).toBeVisible({ timeout: 30_000 })
  await samePairRow.getByTestId('compare-suggestion-copy-ticket').click()

  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toMatch(/Pair scope:\s*aligns with selected pair \(Plan B node/i)
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
  await expect(page.getByLabel('Rewrite outcome for this pair')).toBeVisible({ timeout: 20_000 })
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

test('Compare: suggestion= deep link highlight survives reopen in fresh tab', async ({ page, context, request }) => {
  const seed = await request.post('/api/e2e/seed/comparison-suggestion-alias')
  expect(seed.ok(), await seed.text()).toBeTruthy()
  const body = (await seed.json()) as {
    comparisonId: string
    canonicalSuggestionId: string
    legacySuggestionId: string
  }

  const deepUrl = `/compare?comparison=${encodeURIComponent(body.comparisonId)}&suggestion=${encodeURIComponent(body.legacySuggestionId)}`

  await page.goto(deepUrl)
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  const row = page.locator(`[data-artifact="compare-suggestion"][data-artifact-id="${body.canonicalSuggestionId}"]`)
  await expect(row).toBeVisible({ timeout: 30_000 })
  await expect(row).toHaveClass(/pqat-suggestionItem--highlight/)

  const reopen = await context.newPage()
  await reopen.goto(deepUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  const row2 = reopen.locator(`[data-artifact="compare-suggestion"][data-artifact-id="${body.canonicalSuggestionId}"]`)
  await expect(row2).toBeVisible({ timeout: 30_000 })
  await expect(row2).toHaveClass(/pqat-suggestionItem--highlight/)
  await reopen.close()
})
