import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { installBearerRoute } from './auth/installBearerRoute'
import { installE2eClipboardCapture, readE2eCapturedClipboard } from './helpers/e2eClipboardCapture'
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_SIGNING_KEY_BASE64,
  JWT_SUB_A,
  JWT_SUB_B,
} from './auth/jwtConfig'
import { mintTestJwt } from './auth/jwtMint'

function postgresJsonFixture(fileName: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', fileName)
}

function tokenForSub(sub: string): string {
  return mintTestJwt({
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    subject: sub,
    signingKeyBase64: JWT_SIGNING_KEY_BASE64,
  })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL })
  const health = await ctx.get('/api/health')
  expect(health.ok()).toBeTruthy()
  const cfgRes = await ctx.get('/api/config')
  expect(cfgRes.ok()).toBeTruthy()
  const cfg = (await cfgRes.json()) as { authEnabled?: boolean; authIdentityKind?: string }
  expect(cfg.authEnabled, 'Stack needs `.env.testing.jwt`').toBe(true)
  expect(cfg.authIdentityKind).toBe('jwt')
  await ctx.dispose()
})

test('JWT: owner creates analysis, reopens persisted link', async ({ browser, baseURL }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  const jwt = tokenForSub(JWT_SUB_A)
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installBearerRoute(page, jwt)
  await page.goto('/')
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = page.url()

  const reopenCtx = await browser.newContext({ baseURL })
  const reopen = await reopenCtx.newPage()
  await installBearerRoute(reopen, jwt)
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  await expect(reopen.getByText('Summary & metadata')).toBeVisible({ timeout: 60_000 })
  await reopenCtx.close()
  await ctx.close()
})

test('JWT: owner creates comparison, reopens persisted link', async ({ browser, baseURL }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  const jwt = tokenForSub(JWT_SUB_A)
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installBearerRoute(page, jwt)
  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 30_000 })
  const persistedUrl = page.url()

  const reopenCtx = await browser.newContext({ baseURL })
  const reopen = await reopenCtx.newPage()
  await installBearerRoute(reopen, jwt)
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByText('Summary', { exact: true })).toBeVisible({ timeout: 60_000 })
  await reopenCtx.close()
  await ctx.close()
})

test('JWT: other subject cannot open private comparison (access denied in UI)', async ({
  browser,
  baseURL,
}) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  const jwtA = tokenForSub(JWT_SUB_A)
  const ctxA = await browser.newContext({ baseURL })
  const pageA = await ctxA.newPage()
  await installBearerRoute(pageA, jwtA)
  await pageA.goto('/compare')
  await pageA.getByTestId('compare-plan-a-text').fill(planA)
  await pageA.getByTestId('compare-plan-b-text').fill(planB)
  await pageA.getByRole('button', { name: 'Compare' }).click()
  await expect(pageA.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(pageA).toHaveURL(/[?&]comparison=/, { timeout: 30_000 })
  const persistedUrl = pageA.url()
  await ctxA.close()

  const jwtB = tokenForSub(JWT_SUB_B)
  const ctxB = await browser.newContext({ baseURL })
  const pageB = await ctxB.newPage()
  await installBearerRoute(pageB, jwtB)
  await pageB.goto(persistedUrl)
  await expect(pageB.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  const err = pageB.getByTestId('compare-page-error')
  await expect(err).toBeVisible()
  await expect(err).toContainText(/access denied/i)
  await ctxB.close()
})

test('JWT: Compare Copy link captures URL + PQAT compare + Pair ref', async ({ browser, baseURL }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  const jwt = tokenForSub(JWT_SUB_A)
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installE2eClipboardCapture(page)
  await installBearerRoute(page, jwt)
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
  expect(clip).toMatch(/^https?:\/\//m)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toMatch(/Pair ref:\s*pair_/i)
  await ctx.close()
})

test('JWT: Compare Copy link includes pinned index insight line when indexDiff is active', async ({ browser, baseURL }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  const jwt = tokenForSub(JWT_SUB_A)
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installE2eClipboardCapture(page)
  await installBearerRoute(page, jwt)
  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const indexCallout = page.getByTestId('compare-index-changes-callout')
  await expect(indexCallout).toBeVisible({ timeout: 45_000 })
  const firstInsight = indexCallout.locator('[data-artifact="index-insight-diff"][data-artifact-id]').first()
  const insightId = await firstInsight.getAttribute('data-artifact-id')
  expect(insightId).toBeTruthy()
  const cmp = new URL(page.url()).searchParams.get('comparison')
  expect(cmp).toBeTruthy()
  await page.goto(`/compare?comparison=${encodeURIComponent(cmp!)}&indexDiff=${encodeURIComponent(insightId!)}`)
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })

  await page.getByTestId('compare-copy-deep-link').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toContain(`Pinned index insight: ${insightId}`)
  expect(clip).toContain('PQAT compare:')
  await ctx.close()
})

test('JWT: Compare Copy link includes pinned finding line when finding is active', async ({ browser, baseURL }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  const jwt = tokenForSub(JWT_SUB_A)
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installE2eClipboardCapture(page)
  await installBearerRoute(page, jwt)
  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByRole('heading', { name: 'Findings diff' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const firstFinding = page.locator('[data-artifact="finding-diff"][data-artifact-id]').first()
  await expect(firstFinding).toBeVisible({ timeout: 45_000 })
  const diffId = await firstFinding.getAttribute('data-artifact-id')
  expect(diffId).toBeTruthy()
  await firstFinding.getByRole('button', { name: /Finding diff:/ }).click()

  await page.getByTestId('compare-copy-deep-link').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toContain(`Pinned finding: ${diffId}`)
  expect(clip).toContain('PQAT compare:')
  await ctx.close()
})

test('JWT: Compare Copy link includes pinned suggestion line when suggestion is pinned', async ({ browser, baseURL }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  const jwt = tokenForSub(JWT_SUB_A)
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installE2eClipboardCapture(page)
  await installBearerRoute(page, jwt)
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
  const pinBtn = page.locator('.pqat-suggestionPinBtn').first()
  await expect(pinBtn).toBeVisible({ timeout: 30_000 })
  const describedBy = await pinBtn.getAttribute('aria-describedby')
  expect(describedBy).toMatch(/^compare-next-step-title-/)
  const suggestionId = describedBy!.replace('compare-next-step-title-', '')
  await pinBtn.click()

  await page.getByTestId('compare-copy-deep-link').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toContain(`Pinned suggestion: ${suggestionId}`)
  expect(clip).toContain('PQAT compare:')
  await ctx.close()
})

test('JWT: Compare Copy pin context omits URL when a pin is active', async ({ browser, baseURL }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  const jwt = tokenForSub(JWT_SUB_A)
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installE2eClipboardCapture(page)
  await installBearerRoute(page, jwt)
  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByRole('heading', { name: 'Findings diff' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const firstFinding = page.locator('[data-artifact="finding-diff"][data-artifact-id]').first()
  await expect(firstFinding).toBeVisible({ timeout: 45_000 })
  await firstFinding.getByRole('button', { name: /Finding diff:/ }).click()

  await page.getByTestId('compare-copy-pin-context').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).not.toMatch(/^https?:\/\//m)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toMatch(/Pinned for link:.*finding/i)
  await ctx.close()
})
