import { withReopenedSuffix } from '../../presentation/reopenedContinuityCopy'

/** Where the pair inspector handoff came from — sibling to Analyze ranked thread hint. */
export type ComparePairHandoffKind = 'summary' | 'briefing' | 'pinned' | 'navigator'

/** Opened from a saved /compare?comparison=… link vs a comparison run in this session (Phase 132). */
export type ComparePairHandoffOrigin = 'link' | 'session'

/**
 * Compact pair-inspector thread line — user-facing, distinguishes saved links from in-session navigation.
 * Reopened **`link`** strings use **`withReopenedSuffix`** (Phase 135).
 */
export function comparePairHandoffDisplayText(kind: ComparePairHandoffKind, origin: ComparePairHandoffOrigin): string {
  switch (kind) {
    case 'summary':
      return origin === 'link' ? withReopenedSuffix('Summary') : 'From the summary'
    case 'briefing':
      return origin === 'link' ? withReopenedSuffix('Briefing') : 'From the briefing'
    case 'pinned':
      return origin === 'link' ? withReopenedSuffix('Pinned') : 'Pinned focus'
    case 'navigator':
      return origin === 'link' ? withReopenedSuffix('From the lists') : 'From the lists'
    default: {
      const _x: never = kind
      return _x
    }
  }
}
