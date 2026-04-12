import { scrollIntoViewOptionsForUser } from '../../presentation/motionPreferences'

/** DOM id for in-page jump from plan-band evidence → Ranked column (Phase 126). */
export const ANALYZE_RANKED_FINDINGS_ANCHOR_ID = 'analyze-ranked-findings'

/** `h2` id for `aria-labelledby` on the Ranked panel (Phase 127). */
export const ANALYZE_RANKED_FINDINGS_HEADING_ID = 'analyze-ranked-findings-heading'

/**
 * Keyboard/skip navigation: after local evidence, jump to the Ranked findings list without hunting.
 * Visually hidden until focused (standard skip-link pattern).
 * Phase 127: explicit scroll + focus on the Ranked region (not browser-hash-only).
 */
export function SkipToRankedFindingsLink(props: { visible: boolean }) {
  if (!props.visible) return null
  return (
    <nav className="pqat-planEvidenceShortcuts" aria-label="Plan shortcuts">
      <a
        href={`#${ANALYZE_RANKED_FINDINGS_ANCHOR_ID}`}
        className="pqat-skipToRanked"
        data-testid="analyze-skip-to-ranked-findings"
        onClick={(e) => {
          const el = document.getElementById(ANALYZE_RANKED_FINDINGS_ANCHOR_ID)
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
        Skip to Ranked findings
      </a>
    </nav>
  )
}
