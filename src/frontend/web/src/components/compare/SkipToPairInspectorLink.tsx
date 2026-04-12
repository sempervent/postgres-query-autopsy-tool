import { scrollIntoViewOptionsForUser } from '../../presentation/motionPreferences'

/** In-page target after lists on narrow Compare (Phase 133). */
export const COMPARE_PAIR_INSPECTOR_ANCHOR_ID = 'compare-pair-inspector-region'

/**
 * After navigator/lists in a stacked Compare layout, jump to the pair inspector without tabbing through the whole column.
 * Visually hidden until focused (same pattern as Skip to Ranked findings on Analyze).
 */
export function SkipToPairInspectorLink(props: { visible: boolean }) {
  if (!props.visible) return null
  return (
    <nav className="pqat-compareNarrowShortcuts" aria-label="Compare shortcuts">
      <a
        href={`#${COMPARE_PAIR_INSPECTOR_ANCHOR_ID}`}
        className="pqat-skipToComparePair"
        data-testid="compare-skip-to-pair-inspector"
        onClick={(e) => {
          const el = document.getElementById(COMPARE_PAIR_INSPECTOR_ANCHOR_ID)
          if (el instanceof HTMLElement) {
            e.preventDefault()
            el.scrollIntoView(scrollIntoViewOptionsForUser({ block: 'start', inline: 'nearest' }))
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                el.focus()
              })
            })
          }
        }}
      >
        Skip to pair inspector
      </a>
    </nav>
  )
}
