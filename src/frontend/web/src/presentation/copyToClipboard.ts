/**
 * Writes text to the system clipboard.
 *
 * **Order (Phase 84):** Try a **synchronous** hidden-textarea + `document.execCommand('copy')`
 * first while still inside the browser's user-activation window from the click. Some browsers
 * (notably Safari and strict Chromium builds) reject or no-op `navigator.clipboard.writeText` after
 * an `await` because the gesture is considered consumed.
 *
 * Then fall back to the async Clipboard API when execCommand returns false or is unavailable.
 */

function copyViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined') return false

  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('aria-hidden', 'true')
  ta.style.position = 'fixed'
  ta.style.left = '0'
  ta.style.top = '0'
  ta.style.width = '1px'
  ta.style.height = '1px'
  ta.style.padding = '0'
  ta.style.border = 'none'
  ta.style.outline = 'none'
  ta.style.boxShadow = 'none'
  ta.style.background = 'transparent'
  ta.style.opacity = '0'
  ta.style.pointerEvents = 'none'
  ta.style.zIndex = '-1'

  document.body.appendChild(ta)

  let ok = false
  try {
    if (typeof document.execCommand !== 'function') return false
    ta.focus({ preventScroll: true })
    ta.select()
    ta.setSelectionRange(0, text.length)
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    document.body.removeChild(ta)
  }

  return ok
}

export async function copyToClipboard(text: string): Promise<void> {
  if (typeof document !== 'undefined' && copyViaExecCommand(text)) {
    return
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  throw new Error('Clipboard unavailable: execCommand("copy") failed and Clipboard API is not available')
}
