import type { PlanComparisonResult } from '../api/types'
import { resolveCompareSuggestionParamToCanonicalId } from './optimizationSuggestionsPresentation'

/**
 * Read validated pin + pair selection from the URL for an already-loaded comparison.
 * Used whenever `location.search` changes so bookmarks and manual URL edits stay coherent.
 */
export function parseCompareUrlPinAndPairState(
  comparison: PlanComparisonResult,
  locationSearch: string,
): {
  findingDiffId: string | null
  indexInsightDiffId: string | null
  suggestionId: string | null
  pairSelection: { a: string; b: string } | null
} {
  const q = locationSearch.startsWith('?') ? locationSearch.slice(1) : locationSearch
  const sp = new URLSearchParams(q)

  const finding = sp.get('finding')
  const items = comparison.findingsDiff.items
  const findingDiffId = finding && items.some((x) => x.diffId === finding) ? finding : null

  const indexDiff = sp.get('indexDiff')
  const insightDiffs = comparison.indexComparison?.insightDiffs ?? []
  const indexInsightDiffId =
    indexDiff && insightDiffs.some((x) => x.insightDiffId === indexDiff) ? indexDiff : null

  const suggestionParam = sp.get('suggestion')
  const sugList = comparison.compareOptimizationSuggestions ?? []
  const suggestionId = resolveCompareSuggestionParamToCanonicalId(sugList, suggestionParam)

  const pairParam = sp.get('pair')
  let pairSelection: { a: string; b: string } | null = null
  if (pairParam) {
    const pd = comparison.pairDetails.find((p) => p.pairArtifactId === pairParam)
    if (pd?.identity?.nodeIdA != null && pd?.identity?.nodeIdB != null) {
      pairSelection = { a: pd.identity.nodeIdA, b: pd.identity.nodeIdB }
    }
  }

  // One primary pin for Copy link (finding > index insight > suggestion).
  if (findingDiffId) {
    return { findingDiffId, indexInsightDiffId: null, suggestionId: null, pairSelection }
  }
  if (indexInsightDiffId) {
    return { findingDiffId: null, indexInsightDiffId, suggestionId: null, pairSelection }
  }
  return { findingDiffId: null, indexInsightDiffId: null, suggestionId, pairSelection }
}
