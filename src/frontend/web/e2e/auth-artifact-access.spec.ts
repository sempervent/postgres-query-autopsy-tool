import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import {
  apiKeyHeaders,
  E2E_KEY_USER_A,
  E2E_KEY_USER_B,
  E2E_KEY_USER_C,
  E2E_SHARED_GROUP_ID,
} from './auth/constants'
import { installApiKeyRoute } from './auth/installApiKeyRoute'

function postgresJsonFixture(fileName: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', fileName)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL })
  const health = await ctx.get('/api/health')
  expect(health.ok(), 'API health').toBeTruthy()
  const cfgRes = await ctx.get('/api/config')
  expect(cfgRes.ok()).toBeTruthy()
  const cfg = (await cfgRes.json()) as { authEnabled?: boolean; authIdentityKind?: string }
  expect(cfg.authEnabled, 'Run stack with `.env.testing.auth` (PQAT_AUTH_ENABLED=true) for this project').toBe(true)
  expect(cfg.authIdentityKind).toBe('api_key')
  await ctx.dispose()
})

test('Auth API key: owner creates analysis, reopens persisted link in fresh context (same key)', async ({
  browser,
  baseURL,
}) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  const ctx = await browser.newContext({
    baseURL,
    extraHTTPHeaders: apiKeyHeaders(E2E_KEY_USER_A),
  })
  const page = await ctx.newPage()
  await installApiKeyRoute(page, E2E_KEY_USER_A)
  await page.goto('/')
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = page.url()

  const reopenCtx = await browser.newContext({
    baseURL,
    extraHTTPHeaders: apiKeyHeaders(E2E_KEY_USER_A),
  })
  const reopen = await reopenCtx.newPage()
  await installApiKeyRoute(reopen, E2E_KEY_USER_A)
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  await expect(reopen.getByText('Summary & metadata')).toBeVisible({ timeout: 60_000 })
  await reopenCtx.close()
  await ctx.close()
})

test('Auth API key: other user cannot open private artifact (access denied in UI)', async ({ browser, baseURL }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  const ctxA = await browser.newContext({
    baseURL,
    extraHTTPHeaders: apiKeyHeaders(E2E_KEY_USER_A),
  })
  const pageA = await ctxA.newPage()
  await installApiKeyRoute(pageA, E2E_KEY_USER_A)
  await pageA.goto('/')
  await pageA.getByPlaceholder(/JSON or psql/i).fill(planText)
  await pageA.getByRole('button', { name: /Analyze/i }).click()
  await expect(pageA.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })
  await expect(pageA).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = pageA.url()
  await ctxA.close()

  const ctxB = await browser.newContext({
    baseURL,
    extraHTTPHeaders: apiKeyHeaders(E2E_KEY_USER_B),
  })
  const pageB = await ctxB.newPage()
  await installApiKeyRoute(pageB, E2E_KEY_USER_B)
  await pageB.goto(persistedUrl)
  await expect(pageB.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  const err = pageB.getByTestId('analyze-page-error')
  await expect(err).toBeVisible()
  await expect(err).toContainText(/access denied/i)
  await ctxB.close()
})

test('Auth API key: owner shares to group via UI; member B can open; outsider C denied', async ({
  browser,
  baseURL,
}) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  const ctxA = await browser.newContext({
    baseURL,
    extraHTTPHeaders: apiKeyHeaders(E2E_KEY_USER_A),
  })
  const pageA = await ctxA.newPage()
  await installApiKeyRoute(pageA, E2E_KEY_USER_A)
  await pageA.goto('/')
  await pageA.getByPlaceholder(/JSON or psql/i).fill(planText)
  await pageA.getByRole('button', { name: /Analyze/i }).click()
  await expect(pageA.getByText('Summary & metadata')).toBeVisible({ timeout: 90_000 })
  await expect(pageA).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = pageA.url()

  await pageA.getByTestId('artifact-sharing-details').click()
  await pageA.getByTestId('artifact-sharing-access-scope').selectOption('group')
  const groupsInput = pageA.getByTestId('artifact-sharing-groups-input')
  await expect(groupsInput).toBeVisible({ timeout: 10_000 })
  await groupsInput.fill(E2E_SHARED_GROUP_ID)
  const allowLink = pageA.getByTestId('artifact-sharing-allow-link')
  if (await allowLink.isChecked()) await allowLink.uncheck()

  const putSharing = pageA.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      r.url().includes('/api/analyses/') &&
      r.url().includes('/sharing'),
  )
  const reloadAnalysis = pageA.waitForResponse((r) => {
    if (r.request().method() !== 'GET') return false
    try {
      const p = new URL(r.url()).pathname
      return p.startsWith('/api/analyses/') && !p.endsWith('/sharing')
    } catch {
      return false
    }
  })
  await pageA.getByTestId('artifact-sharing-save').scrollIntoViewIfNeeded()
  await pageA.getByTestId('artifact-sharing-save').click()
  const sharingRes = await putSharing
  expect(
    sharingRes.ok(),
    `PUT sharing failed ${sharingRes.status()}: ${await sharingRes.text().catch(() => '')}`,
  ).toBeTruthy()
  await reloadAnalysis

  await ctxA.close()

  const ctxB = await browser.newContext({
    baseURL,
    extraHTTPHeaders: apiKeyHeaders(E2E_KEY_USER_B),
  })
  const pageB = await ctxB.newPage()
  await installApiKeyRoute(pageB, E2E_KEY_USER_B)
  await pageB.goto(persistedUrl)
  await expect(pageB.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  await expect(pageB.getByText('Summary & metadata')).toBeVisible({ timeout: 60_000 })
  await ctxB.close()

  const ctxC = await browser.newContext({
    baseURL,
    extraHTTPHeaders: apiKeyHeaders(E2E_KEY_USER_C),
  })
  const pageC = await ctxC.newPage()
  await installApiKeyRoute(pageC, E2E_KEY_USER_C)
  await pageC.goto(persistedUrl)
  await expect(pageC.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  const err = pageC.getByTestId('analyze-page-error')
  await expect(err).toBeVisible()
  await expect(err).toContainText(/access denied/i)
  await ctxC.close()
})
