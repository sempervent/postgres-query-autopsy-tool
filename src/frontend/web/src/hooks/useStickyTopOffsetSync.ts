import { useLayoutEffect } from 'react'

const TOP_BAR_SELECTOR = '.topBar'
const CSS_VAR = '--pqat-sticky-top-offset'
const FALLBACK_PX = 54

/**
 * Keeps sticky summary bands below the real app header height (Phase 111).
 * Falls back to {@link FALLBACK_PX} when the bar is missing (tests, unusual shells).
 */
export function useStickyTopOffsetSync(enabled = true) {
  useLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    const root = document.documentElement

    function apply() {
      const bar = document.querySelector(TOP_BAR_SELECTOR)
      const h = bar instanceof HTMLElement ? bar.getBoundingClientRect().height : FALLBACK_PX
      const px = Math.max(FALLBACK_PX, Math.ceil(h))
      root.style.setProperty(CSS_VAR, `${px}px`)
    }

    apply()

    const bar = document.querySelector(TOP_BAR_SELECTOR)
    let ro: ResizeObserver | null = null
    if (bar instanceof HTMLElement && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => apply())
      ro.observe(bar)
    }

    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
      ro?.disconnect()
      root.style.removeProperty(CSS_VAR)
    }
  }, [enabled])
}
