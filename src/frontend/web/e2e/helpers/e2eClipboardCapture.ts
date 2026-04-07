/**
 * Phase 77 — CI-safe clipboard assertions for Playwright.
 *
 * Headless Chromium in Docker/CI often omits `navigator.clipboard.readText` in the page context
 * even when `writeText` exists. We install a minimal stub before navigation so copy flows still
 * exercise real app code (`copyToClipboard` → `navigator.clipboard.writeText`) and tests read the
 * captured payload from `window` instead of `readText()`.
 *
 * **Reuse:** For any spec that must assert copy payload text under `e2e-smoke` (or similar), call
 * `installE2eClipboardCapture` in `test.beforeEach` (before `page.goto`) and `readE2eCapturedClipboard`
 * after the copy action. Do not use for specs that need real OS clipboard integration.
 */
import type { Page } from '@playwright/test'

export const E2E_CLIPBOARD_WINDOW_KEY = '__PQAT_E2E_CLIPBOARD_LAST__' as const

export async function installE2eClipboardCapture(page: Page): Promise<void> {
  const key = E2E_CLIPBOARD_WINDOW_KEY
  await page.addInitScript((k) => {
    const w = window as Window & Record<string, string | undefined>
    w[k] = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: async (text: string) => {
          w[k] = String(text)
        },
      },
    })
  }, key)
}

export async function readE2eCapturedClipboard(page: Page): Promise<string> {
  const key = E2E_CLIPBOARD_WINDOW_KEY
  return page.evaluate((k) => {
    const w = window as Window & Record<string, string | undefined>
    return w[k] ?? ''
  }, key)
}
