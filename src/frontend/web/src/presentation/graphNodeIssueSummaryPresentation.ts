import type { AnalysisFinding } from '../api/types'

const MAX_TITLE = 96
const MAX_WHY = 150

function truncateOneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

/** First clause of summary for a calmer “why it matters” line (no raw rule ids). */
export function firstWhyClause(summary: string | null | undefined): string {
  const t = (summary ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const cut = t.search(/[.!?](\s|$)/)
  if (cut > 20 && cut <= MAX_WHY) return t.slice(0, cut + 1).trim()
  return truncateOneLine(t, MAX_WHY)
}

/**
 * Strongest local finding for the graph selection (same ordering as `rankedFindingsForNode`).
 * Phase 137: drives the in-graph issue band so users read the problem before the shelf.
 */
export type GraphNodeIssueSummaryModel = {
  severity: number
  problemTitle: string
  whyMatters: string
  inspectNextLine: string
}

export function buildGraphNodeIssueSummary(findingsOrdered: AnalysisFinding[]): GraphNodeIssueSummaryModel | null {
  const top = findingsOrdered[0]
  if (!top) return null
  const why = firstWhyClause(top.summary)
  return {
    severity: top.severity,
    problemTitle: truncateOneLine(top.title, MAX_TITLE),
    whyMatters: why || truncateOneLine(top.summary || top.title, MAX_WHY),
    inspectNextLine:
      'Next: use Selected node for timings and I/O. Open the full write-up in Ranked when you want every detail.',
  }
}
