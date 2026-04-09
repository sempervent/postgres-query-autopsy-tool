/** True when the event target is a field where ? should type literally. */
export function workflowGuideHotkeyShouldIgnoreTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  const ce = el.getAttribute?.('contenteditable')
  if (ce != null) {
    const l = ce.toLowerCase()
    if (l === 'true' || l === '') return true
  }
  return false
}

/**
 * `?` or `Shift+/` opens help when not typing in an input. Call from a window keydown listener.
 * Does not use Ctrl/Meta/Alt so browser shortcuts stay intact.
 */
export function isWorkflowGuideHotkey(e: KeyboardEvent): boolean {
  if (e.defaultPrevented) return false
  if (e.altKey || e.ctrlKey || e.metaKey) return false
  if (workflowGuideHotkeyShouldIgnoreTarget(e.target)) return false
  if (e.key === '?') return true
  if (e.shiftKey && (e.key === '/' || e.code === 'Slash')) return true
  return false
}
