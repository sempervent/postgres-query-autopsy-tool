/** DOM / URL helpers for stable compare & analyze artifact references (Phase 33). */

export const ArtifactDomKind = {
  findingDiff: 'finding-diff',
  indexInsightDiff: 'index-insight-diff',
  compareSuggestion: 'compare-suggestion',
} as const

export type ArtifactDomKind = (typeof ArtifactDomKind)[keyof typeof ArtifactDomKind]

/** Query keys used on `/compare` for deep links. */
export const CompareDeepLinkParam = {
  comparison: 'comparison',
  pair: 'pair',
  finding: 'finding',
  indexDiff: 'indexDiff',
  suggestion: 'suggestion',
} as const

/** Query keys on `/analyze` for share links and node selection (Phase 35). */
export const AnalyzeDeepLinkParam = {
  analysis: 'analysis',
  node: 'node',
} as const

export function scrollArtifactIntoView(
  kind: string,
  artifactId: string,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'nearest' },
): void {
  if (!artifactId || typeof document === 'undefined') return
  const el = document.querySelector(`[data-artifact="${kind}"][data-artifact-id="${artifactId}"]`)
  if (el instanceof HTMLElement && typeof el.scrollIntoView === 'function') el.scrollIntoView(options)
}

export function buildCompareDeepLinkSearchParams(parts: {
  comparisonId?: string | null
  pairArtifactId?: string | null
  findingDiffId?: string | null
  indexInsightDiffId?: string | null
  suggestionId?: string | null
}): URLSearchParams {
  const p = new URLSearchParams()
  if (parts.comparisonId) p.set(CompareDeepLinkParam.comparison, parts.comparisonId)
  if (parts.pairArtifactId) p.set(CompareDeepLinkParam.pair, parts.pairArtifactId)
  if (parts.findingDiffId) p.set(CompareDeepLinkParam.finding, parts.findingDiffId)
  if (parts.indexInsightDiffId) p.set(CompareDeepLinkParam.indexDiff, parts.indexInsightDiffId)
  if (parts.suggestionId) p.set(CompareDeepLinkParam.suggestion, parts.suggestionId)
  return p
}

export function compareDeepLinkPath(pathname: string, params: URLSearchParams): string {
  const q = params.toString()
  return q ? `${pathname}?${q}` : pathname
}

/** Same as {@link compareDeepLinkPath}; alias for analyze routes. */
export const analyzeDeepLinkPath = compareDeepLinkPath

export function buildAnalyzeDeepLinkSearchParams(parts: {
  analysisId?: string | null
  nodeId?: string | null
}): URLSearchParams {
  const p = new URLSearchParams()
  if (parts.analysisId) p.set(AnalyzeDeepLinkParam.analysis, parts.analysisId)
  if (parts.nodeId) p.set(AnalyzeDeepLinkParam.node, parts.nodeId)
  return p
}
