import type { PlanAnalysisResult, PlanIndexInsight } from '../api/types'

const familyLabels: Record<string, string> = {
  seqScan: 'Seq Scan',
  indexScan: 'Index Scan',
  indexOnlyScan: 'Index Only Scan',
  bitmapHeapScan: 'Bitmap Heap Scan',
  bitmapIndexScan: 'Bitmap Index Scan',
  other: 'Operator',
}

export function accessPathFamilyLabel(family: string): string {
  return familyLabels[family] ?? family
}

/** Insights targeting a specific plan node (may be multiple angles). */
export function indexInsightsForNodeId(analysis: PlanAnalysisResult, nodeId: string): PlanIndexInsight[] {
  const list = analysis.indexInsights ?? []
  return list.filter((i) => i.nodeId === nodeId)
}

export function formatAccessPathSummaryLine(insight: PlanIndexInsight): string {
  const fam = accessPathFamilyLabel(insight.accessPathFamily)
  const rel = insight.relationName
  const idx = insight.indexName
  if (rel && idx) return `Access path: ${fam} on \`${rel}\` via \`${idx}\``
  if (rel) return `Access path: ${fam} on \`${rel}\``
  return `Access path: ${fam}`
}

export function indexOverviewSummaryLine(overview: PlanAnalysisResult['indexOverview']): string | null {
  if (!overview) return null
  if (overview.suggestsChunkedBitmapWorkload) {
    return `Plan shape: Append + ${overview.bitmapHeapScanCount} bitmap heap scans (indexes likely used per chunk; total I/O may still be large).`
  }
  const parts: string[] = []
  if (overview.seqScanCount > 0) parts.push(`${overview.seqScanCount} seq scan(s)`)
  const idxTotal = overview.indexScanCount + overview.indexOnlyScanCount
  if (idxTotal > 0) parts.push(`${idxTotal} index scan(s)`)
  if (overview.bitmapHeapScanCount > 0) parts.push(`${overview.bitmapHeapScanCount} bitmap heap(s)`)
  if (parts.length === 0) return null
  return `Scan mix: ${parts.join(' · ')}`
}

export function accessPathChangeCue(familyA?: string | null, familyB?: string | null): string | null {
  if (!familyA || !familyB || familyA === familyB) return null
  return `Access path family: ${accessPathFamilyLabel(familyA)} → ${accessPathFamilyLabel(familyB)}`
}

/** Legacy numeric order + lowercase strings from API (Phase 31). */
const indexDiffKindNames = ['New', 'Resolved', 'Improved', 'Worsened', 'Changed', 'Unchanged'] as const

const lowerToTitle: Record<string, string> = {
  new: 'New',
  resolved: 'Resolved',
  improved: 'Improved',
  worsened: 'Worsened',
  changed: 'Changed',
  unchanged: 'Unchanged',
}

export function formatIndexInsightDiffKind(kind: string | number | undefined | null): string {
  if (kind == null) return 'Unknown'
  if (typeof kind === 'string') {
    const t = lowerToTitle[kind.toLowerCase()]
    if (t) return t
    return kind
  }
  const i = Math.round(kind)
  if (i >= 0 && i < indexDiffKindNames.length) return indexDiffKindNames[i]!
  return String(kind)
}
