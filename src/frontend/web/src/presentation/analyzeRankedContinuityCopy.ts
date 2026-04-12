import { withReopenedSuffix } from './reopenedContinuityCopy'

/** Saved `?analysis=…` load vs a run from plan text in this tab — sibling to `ComparePairHandoffOrigin`. */
export type AnalyzeRankedHandoffOrigin = 'link' | 'session'

/** Graph-pivot ranked band — uses shared **`withReopenedSuffix`** (Phase 135). */
export function analyzeRankedPivotThreadLabel(origin: AnalyzeRankedHandoffOrigin): string {
  return origin === 'link' ? withReopenedSuffix('Continues from plan') : 'Continues from plan'
}

/** When the analysis was restored from a link and the graph pivot band is not active yet. */
export const ANALYZE_RANKED_BAND_RESTORED_HINT = withReopenedSuffix('Ranked')
