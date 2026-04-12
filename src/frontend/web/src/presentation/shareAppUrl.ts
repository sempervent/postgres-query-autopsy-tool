import { formatComparePinnedSummaryLine } from './artifactLinks'

/** Absolute URL for a same-origin pathname (e.g. `/analyze/…`) — used by copy-link actions. */
export function appUrlForPath(path: string): string {
  return `${window.location.origin}${path}`
}

export type CompareDeepLinkClipboardPins = {
  findingDiffId?: string | null
  indexInsightDiffId?: string | null
  suggestionId?: string | null
}

/** Multi-line clipboard payload so tickets get URL + stable PQAT ids (not URL alone). */
export function compareDeepLinkClipboardPayload(
  absoluteUrl: string,
  comparisonId: string,
  pairArtifactId?: string | null,
  pins?: CompareDeepLinkClipboardPins | null,
): string {
  const lines = [absoluteUrl.trim(), `PQAT compare: ${comparisonId.trim()}`]
  const p = pairArtifactId?.trim()
  if (p) lines.push(`Pair ref: ${p}`)
  const f = pins?.findingDiffId?.trim()
  const ix = pins?.indexInsightDiffId?.trim()
  const s = pins?.suggestionId?.trim()
  if (f) lines.push(`Highlighted finding: ${f}`)
  if (ix) lines.push(`Highlighted index change: ${ix}`)
  if (s) lines.push(`Highlighted next step: ${s}`)
  return lines.join('\n')
}

/**
 * Short chat/ticket block: no URL line — PQAT id, optional pair ref, pinned summary readout, optional rewrite line (Phase 96).
 */
export function compareCompactPinContextPayload(
  comparisonId: string,
  pairArtifactId: string | null | undefined,
  pins: CompareDeepLinkClipboardPins | null | undefined,
  options?: { rewriteOutcomeOneLiner?: string | null },
): string | null {
  const pinnedLine = formatComparePinnedSummaryLine({
    findingDiffId: pins?.findingDiffId,
    indexInsightDiffId: pins?.indexInsightDiffId,
    suggestionId: pins?.suggestionId,
  })
  const rw = options?.rewriteOutcomeOneLiner?.trim()
  if (!pinnedLine && !rw) return null
  const lines: string[] = [`PQAT compare: ${comparisonId.trim()}`]
  const p = pairArtifactId?.trim()
  if (p) lines.push(`Pair ref: ${p}`)
  if (pinnedLine) lines.push(pinnedLine)
  if (rw) lines.push(`Rewrite outcome: ${rw}`)
  return lines.join('\n')
}

export function analyzeDeepLinkClipboardPayload(
  absoluteUrl: string,
  analysisId: string,
  nodeId?: string | null,
  options?: { startHereHeadline?: string | null },
): string {
  const lines = [absoluteUrl.trim(), `PQAT analysis: ${analysisId.trim()}`]
  const sh = options?.startHereHeadline?.trim()
  if (sh) lines.push(`Start here: ${sh}`)
  const n = nodeId?.trim()
  if (n) lines.push(`Node: ${n}`)
  return lines.join('\n')
}
