import type { AnalyzedPlanNode, PlanAnalysisResult } from '../api/types'
import { nodeShortLabel } from './nodeLabels'

export type HotspotKind = 'exclusiveTime' | 'subtreeTime' | 'sharedReads'

export type HotspotItem = {
  kind: HotspotKind
  nodeId: string
  label: string
  evidence: string | null
}

function num(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  return null
}

export function buildHotspots(analysis: PlanAnalysisResult): HotspotItem[] {
  const byId = new Map<string, AnalyzedPlanNode>(analysis.nodes.map((n) => [n.nodeId, n]))

  function item(kind: HotspotKind, nodeId: string): HotspotItem | null {
    const n = byId.get(nodeId)
    if (!n) return null
    const label = nodeShortLabel(n, byId)

    const m: any = n.metrics as any
    const node: any = n.node as any

    let evidence: string | null = null
    if (kind === 'exclusiveTime') {
      const ms = num(m?.exclusiveActualTimeMsApprox)
      const share = num(m?.subtreeTimeShare)
      if (ms != null) evidence = `${ms.toFixed(2)}ms exclusive${share != null ? ` • ${(share * 100).toFixed(0)}% subtree share` : ''}`
    } else if (kind === 'subtreeTime') {
      const ms = num(m?.subtreeInclusiveTimeMs ?? m?.inclusiveActualTimeMs)
      const share = num(m?.subtreeTimeShare)
      if (ms != null) evidence = `${ms.toFixed(2)}ms subtree${share != null ? ` • ${(share * 100).toFixed(0)}% share` : ''}`
    } else if (kind === 'sharedReads') {
      const reads = num(node?.sharedReadBlocks)
      const share = num(m?.bufferShareOfPlan)
      if (reads != null) evidence = `${reads.toFixed(0)} shared reads${share != null ? ` • ${(share * 100).toFixed(0)}% of plan reads` : ''}`
    }

    return { kind, nodeId, label, evidence }
  }

  const out: HotspotItem[] = []

  for (const id of analysis.summary.topExclusiveTimeHotspotNodeIds ?? []) {
    const it = item('exclusiveTime', id)
    if (it) out.push(it)
  }
  for (const id of analysis.summary.topInclusiveTimeHotspotNodeIds ?? []) {
    const it = item('subtreeTime', id)
    if (it) out.push(it)
  }
  for (const id of analysis.summary.topSharedReadHotspotNodeIds ?? []) {
    const it = item('sharedReads', id)
    if (it) out.push(it)
  }

  return out
}

