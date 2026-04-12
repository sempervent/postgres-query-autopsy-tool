import type { AnalysisFinding } from '../api/types'

function sortFindingsForNode(hits: AnalysisFinding[]): AnalysisFinding[] {
  return [...hits].sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity
    return b.confidence - a.confidence
  })
}

/** Findings citing this node, severity then confidence (highest first). */
export function rankedFindingsForNode(findings: AnalysisFinding[], nodeId: string): AnalysisFinding[] {
  const hits = findings.filter((f) => (f.nodeIds ?? []).includes(nodeId))
  return sortFindingsForNode(hits)
}

/** Highest-severity finding citing this node (tie-break: higher confidence). */
export function topRankedFindingForNode(findings: AnalysisFinding[], nodeId: string): AnalysisFinding | null {
  const ranked = rankedFindingsForNode(findings, nodeId)
  return ranked[0] ?? null
}
