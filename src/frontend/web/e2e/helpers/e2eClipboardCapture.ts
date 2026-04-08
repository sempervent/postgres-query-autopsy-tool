/**
 * Phase 77 + 84 — CI-safe clipboard assertions for Playwright.
 *
 * Headless Chromium in Docker/CI often omits `navigator.clipboard.readText` in the page context.
 * We install hooks before navigation so copy flows exercise real app code (`copyToClipboard`) and
 * tests read captured payloads from `window` instead of `readText()`.
 *
 * **Phase 84:** The app tries **synchronous** `document.execCommand('copy')` first (user-gesture
 * safe), then `navigator.clipboard.writeText`. This helper records whichever path succeeds by
 * wrapping both.
 *
 * **Reuse:** Call `installE2eClipboardCapture` in `test.beforeEach` (before `page.goto`) and
 * `readE2eCapturedClipboard` after the copy action.
 */
import type { Page } from '@playwright/test'

export const E2E_CLIPBOARD_WINDOW_KEY = '__PQAT_E2E_CLIPBOARD_LAST__' as const

export async function installE2eClipboardCapture(page: Page): Promise<void> {
  const key = E2E_CLIPBOARD_WINDOW_KEY
  await page.addInitScript((k) => {
    const w = window as Window & Record<string, string | undefined>
    w[k] = ''

    const record = (text: string) => {
      w[k] = String(text)
    }

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: async (text: string) => {
          record(text)
        },
      },
    })

    const doc = document
    const origExec = doc.execCommand.bind(doc)
    doc.execCommand = function (commandId: string, showUI?: boolean, valueArg?: string) {
      if (commandId === 'copy') {
        const el = doc.activeElement
        if (el && el instanceof HTMLTextAreaElement) {
          record(el.value)
        }
      }
      return origExec(commandId, showUI, valueArg)
    }
  }, key)
}

export async function readE2eCapturedClipboard(page: Page): Promise<string> {
  const key = E2E_CLIPBOARD_WINDOW_KEY
  return page.evaluate((kk) => {
    const w = window as Window & Record<string, string | undefined>
    return w[kk] ?? ''
  }, key)
}
