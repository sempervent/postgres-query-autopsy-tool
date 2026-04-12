/** Scroll behavior that respects prefers-reduced-motion (Phase 110). */

export function preferredScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

export function scrollIntoViewOptionsForUser(
  base: ScrollIntoViewOptions = { block: 'center', inline: 'nearest' },
): ScrollIntoViewOptions {
  return { ...base, behavior: preferredScrollBehavior() }
}
