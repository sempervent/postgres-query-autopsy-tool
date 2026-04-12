import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { installE2eClipboardCapture, readE2eCapturedClipboard } from './helpers/e2eClipboardCapture'
import { installProxyHeadersRoute } from './auth/installProxyHeadersRoute'
import { PROXY_USER_ID_A, PROXY_USER_ID_B } from './auth/proxyHeadersConfig'

function postgresJsonFixture(fileName: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', fileName)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL })
  const health = await ctx.get('/api/health')
  expect(health.ok()).toBeTruthy()
  const cfgRes = await ctx.get('/api/config')
  expect(cfgRes.ok()).toBeTruthy()
  const cfg = (await cfgRes.json()) as { authEnabled?: boolean; authIdentityKind?: string }
  expect(cfg.authEnabled, 'Stack needs `.env.testing.proxy` (PQAT_AUTH_MODE=ProxyHeaders)').toBe(true)
  expect(cfg.authIdentityKind).toBe('proxy')
  await ctx.dispose()
})

test('Proxy headers: owner creates analysis, reopens persisted link', async ({ browser, baseURL }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installProxyHeadersRoute(page, { userId: PROXY_USER_ID_A })
  await page.goto('/')
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = page.url()

  const reopenCtx = await browser.newContext({ baseURL })
  const reopen = await reopenCtx.newPage()
  await installProxyHeadersRoute(reopen, { userId: PROXY_USER_ID_A })
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  await expect(reopen.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 60_000 })
  await reopenCtx.close()
  await ctx.close()
})

test('Proxy headers: other user cannot open private analysis (access denied in UI)', async ({
  browser,
  baseURL,
}) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  const ctxA = await browser.newContext({ baseURL })
  const pageA = await ctxA.newPage()
  await installProxyHeadersRoute(pageA, { userId: PROXY_USER_ID_A })
  await pageA.goto('/')
  await pageA.getByPlaceholder(/JSON or psql/i).fill(planText)
  await pageA.getByRole('button', { name: /Analyze/i }).click()
  await expect(pageA.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(pageA).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = pageA.url()
  await ctxA.close()

  const ctxB = await browser.newContext({ baseURL })
  const pageB = await ctxB.newPage()
  await installProxyHeadersRoute(pageB, { userId: PROXY_USER_ID_B })
  await pageB.goto(persistedUrl)
  await expect(pageB.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  const err = pageB.getByTestId('analyze-page-error')
  await expect(err).toBeVisible()
  await expect(err).toContainText(/access denied/i)
  await ctxB.close()
})

test('Proxy headers: Compare Copy link captures URL + PQAT compare + Pair ref', async ({ browser, baseURL }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')
  const ctx = await browser.newContext({ baseURL })
  const page = await ctx.newPage()
  await installE2eClipboardCapture(page)
  await installProxyHeadersRoute(page, { userId: PROXY_USER_ID_A })
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
