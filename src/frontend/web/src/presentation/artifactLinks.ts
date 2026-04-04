/** DOM / URL helpers for stable compare & analyze artifact references (Phase 33). */

import type { StoredArtifactAccess } from '../api/types'

/** Button label for copy-link actions (non-auth vs auth semantics, Phase 37). */
export function shareArtifactLinkLabel(
  authEnabled: boolean,
  access: StoredArtifactAccess | null | undefined,
): string {
  if (!authEnabled) return 'Copy share link'
  if (!access) return 'Copy artifact link'
  if (access.accessScope === 'link' && access.allowLinkAccess) return 'Copy share link'
  if (access.accessScope === 'group') return 'Copy artifact link (group)'
  if (access.accessScope === 'public') return 'Copy artifact link (public)'
  return 'Copy artifact link (private)'
}

/** Toast after successful copy — matches whether the link is capability-style or identity-gated. */
export function copyArtifactShareToast(
  authEnabled: boolean,
  access: StoredArtifactAccess | null | undefined,
): string {
  if (!authEnabled) return 'Copied share link'
  if (!access) return 'Copied artifact link'
  if (access.accessScope === 'link' && access.allowLinkAccess) return 'Copied share link'
  return 'Copied artifact link'
}

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
