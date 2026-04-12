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

test('Analyze: Try example runs analyze and shows triage takeaway', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('analyze-try-example-simple-seq-scan-capture').click()
  await expect(page.getByTestId('analyze-summary-takeaway')).toBeVisible({ timeout: 90_000 })
})

test('Analyze: graph click shows in-graph issue summary + local shelf; ranked list not focused until explicit pivot', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('analyze-try-example-simple-seq-scan-capture').click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.react-flow__node').first().click()
  await expect(page.getByTestId('analyze-graph-issue-summary')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('What looks wrong here')).toBeVisible()
  await expect(page.getByTestId('analyze-graph-local-findings-shelf')).toBeVisible({ timeout: 15_000 })
  // Graph selection alone must not trigger ranked-list pivot scroll/highlight (Phase 123/124).
  await expect(page.getByText('Continues from plan')).toHaveCount(0)
  await expect(page.getByTestId('analyze-local-evidence-bridge')).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => document.activeElement?.id === 'analyze-ranked-findings'))
    .toBe(false)
})

test('Analyze: bridge Open in ranked list shows ranked continuation in ranked list', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('analyze-try-example-simple-seq-scan-capture').click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.react-flow__node').first().click()
  await expect(page.getByTestId('analyze-graph-local-findings-shelf')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Continues from plan')).toHaveCount(0)
  await page.getByTestId('analyze-local-evidence-open-top-in-list').click()
  await expect(page.getByText('Continues from plan')).toBeVisible({ timeout: 15_000 })
  // DOM focus is the contract for keyboard/SR users; a11y "focused" can read inactive in headless.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const el = document.activeElement
        return Boolean(el && el.classList.contains('pqat-listRow--graphPivot'))
      }),
    )
    .toBe(true)
})

test('Analyze: skip link focuses Ranked findings region', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('analyze-try-example-simple-seq-scan-capture').click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.react-flow__node').first().click()
  const skipToRanked = page.getByRole('link', { name: 'Skip to Ranked findings' })
  await expect(skipToRanked).toHaveCount(1)
  // Skip links are positioned for keyboard users; pointer clicks can hit overlapping plan hints in CI.
  await skipToRanked.focus()
  await skipToRanked.press('Enter')
  await expect(page.locator('#analyze-ranked-findings')).toBeFocused()
})

test('Analyze: skip link pointer click reaches Ranked findings', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('analyze-try-example-simple-seq-scan-capture').click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.react-flow__node').first().click()
  const skipToRanked = page.getByTestId('analyze-skip-to-ranked-findings')
  await expect(skipToRanked).toHaveCount(1)
  // Skip is off-screen until focus; focus expands the link so a real pointer activation hits the same handler.
  await skipToRanked.focus()
  await skipToRanked.click()
  await expect
    .poll(async () =>
      page.evaluate(() => document.activeElement?.id === 'analyze-ranked-findings'),
    )
    .toBe(true)
})

test('Analyze: Sort-pressure sample reaches summary triage', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('analyze-try-example-sort-pressure-shipments-capture').click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
})

test('Analyze: Nested-loop sample reaches triage deck', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('analyze-try-example-nl-join-inner-heavy-capture').click()
  await expect(page.getByTestId('analyze-triage-deck')).toBeVisible({ timeout: 90_000 })
})

test('Compare: narrow viewport Tab chain reaches skip then Enter focuses pair region', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 960 })
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })

  const firstWorsened = page.getByRole('button', { name: /^Worsened pair:/ }).first()
  await expect(firstWorsened).toBeVisible({ timeout: 45_000 })
  await firstWorsened.click()
  await expect(page.getByRole('heading', { name: 'Selected node pair' })).toBeVisible({ timeout: 30_000 })
  await firstWorsened.focus()

  const skip = page.getByTestId('compare-skip-to-pair-inspector')
  for (let i = 0; i < 40; i++) {
    const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    if (id === 'compare-skip-to-pair-inspector') break
    await page.keyboard.press('Tab')
  }
  await expect(skip).toBeFocused()
  await skip.press('Enter')
  await expect(page.locator('#compare-pair-inspector-region')).toBeFocused()
})

test('Compare: reopened link shows Briefing — reopened when pair thread is continuity-only', async ({
  page,
  context,
}) => {
  // NL → hash rewrite compares three worsened pairs; only the top pair gets the summary triage bridge.
  // A secondary pair carries `regionContinuitySummaryCue` ("join strategy shift") → `briefing` handoff
  // with the soft Reading thread panel (no "Context" summary bridge).
  const planA = readFileSync(postgresJsonFixture('rewrite_nl_orders_lineitems.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('rewrite_hash_orders_lineitems.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })

  const hint = page.getByTestId('compare-pair-handoff-hint')
  const summaryBridge = page.getByTestId('compare-selected-pair-triage-bridge')
  const continuityFallback = page.getByTestId('compare-selected-pair-continuity-fallback')
  const worsened = page.getByRole('button', { name: /^Worsened pair:/ })
  const improved = page.getByRole('button', { name: /^Improved pair:/ })

  let foundSessionBriefing = false
  for (const rowGroup of [worsened, improved]) {
    const n = await rowGroup.count()
    for (let i = 0; i < n; i++) {
      await rowGroup.nth(i).click()
      await expect(hint).toBeVisible({ timeout: 20_000 })
      const triageVisible = await summaryBridge.isVisible().catch(() => false)
      const softContinuityVisible = await continuityFallback.isVisible().catch(() => false)
      if (triageVisible || !softContinuityVisible) continue
      await expect(hint).toHaveText('From the briefing')
      foundSessionBriefing = true
      break
    }
    if (foundSessionBriefing) break
  }
  expect(foundSessionBriefing, 'need a pair with Reading thread continuity and no summary triage bridge').toBe(
    true,
  )

  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })
  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]comparison=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByTestId('compare-pair-handoff-hint')).toContainText(/Briefing — reopened/i)
  await expect(reopen.getByTestId('compare-selected-pair-continuity-fallback')).toBeVisible()
  await reopen.close()
})

test('Compare: reopened link shows From the lists — reopened for navigator-only pair', async ({
  page,
  context,
}) => {
  // Multi-pair compare with no `regionContinuitySummaryCue` on these pairs — secondary worsened rows
  // stay on `navigator` (no Context bridge from top-ranked / story beat for that selection).
  const planA = readFileSync(postgresJsonFixture('nested_loop_amplification.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('nested_loop_misestimation.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })

  const hint = page.getByTestId('compare-pair-handoff-hint')
  const worsened = page.getByRole('button', { name: /^Worsened pair:/ })
  const improved = page.getByRole('button', { name: /^Improved pair:/ })

  let foundNavigator = false
  for (const rowGroup of [worsened, improved]) {
    const n = await rowGroup.count()
    for (let i = 0; i < n; i++) {
      await rowGroup.nth(i).click()
      await expect(hint).toBeVisible({ timeout: 20_000 })
      const t = ((await hint.textContent()) ?? '').trim()
      if (t === 'From the lists') {
        foundNavigator = true
        break
      }
    }
    if (foundNavigator) break
  }
  expect(foundNavigator, 'need a From the lists handoff row in worsened/improved lists').toBe(true)

  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })
  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]comparison=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByTestId('compare-pair-handoff-hint')).toContainText(/From the lists — reopened/i)
  await expect(reopen.getByTestId('compare-pair-handoff-hint')).toHaveAttribute('data-pqat-handoff-origin', 'link')
  await reopen.close()
})

test('Compare: Try example runs compare and shows summary', async ({ page }) => {
  await page.goto('/compare')
  await page.getByTestId('compare-try-example-seq-scan-to-index-capture').click()
  await expect(page.getByRole('heading', { name: 'Summary', exact: true })).toBeVisible({ timeout: 90_000 })
})

test('Compare: Bitmap→index sample reaches summary', async ({ page }) => {
  await page.goto('/compare')
  await page.getByTestId('compare-try-example-bitmap-to-index-rows-capture').click()
  await expect(page.getByRole('heading', { name: 'Summary', exact: true })).toBeVisible({ timeout: 90_000 })
})

test('Analyze: ?guide=1 shows distinct workflow guide shell', async ({ page }) => {
  await page.goto('/?guide=1')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  const panel = page.getByTestId('analyze-workflow-guide-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel).toHaveAttribute('data-pqat-help-surface', '1')
})

test('Analyze: Hide guide strips guide param from URL', async ({ page }) => {
  await page.goto('/?guide=1')
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Hide guide/i }).click()
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeHidden()
  expect(page.url()).not.toMatch(/[?&]guide=/)
})

test('Analyze: ? hotkey opens guide after dismiss; ignored while typing in plan input', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pqat_workflow_guide_v1', JSON.stringify({ v: 1, analyzeDismissed: true }))
  })
  await page.goto('/')
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeHidden({ timeout: 15_000 })
  const planBox = page.getByPlaceholder(/JSON or psql/i)
  await planBox.click()
  await planBox.press('Shift+/')
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeHidden()
  await page.locator('body').click()
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }))
  })
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeVisible({ timeout: 5000 })
})

test('Compare: ?guide=1 shows guide; Hide guide hides panel', async ({ page }) => {
  await page.goto('/compare?guide=1')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Hide guide/i }).click()
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeHidden()
})

test('Analyze: dismissed guide stays closed after reload; ?guide=1 reopens', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Hide guide/i }).click()
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeHidden()
  const stored = await page.evaluate(() => window.localStorage.getItem('pqat_workflow_guide_v1'))
  expect(stored).toBeTruthy()
  expect(stored).toMatch(/analyzeDismissed/i)

  await page.reload()
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeHidden({ timeout: 15_000 })

  await page.goto('/?guide=1')
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
})

test('Compare: dismissed guide stays closed after reload when intro on; ?guide=1 reopens', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      const key = 'pqat.compareWorkspaceLayout.v1'
      const raw = window.localStorage.getItem(key)
      if (!raw) return
      const o = JSON.parse(raw) as { visibility?: Record<string, unknown> }
      if (o?.visibility) o.visibility.intro = true
      window.localStorage.setItem(key, JSON.stringify(o))
    } catch {
      /* ignore */
    }
  })
  await page.goto('/compare')
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Hide guide/i }).click()
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeHidden()
  const stored = await page.evaluate(() => window.localStorage.getItem('pqat_workflow_guide_v1'))
  expect(stored).toBeTruthy()
  expect(stored).toMatch(/compareDismissed/i)

  await page.reload()
  await expect(page.getByRole('link', { name: 'Compare' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('compare-plan-a-text')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeHidden({ timeout: 15_000 })

  await page.goto('/compare?guide=1')
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
})

test('Analyze: Copy merged guided link keeps extra query params', async ({ page }) => {
  await page.goto('/?utm_pqat_e2e=keep&guide=1')
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('analyze-workflow-guide-copy-guided-merged').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toMatch(/^https?:\/\//)
  expect(clip).toMatch(/[?&]guide=1(?:&|$)/)
  expect(clip).toMatch(/utm_pqat_e2e=keep/)
})

test('Compare: Copy merged guided link keeps extra query params and reopens guide', async ({ page }) => {
  await page.goto('/compare?utm_pqat_e2e=keep&guide=1')
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('compare-workflow-guide-copy-guided-merged').click()
  const clip = (await readE2eCapturedClipboard(page)).trim()
  expect(clip).toMatch(/^https?:\/\//)
  expect(clip).toMatch(/[?&]guide=1(?:&|$)/)
  expect(clip).toMatch(/utm_pqat_e2e=keep/)
  await page.goto(clip)
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
})

test('Analyze: Copy entry guided link drops other query params', async ({ page }) => {
  await page.goto('/?utm_pqat_e2e=strip&guide=1')
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('analyze-workflow-guide-copy-guided-entry').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toMatch(/^https?:\/\//)
  expect(clip).toMatch(/\?guide=1(?:#|$)/)
  expect(clip).not.toMatch(/utm_pqat_e2e/)
})

test('Compare: Copy entry guided link drops other query params', async ({ page }) => {
  await page.goto('/compare?utm_pqat_e2e=strip&guide=1')
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('compare-workflow-guide-copy-guided-entry').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toMatch(/^https?:\/\//)
  expect(clip).toMatch(/\/compare\?guide=1(?:#|$)/)
  expect(clip).not.toMatch(/utm_pqat_e2e/)
})

test('Analyze: guide announcer on explicit open, close, and ?guide=1 after dismiss', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pqat_workflow_guide_v1', JSON.stringify({ v: 1, analyzeDismissed: true }))
  })
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeHidden({ timeout: 15_000 })
  await page.getByTestId('analyze-workflow-guide-bar').getByRole('button', { name: /How to use Analyze/i }).click()
  await expect(page.getByTestId('analyze-workflow-guide-announcer')).toContainText(/Analyze workflow guide opened/i, {
    timeout: 5000,
  })
  await page.getByRole('button', { name: /Hide guide/i }).click()
  await expect(page.getByTestId('analyze-workflow-guide-announcer')).toContainText(/Analyze workflow guide closed/i, {
    timeout: 5000,
  })
  await page.goto('/?guide=1')
  await expect(page.getByTestId('analyze-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('analyze-workflow-guide-announcer')).toContainText(/Guided help opened from link/i, {
    timeout: 5000,
  })
})

test('Compare: guide announcer on explicit open, close, and ?guide=1 after dismiss', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pqat_workflow_guide_v1', JSON.stringify({ v: 1, compareDismissed: true }))
  })
  await page.goto('/compare')
  await expect(page.getByRole('link', { name: 'Compare' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('compare-plan-a-text')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeHidden({ timeout: 15_000 })
  await page.getByTestId('compare-workflow-guide-bar').getByRole('button', { name: /How to use Compare/i }).click()
  await expect(page.getByTestId('compare-workflow-guide-announcer')).toContainText(/Compare workflow guide opened/i, {
    timeout: 5000,
  })
  await page.getByRole('button', { name: /Hide guide/i }).click()
  await expect(page.getByTestId('compare-workflow-guide-announcer')).toContainText(/Compare workflow guide closed/i, {
    timeout: 5000,
  })
  await page.goto('/compare?guide=1')
  await expect(page.getByTestId('compare-workflow-guide-panel')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('compare-workflow-guide-announcer')).toContainText(/Guided help opened from link/i, {
    timeout: 5000,
  })
})

test('Analyze: Esc closes guide and returns focus to toggle', async ({ page }) => {
  await page.goto('/?guide=1')
  const panel = page.getByTestId('analyze-workflow-guide-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  const title = page.locator('#analyze-workflow-guide-title')
  await title.focus()
  await expect(title).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(page.getByTestId('analyze-workflow-guide-bar').getByRole('button', { name: /How to use Analyze/i })).toBeFocused()
})

test('Analyze: copy node reference writes expected reference text', async ({ page }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })

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
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })

  const suggestionsPanel = page.getByTestId('analyze-optimization-suggestions-panel')
  await expect(suggestionsPanel).toBeVisible({ timeout: 45_000 })

  const copyTicket = page.getByTestId('analyze-suggestion-copy-ticket').first()
  await expect(copyTicket).toBeVisible({ timeout: 20_000 })
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
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })

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
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })

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
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByLabel('Ordered inspect steps')).toBeVisible({ timeout: 30_000 })
})

test('Analyze: paste fixture, persist, reopen in fresh tab, restore node deep link', async ({ page, context }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()

  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()

  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByLabel('Analyze workspace')).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })

  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]analysis=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 60_000 })
  await expect(reopen.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 60_000 })
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

test('Analyze: reopened snapshot shows ranked band hint then pivot reopened thread', async ({ page, context }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]analysis=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByTestId('analyze-ranked-restored-hint')).toContainText(/Ranked — reopened/i)

  await expect(reopen.locator('.react-flow__node').first()).toBeVisible({ timeout: 30_000 })
  await reopen.locator('.react-flow__node').first().click()
  await expect(reopen.getByTestId('analyze-graph-local-findings-shelf')).toBeVisible({ timeout: 15_000 })
  await reopen.getByTestId('analyze-local-evidence-open-top-in-list').click()
  await expect(reopen.getByTestId('analyze-ranked-handoff-hint')).toContainText(/Continues from plan — reopened/i)
  await reopen.close()
})

test('Analyze: reopen with empty plan input exports markdown using snapshot payload', async ({ page, context }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()

  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]analysis=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByTestId('analyze-export-snapshot-cue')).toBeVisible({ timeout: 20_000 })
  await expect(reopen.getByTestId('analyze-ranked-restored-hint')).toContainText(/Ranked — reopened/i)

  const requestPromise = reopen.waitForRequest(
    (r) => r.url().includes('/api/report/markdown') && r.method() === 'POST',
  )
  const responsePromise = reopen.waitForResponse(
    (r) => r.url().includes('/api/report/markdown') && r.request().method() === 'POST',
  )
  const [exportReq, exportRes] = await Promise.all([
    requestPromise,
    responsePromise,
    reopen.getByTestId('analyze-export-markdown').click(),
  ])
  const postJson = exportReq.postDataJSON() as { analysis?: { analysisId?: string } }
  expect(exportRes.ok(), await exportRes.text()).toBeTruthy()
  expect(postJson?.analysis?.analysisId).toBeTruthy()
  const payload = (await exportRes.json()) as { markdown: string; analysisId: string }
  expect(payload.markdown).toMatch(/Postgres Query Autopsy|Analyze/i)
  expect(payload.markdown.length).toBeGreaterThan(120)
  await reopen.close()
})

test('Analyze: reopen with empty plan input exports HTML using snapshot payload', async ({ page, context }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()

  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = page.url()

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByTestId('analyze-export-snapshot-cue')).toBeVisible({ timeout: 20_000 })

  const requestPromise = reopen.waitForRequest(
    (r) => r.url().includes('/api/report/html') && r.method() === 'POST',
  )
  const responsePromise = reopen.waitForResponse(
    (r) => r.url().includes('/api/report/html') && r.request().method() === 'POST',
  )
  const [exportReq, exportRes] = await Promise.all([
    requestPromise,
    responsePromise,
    reopen.getByTestId('analyze-export-html').click(),
  ])
  const postJson = exportReq.postDataJSON() as { analysis?: { analysisId?: string } }
  expect(exportRes.ok(), await exportRes.text()).toBeTruthy()
  expect(postJson?.analysis?.analysisId).toBeTruthy()
  const payload = (await exportRes.json()) as { html: string; analysisId: string }
  expect(payload.html.length).toBeGreaterThan(200)
  expect(payload.html).toMatch(/<html/i)
  expect(payload.html).toMatch(/Postgres Query Autopsy|Analyze/i)
  await reopen.close()
})

test('Analyze: reopen with empty plan input exports JSON using snapshot payload', async ({ page, context }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()

  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]analysis=/, { timeout: 30_000 })
  const persistedUrl = page.url()

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('analyze-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByTestId('analyze-export-snapshot-cue')).toBeVisible({ timeout: 20_000 })

  const requestPromise = reopen.waitForRequest(
    (r) => r.url().includes('/api/report/json') && r.method() === 'POST',
  )
  const responsePromise = reopen.waitForResponse(
    (r) => r.url().includes('/api/report/json') && r.request().method() === 'POST',
  )
  const [exportReq, exportRes] = await Promise.all([
    requestPromise,
    responsePromise,
    reopen.getByTestId('analyze-export-json').click(),
  ])
  const postJson = exportReq.postDataJSON() as { analysis?: { analysisId?: string } }
  expect(exportRes.ok(), await exportRes.text()).toBeTruthy()
  expect(postJson?.analysis?.analysisId).toBeTruthy()
  const payload = (await exportRes.json()) as { analysisId: string; nodes?: unknown[]; findings?: unknown[] }
  expect(payload.analysisId).toBe(postJson?.analysis?.analysisId)
  expect(Array.isArray(payload.nodes)).toBe(true)
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
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })

  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]comparison=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByText('Summary', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByRole('heading', { name: 'Findings diff' })).toBeVisible({ timeout: 30_000 })
  await expect(reopen.getByTestId('compare-pair-handoff-hint')).toHaveAttribute('data-pqat-handoff-origin', 'link')
  await expect(reopen.getByTestId('compare-pair-handoff-hint')).toContainText(/Summary — reopened/i)
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
  await expect(reopen.getByTestId('compare-pair-handoff-hint')).toHaveAttribute('data-pqat-handoff-origin', 'link')
  // Deep link restores pins + pair; triage bridge usually wins → summary handoff, not pinned-only copy.
  await expect(reopen.getByTestId('compare-pair-handoff-hint')).toContainText(/Summary — reopened/i)
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

test('Compare: Show in list from triage strip highlights finding diff in viewport', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByTestId('compare-scan-signals')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  await page.getByRole('button', { name: 'Show in list' }).first().click()

  const activeRow = page.locator('.pqat-artifactOutline--active').first()
  await expect(activeRow).toBeVisible({ timeout: 20_000 })
  await expect(activeRow).toBeInViewport()
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
  await expect(page.getByText(/Reading thread ·/)).toBeVisible()
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
  await expect(page.getByText(/Reading thread ·/)).toBeVisible()
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
  await expect(row).toBeInViewport()
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
  const settled = new URL(page.url()).searchParams.get('suggestion')
  expect(settled, 'Compare URL should retain a suggestion pin after hydrate').toBeTruthy()
  expect(new URL(page.url()).searchParams.get('comparison')).toBe(body.comparisonId)
  const row = page.locator(`[data-artifact="compare-suggestion"][data-artifact-id="${body.canonicalSuggestionId}"]`)
  await expect(row).toBeVisible({ timeout: 30_000 })
  await expect(row).toBeInViewport()
  await expect(row).toHaveClass(/pqat-suggestionItem--highlight/)

  const reopen = await context.newPage()
  await reopen.goto(deepUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  expect(new URL(reopen.url()).searchParams.get('suggestion')).toBe(settled)
  expect(new URL(reopen.url()).searchParams.get('comparison')).toBe(body.comparisonId)
  const row2 = reopen.locator(`[data-artifact="compare-suggestion"][data-artifact-id="${body.canonicalSuggestionId}"]`)
  await expect(row2).toBeVisible({ timeout: 30_000 })
  await expect(row2).toBeInViewport()
  await expect(row2).toHaveClass(/pqat-suggestionItem--highlight/)
  await reopen.close()
})

test('Compare: finding= deep link highlight survives reopen in fresh tab', async ({ page, context }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByRole('heading', { name: 'Findings diff' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })

  const firstFinding = page.locator('[data-artifact="finding-diff"][data-artifact-id]').first()
  await expect(firstFinding).toBeVisible({ timeout: 45_000 })
  const diffId = await firstFinding.getAttribute('data-artifact-id')
  expect(diffId).toBeTruthy()

  const cmp = new URL(page.url()).searchParams.get('comparison')
  expect(cmp).toBeTruthy()
  const deepUrl = `/compare?comparison=${encodeURIComponent(cmp!)}&finding=${encodeURIComponent(diffId!)}`

  await page.goto(deepUrl)
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  expect(new URL(page.url()).searchParams.get('finding')).toBe(diffId)
  expect(new URL(page.url()).searchParams.get('comparison')).toBe(cmp)
  const row = page.locator(`[data-artifact="finding-diff"][data-artifact-id="${diffId}"]`).first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await expect(row).toBeInViewport()
  await expect(row).toHaveClass(/pqat-artifactOutline--active/)

  const reopen = await context.newPage()
  await reopen.goto(deepUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  expect(new URL(reopen.url()).searchParams.get('finding')).toBe(diffId)
  expect(new URL(reopen.url()).searchParams.get('comparison')).toBe(cmp)
  const row2 = reopen.locator(`[data-artifact="finding-diff"][data-artifact-id="${diffId}"]`).first()
  await expect(row2).toBeVisible({ timeout: 30_000 })
  await expect(row2).toHaveClass(/pqat-artifactOutline--active/)
  await reopen.close()
})

test('Compare: indexDiff= deep link highlight survives reopen in fresh tab', async ({ page, context }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })

  const indexCallout = page.getByTestId('compare-index-changes-callout')
  await expect(indexCallout).toBeVisible({ timeout: 45_000 })
  const firstInsight = indexCallout.locator('[data-artifact="index-insight-diff"][data-artifact-id]').first()
  await expect(firstInsight).toBeVisible({ timeout: 30_000 })
  const insightId = await firstInsight.getAttribute('data-artifact-id')
  expect(insightId).toBeTruthy()
  expect(insightId).toMatch(/^ii_/)

  const cmp = new URL(page.url()).searchParams.get('comparison')
  expect(cmp).toBeTruthy()
  const deepUrl = `/compare?comparison=${encodeURIComponent(cmp!)}&indexDiff=${encodeURIComponent(insightId!)}`

  await page.goto(deepUrl)
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  expect(new URL(page.url()).searchParams.get('indexDiff')).toBe(insightId)
  expect(new URL(page.url()).searchParams.get('comparison')).toBe(cmp)
  const calloutPinned = page.getByTestId('compare-index-changes-callout')
  await expect(calloutPinned).toBeInViewport()
  const row = calloutPinned.locator(`[data-artifact-id="${insightId}"]`).first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await expect(row).toHaveClass(/pqat-indexInsightItem--active/)

  const reopen = await context.newPage()
  await reopen.goto(deepUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  expect(new URL(reopen.url()).searchParams.get('indexDiff')).toBe(insightId)
  expect(new URL(reopen.url()).searchParams.get('comparison')).toBe(cmp)
  const row2 = reopen.getByTestId('compare-index-changes-callout').locator(`[data-artifact-id="${insightId}"]`).first()
  await expect(row2).toBeVisible({ timeout: 30_000 })
  await expect(row2).toHaveClass(/pqat-indexInsightItem--active/)
  await reopen.close()
})

test('Compare: deep link shows hydrate pin announcement then clears', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })

  const indexCallout = page.getByTestId('compare-index-changes-callout')
  await expect(indexCallout).toBeVisible({ timeout: 45_000 })
  const firstInsight = indexCallout.locator('[data-artifact="index-insight-diff"][data-artifact-id]').first()
  await expect(firstInsight).toBeVisible({ timeout: 30_000 })
  const insightId = await firstInsight.getAttribute('data-artifact-id')
  expect(insightId).toBeTruthy()

  const cmp = new URL(page.url()).searchParams.get('comparison')
  expect(cmp).toBeTruthy()
  const deepUrl = `/compare?comparison=${encodeURIComponent(cmp!)}&indexDiff=${encodeURIComponent(insightId!)}`

  await page.goto(deepUrl)
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })

  const live = page.getByTestId('compare-pin-live')
  await expect(live).toContainText(/opened with.*index insight/i, { timeout: 15_000 })
  // Hydrate copy auto-clears (COMPARE_PIN_HYDRATE_CLEAR_MS + buffer) so the region is not sticky status.
  await expect(live).toHaveText('', { timeout: 9_000 })
})

test('Compare: same snapshot resyncs index pin when indexDiff= changes in URL', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('rewrite_sort_seq_shipments.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('rewrite_index_ordered_shipments.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })

  const list = page
    .getByTestId('compare-index-changes-callout')
    .getByRole('list', { name: /Index insight diffs/i })
  const items = list.getByRole('listitem')
  await expect(items.first()).toBeVisible({ timeout: 30_000 })
  const id0 = await items.nth(0).getAttribute('data-artifact-id')
  const id1 = await items.nth(1).getAttribute('data-artifact-id')
  expect(id0).toBeTruthy()
  expect(id1).toBeTruthy()

  const cmp = new URL(page.url()).searchParams.get('comparison')
  expect(cmp).toBeTruthy()

  await page.goto(`/compare?comparison=${encodeURIComponent(cmp!)}&indexDiff=${encodeURIComponent(id0!)}`)
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(
    page.getByTestId('compare-index-changes-callout').locator(`[data-artifact-id="${id0}"]`).first(),
  ).toHaveClass(/pqat-indexInsightItem--active/)

  await page.goto(`/compare?comparison=${encodeURIComponent(cmp!)}&indexDiff=${encodeURIComponent(id1!)}`)
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(
    page.getByTestId('compare-index-changes-callout').locator(`[data-artifact-id="${id1}"]`).first(),
  ).toHaveClass(/pqat-indexInsightItem--active/)
})

test('Compare: clicking Index changes row pins insight and updates URL', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const indexCallout = page.getByTestId('compare-index-changes-callout')
  await expect(indexCallout).toBeVisible({ timeout: 45_000 })
  const firstInsight = indexCallout.locator('[data-artifact="index-insight-diff"][data-artifact-id]').first()
  await expect(firstInsight).toBeVisible({ timeout: 30_000 })
  await firstInsight.scrollIntoViewIfNeeded()
  const insightId = await firstInsight.getAttribute('data-artifact-id')
  expect(insightId).toBeTruthy()

  await firstInsight.click()
  await expect(page).toHaveURL(new RegExp(`[?&]indexDiff=${encodeURIComponent(insightId!)}`), { timeout: 15_000 })
  await expect(firstInsight).toHaveClass(/pqat-indexInsightItem--active/)
  await expect(page.getByTestId('compare-pinned-summary')).toContainText(/index insight/)
})

test('Compare: keyboard roves Index changes (2+ rows) and Enter pins row', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('rewrite_sort_seq_shipments.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('rewrite_index_ordered_shipments.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const indexCallout = page.getByTestId('compare-index-changes-callout')
  await expect(indexCallout).toBeVisible({ timeout: 45_000 })
  const list = indexCallout.getByRole('list', { name: /Index insight diffs/i })
  const items = list.getByRole('listitem')
  await expect(items.first()).toBeVisible({ timeout: 30_000 })
  const count = await items.count()
  expect(count).toBeGreaterThanOrEqual(2)

  const first = items.nth(0)
  await first.focus()
  await expect(first).toBeFocused()

  await page.keyboard.press('ArrowDown')
  const second = items.nth(1)
  await expect(second).toBeFocused()

  const targetId = await second.getAttribute('data-artifact-id')
  expect(targetId).toBeTruthy()

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`[?&]indexDiff=${encodeURIComponent(targetId!)}`), { timeout: 15_000 })
  await expect(second).toHaveClass(/pqat-indexInsightItem--active/)
  await expect(page.getByTestId('compare-pin-live')).toContainText(/index insight pinned/i)
})

test('Compare: Space pins focused Index changes row like Enter', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('rewrite_sort_seq_shipments.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('rewrite_index_ordered_shipments.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const indexCallout = page.getByTestId('compare-index-changes-callout')
  await expect(indexCallout).toBeVisible({ timeout: 45_000 })
  const list = indexCallout.getByRole('list', { name: /Index insight diffs/i })
  const items = list.getByRole('listitem')
  await expect(items.first()).toBeVisible({ timeout: 30_000 })
  await items.first().focus()
  await expect(items.first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  const second = items.nth(1)
  await expect(second).toBeFocused()

  const targetId = await second.getAttribute('data-artifact-id')
  expect(targetId).toBeTruthy()

  await page.keyboard.press('Space')
  await expect(page).toHaveURL(new RegExp(`[?&]indexDiff=${encodeURIComponent(targetId!)}`), { timeout: 15_000 })
  await expect(second).toHaveClass(/pqat-indexInsightItem--active/)
})

test('Compare: Next steps Pin Home and End move keyboard focus', async ({ page }) => {
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

  const pins = page.locator('.pqat-nextStepsPinList .pqat-suggestionPinBtn')
  await expect(pins.first()).toBeVisible({ timeout: 30_000 })
  const n = await pins.count()
  expect(n).toBeGreaterThanOrEqual(2)

  await pins.nth(1).focus()
  await expect(pins.nth(1)).toBeFocused()
  await page.keyboard.press('Home')
  await expect(pins.nth(0)).toBeFocused()
  await page.keyboard.press('End')
  await expect(pins.nth(n - 1)).toBeFocused()
})

test('Compare: Copy link with pinned finding includes ticket lines', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

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
  await expect(page).toHaveURL(new RegExp(`[?&]finding=${encodeURIComponent(diffId!)}`), { timeout: 15_000 })

  await page.getByTestId('compare-copy-deep-link').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toMatch(/Pair ref:\s*pair_/i)
  expect(clip).toContain(`Highlighted finding: ${diffId}`)
})

test('Compare: Copy pin context omits URL and includes pinned lines', async ({ page }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

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
  expect(clip).toMatch(/Pair ref:\s*pair_/i)
  expect(clip).toMatch(/Link includes:.*finding/i)
})

test('Compare: Copy link with pinned suggestion includes ticket lines', async ({ page }) => {
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

  const pinBtn = page.locator('.pqat-suggestionPinBtn').first()
  await expect(pinBtn).toBeVisible({ timeout: 30_000 })
  const describedBy = await pinBtn.getAttribute('aria-describedby')
  expect(describedBy).toMatch(/^compare-next-step-title-/)
  const suggestionId = describedBy!.replace('compare-next-step-title-', '')

  await pinBtn.click()
  await expect(page).toHaveURL(new RegExp(`[?&]suggestion=${encodeURIComponent(suggestionId)}`), { timeout: 15_000 })

  await page.getByTestId('compare-copy-deep-link').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toMatch(/Pair ref:\s*pair_/i)
  expect(clip).toContain(`Highlighted next step: ${suggestionId}`)
})

test('Compare: Copy link with pinned index insight includes ticket lines and round-trips URL', async ({ page, context }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Comparing…/)).toBeHidden({ timeout: 90_000 })

  const indexCallout = page.getByTestId('compare-index-changes-callout')
  await expect(indexCallout).toBeVisible({ timeout: 45_000 })
  const firstInsight = indexCallout.locator('[data-artifact="index-insight-diff"][data-artifact-id]').first()
  await expect(firstInsight).toBeVisible({ timeout: 30_000 })
  const insightId = await firstInsight.getAttribute('data-artifact-id')
  expect(insightId).toBeTruthy()
  expect(insightId).toMatch(/^ii_/)

  const cmp = new URL(page.url()).searchParams.get('comparison')
  expect(cmp).toBeTruthy()
  await page.goto(`/compare?comparison=${encodeURIComponent(cmp!)}&indexDiff=${encodeURIComponent(insightId!)}`)
  await expect(page.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(page.getByTestId('compare-index-changes-callout')).toBeInViewport()

  await page.getByTestId('compare-copy-deep-link').click()
  const clip = await readE2eCapturedClipboard(page)
  expect(clip).toMatch(/^https?:\/\//m)
  expect(clip).toContain('PQAT compare:')
  expect(clip).toContain(`Highlighted index change: ${insightId}`)
  expect(clip).toMatch(/Pair ref:\s*pair_/i)
  const urlLine = clip
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^https?:\/\//.test(l))
  expect(urlLine, 'clipboard should include an absolute URL line').toBeTruthy()
  expect(urlLine).toContain('indexDiff=')
  expect(urlLine).toContain(insightId!)

  const reopen = await context.newPage()
  await reopen.goto(urlLine!)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  expect(new URL(reopen.url()).searchParams.get('indexDiff')).toBe(insightId)
  await expect(
    reopen.getByTestId('compare-index-changes-callout').locator(`[data-artifact-id="${insightId}"]`).first(),
  ).toHaveClass(/pqat-indexInsightItem--active/)
  await reopen.close()
})

test('Compare: reopen with empty plan inputs exports markdown using snapshot payload', async ({ page, context }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })
  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]comparison=/)

  const reopen = await context.newPage()

  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByText('Summary', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByTestId('compare-export-snapshot-cue')).toBeVisible({ timeout: 20_000 })

  // Do not use page.route() here: Playwright can omit/truncate postData for large JSON bodies, which breaks
  // route.continue() and yields a failed export — use waitForRequest instead.
  const requestPromise = reopen.waitForRequest(
    (r) => r.url().includes('/api/compare/report/markdown') && r.method() === 'POST',
  )
  const responsePromise = reopen.waitForResponse(
    (r) => r.url().includes('/api/compare/report/markdown') && r.request().method() === 'POST',
  )
  const [exportReq, exportRes] = await Promise.all([
    requestPromise,
    responsePromise,
    reopen.getByTestId('compare-export-markdown').click(),
  ])
  const postJson = exportReq.postDataJSON() as { comparison?: { comparisonId?: string } }
  expect(exportRes.ok(), await exportRes.text()).toBeTruthy()
  expect(postJson?.comparison?.comparisonId).toBeTruthy()
  const payload = (await exportRes.json()) as { markdown: string; comparisonId: string }
  expect(payload.markdown).toContain('## Reading thread')
  expect(payload.markdown).toContain('**Change at a glance**')
  expect(payload.markdown).toContain('ComparisonId:')
  expect(payload.markdown).toMatch(/Postgres Query Autopsy Compare Report/)
  await reopen.close()
})

test('Compare: reopen with empty plan inputs exports HTML using snapshot payload', async ({ page, context }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })
  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]comparison=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByText('Summary', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByTestId('compare-export-snapshot-cue')).toBeVisible({ timeout: 20_000 })

  const requestPromise = reopen.waitForRequest(
    (r) => r.url().includes('/api/compare/report/html') && r.method() === 'POST',
  )
  const responsePromise = reopen.waitForResponse(
    (r) => r.url().includes('/api/compare/report/html') && r.request().method() === 'POST',
  )
  const [exportReq, exportRes] = await Promise.all([
    requestPromise,
    responsePromise,
    reopen.getByTestId('compare-export-html').click(),
  ])
  const postJson = exportReq.postDataJSON() as { comparison?: { comparisonId?: string } }
  expect(exportRes.ok(), await exportRes.text()).toBeTruthy()
  expect(postJson?.comparison?.comparisonId).toBeTruthy()
  const payload = (await exportRes.json()) as { html: string; comparisonId: string }
  expect(payload.html.length).toBeGreaterThan(200)
  expect(payload.html).toMatch(/<html/i)
  expect(payload.html).toMatch(/Postgres Query Autopsy|Compare/i)
  await reopen.close()
})

test('Compare: reopen with empty plan inputs exports JSON using snapshot payload', async ({ page, context }) => {
  const planA = readFileSync(postgresJsonFixture('compare_before_seq_scan.json'), 'utf-8')
  const planB = readFileSync(postgresJsonFixture('compare_after_index_scan.json'), 'utf-8')

  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  await page.getByTestId('compare-plan-a-text').fill(planA)
  await page.getByTestId('compare-plan-b-text').fill(planB)
  await page.getByRole('button', { name: 'Compare' }).click()

  await expect(page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page).toHaveURL(/[?&]comparison=/, { timeout: 60_000 })
  const persistedUrl = page.url()
  expect(persistedUrl).toMatch(/[?&]comparison=/)

  const reopen = await context.newPage()
  await reopen.goto(persistedUrl)
  await expect(reopen.getByTestId('compare-persisted-loading')).toBeHidden({ timeout: 90_000 })
  await expect(reopen.getByText('Summary', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(reopen.getByTestId('compare-export-snapshot-cue')).toBeVisible({ timeout: 20_000 })

  const requestPromise = reopen.waitForRequest(
    (r) => r.url().includes('/api/compare/report/json') && r.method() === 'POST',
  )
  const responsePromise = reopen.waitForResponse(
    (r) => r.url().includes('/api/compare/report/json') && r.request().method() === 'POST',
  )
  const [exportReq, exportRes] = await Promise.all([
    requestPromise,
    responsePromise,
    reopen.getByTestId('compare-export-json').click(),
  ])
  const postJson = exportReq.postDataJSON() as { comparison?: { comparisonId?: string } }
  expect(exportRes.ok(), await exportRes.text()).toBeTruthy()
  expect(postJson?.comparison?.comparisonId).toBeTruthy()
  const payload = (await exportRes.json()) as { comparisonId: string; planA?: unknown; planB?: unknown }
  expect(payload.comparisonId).toBe(postJson?.comparison?.comparisonId)
  expect(payload.planA).toBeTruthy()
  expect(payload.planB).toBeTruthy()
  await reopen.close()
})

test('Analyze: export failure shows calm status line without error-code prefix', async ({ page }) => {
  const planText = readFileSync(postgresJsonFixture('simple_seq_scan.json'), 'utf-8')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Analyze' })).toBeVisible()
  await page.getByPlaceholder(/JSON or psql/i).fill(planText)
  await page.getByRole('button', { name: /Analyze/i }).click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })

  await page.route('**/api/report/markdown', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'request_body_invalid',
        message:
          'This export request could not be read. Reload the page and try again, or paste the plan text again before exporting.',
      }),
    })
  })

  await page.getByTestId('analyze-export-markdown').click()
  const status = page.getByTestId('analyze-export-status')
  await expect(status).toBeVisible({ timeout: 15_000 })
  await expect(status).toContainText(/could not be read/i)
  await expect(status).not.toContainText('request_body_invalid:')
})

test('Analyze: long suggestions surface uses virtual scroller and triage-aligned cue', async ({ page }) => {
  await page.route('**/api/analyze', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const j = (await response.json()) as Record<string, unknown>
    const findings = (j.findings as Array<{ findingId: string }>) ?? []
    const fid = findings[0]?.findingId
    if (!fid) {
      await route.fulfill({ response })
      return
    }
    const orig = (j.optimizationSuggestions as Array<Record<string, unknown>>) ?? []
    const tpl =
      orig[0] ?? {
        suggestionId: 'sg_tpl',
        category: 'index_experiment',
        suggestedActionType: 'create_index_candidate',
        title: 'Template',
        summary: 's',
        details: '',
        rationale: 'r',
        confidence: 'medium',
        priority: 'medium',
        targetNodeIds: ['n1'],
        relatedFindingIds: [] as string[],
        relatedIndexInsightNodeIds: [] as string[],
        cautions: [] as string[],
        validationSteps: [] as string[],
      }
    const padded: Array<Record<string, unknown>> = []
    for (let i = 0; i < 15; i++) {
      padded.push({
        ...tpl,
        suggestionId: `sg_pad_${i}`,
        title: `Padded suggestion ${i}`,
        relatedFindingIds: i === 14 ? [fid] : [],
      })
    }
    await route.fulfill({
      status: response.status(),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...j, optimizationSuggestions: padded }),
    })
  })

  await page.goto('/')
  await page.getByTestId('analyze-try-example-simple-seq-scan-capture').click()
  await expect(page.getByTestId('analyze-summary-heading')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('analyze-optimization-suggestions-panel')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('analyze-suggestions-virtual-scroller')).toBeVisible({ timeout: 30_000 })
  const alignedCard = page.getByTestId('analyze-suggestion-card-triage-aligned')
  await expect(alignedCard).toBeVisible({ timeout: 25_000 })
  // Plan workspace may grow (e.g. graph-local findings shelf); scroll before viewport assertions.
  await alignedCard.scrollIntoViewIfNeeded()
  await expect(alignedCard).toBeInViewport({ ratio: 0.12, timeout: 20_000 })
  const inScrollerBounds = await page.evaluate(() => {
    const sc = document.querySelector('[data-testid="analyze-suggestions-virtual-scroller"]')
    const card = document.querySelector('[data-testid="analyze-suggestion-card-triage-aligned"]')
    if (!(sc instanceof HTMLElement) || !(card instanceof HTMLElement)) return { ok: false, reason: 'missing' as const }
    const sb = sc.getBoundingClientRect()
    const cb = card.getBoundingClientRect()
    const intersects =
      cb.bottom > sb.top + 2 &&
      cb.top < sb.bottom - 2 &&
      cb.right > sb.left + 2 &&
      cb.left < sb.right - 2
    return { ok: intersects, reason: intersects ? ('ok' as const) : ('no_overlap' as const) }
  })
  expect(inScrollerBounds.ok, 'aligned suggestion card should sit inside the virtual scroller viewport').toBe(true)
})
