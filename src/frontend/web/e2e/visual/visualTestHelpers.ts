/**
 * Phase 75 — shared stabilization for workstation visual regression (e2e-visual).
 */
import { expect, type Locator, type Page } from '@playwright/test'

export const visualScreenshotOptions = {
  animations: 'disabled' as const,
}

export async function waitForFontsReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
}

/** First React Flow node visible — graph chunk settled enough for workspace screenshots. */
export async function waitForReactFlowFirstNode(page: Page): Promise<void> {
  await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 45_000 })
}

/** Scroll region into view, then capture (avoids offscreen clipping without full-page shots). */
export async function expectStableRegionScreenshot(locator: Locator, snapshotFileName: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded()
  await expect(locator).toHaveScreenshot(snapshotFileName, visualScreenshotOptions)
}
