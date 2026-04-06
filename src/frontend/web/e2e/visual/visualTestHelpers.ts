/**
 * Phase 75–76 — shared stabilization for workstation visual regression (e2e-visual).
 */
import { expect, type Locator, type Page } from '@playwright/test'

export const visualScreenshotOptions = {
  animations: 'disabled' as const,
}

export async function waitForFontsReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
}

/** First React Flow node visible — graph chunk mounted. */
export async function waitForReactFlowFirstNode(page: Page): Promise<void> {
  await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 45_000 })
}

/**
 * Phase 76: After nodes exist, wait for a non-trivial viewport size, then two rAF frames so internal layout can settle.
 * Reduces flake on **`analyze-happy-workspace`** when CI is slow.
 */
export async function waitForGraphLayoutSettled(page: Page): Promise<void> {
  await waitForReactFlowFirstNode(page)
  const viewport = page.locator('.react-flow__viewport').first()
  await expect(viewport).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(
      async () => {
        const box = await viewport.boundingBox()
        if (!box || box.width < 64 || box.height < 64) return ''
        return `${Math.round(box.width)}:${Math.round(box.height)}`
      },
      { timeout: 20_000, intervals: [40, 80, 120, 200] },
    )
    .not.toBe('')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      }),
  )
}

/** Scroll region into view, then capture (avoids offscreen clipping without full-page shots). */
export async function expectStableRegionScreenshot(locator: Locator, snapshotFileName: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded()
  await expect(locator).toHaveScreenshot(snapshotFileName, visualScreenshotOptions)
}
