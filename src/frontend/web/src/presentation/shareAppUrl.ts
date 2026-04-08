/** Absolute URL for a same-origin pathname (e.g. `/analyze/…`) — used by copy-link actions. */
export function appUrlForPath(path: string): string {
  return `${window.location.origin}${path}`
}

/** Multi-line clipboard payload so tickets get URL + stable PQAT ids (not URL alone). */
export function compareDeepLinkClipboardPayload(
  absoluteUrl: string,
  comparisonId: string,
  pairArtifactId?: string | null,
): string {
  const lines = [absoluteUrl.trim(), `PQAT compare: ${comparisonId.trim()}`]
  const p = pairArtifactId?.trim()
  if (p) lines.push(`Pair ref: ${p}`)
  return lines.join('\n')
}

export function analyzeDeepLinkClipboardPayload(
  absoluteUrl: string,
  analysisId: string,
  nodeId?: string | null,
): string {
  const lines = [absoluteUrl.trim(), `PQAT analysis: ${analysisId.trim()}`]
  const n = nodeId?.trim()
  if (n) lines.push(`Node: ${n}`)
  return lines.join('\n')
}
