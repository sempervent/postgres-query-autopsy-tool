/**
 * Lightweight Tab / Shift+Tab wrap inside the workflow guide shell (Phase 104).
 * Not a modal trap: Esc still closes the guide; focus can still reach the bar toggle via Shift+Tab from the first focusable.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isVisible(el: HTMLElement): boolean {
  const st = typeof window !== 'undefined' ? window.getComputedStyle(el) : null
  if (st && (st.visibility === 'hidden' || st.display === 'none')) return false
  return true
}

export function collectWorkflowGuideFocusables(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  const out: HTMLElement[] = []
  for (const el of nodes) {
    if (!isVisible(el)) continue
    if (el.matches(':disabled')) continue
    const ti = el.getAttribute('tabindex')
    if (ti === '-1') continue
    out.push(el)
  }
  return out
}

export function workflowGuideFocusLoopKeydownHandler(root: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab' || e.defaultPrevented) return
  const focusables = collectWorkflowGuideFocusables(root)
  if (focusables.length < 2) return
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !root.contains(active)) return
  const i = focusables.indexOf(active)
  if (i < 0) return
  const first = focusables[0]!
  const last = focusables[focusables.length - 1]!
  if (!e.shiftKey && i === focusables.length - 1) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && i === 0) {
    e.preventDefault()
    last.focus()
  }
}
