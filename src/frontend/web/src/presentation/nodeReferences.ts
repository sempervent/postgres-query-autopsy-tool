import type { AnalyzedPlanNode, NodePairDetail } from '../api/types'
import { joinLabelAndSubtitle, nodeShortLabel, pairShortLabel } from './nodeLabels'

export function nearestMeaningfulAncestorSubtitle(nodeId: string, byId: Map<string, AnalyzedPlanNode>): string | null {
  const n = byId.get(nodeId)
  if (!n) return null

  // Walk up the parent chain looking for a meaningful boundary.
  let cur: AnalyzedPlanNode | null = n
  let depth = 0
  while (cur && depth < 60) {
    const parentId: string | null = cur.parentNodeId ?? null
    if (!parentId) break
    const p: AnalyzedPlanNode | null = byId.get(parentId) ?? null
    if (!p) break

    const t = String((p.node as any)?.nodeType ?? '').toLowerCase()
    const isJoin = t.includes(' join') || t === 'nested loop'
    const isBoundary = t.includes('aggregate') || t.includes('sort')

    if (isJoin || isBoundary) {
      return `under ${nodeShortLabel(p, byId)}`
    }
    cur = p
    depth++
  }

  // Fallback: parent label or depth.
  if (n.parentNodeId) {
    const p = byId.get(n.parentNodeId)
    if (p) return `under ${nodeShortLabel(p, byId)}`
  }

  // As last resort, compute depth.
  let d = 0
  cur = n
  while (cur?.parentNodeId && d < 60) {
    const p = byId.get(cur.parentNodeId)
    if (!p) break
    cur = p
    d++
  }
  return d ? `depth ${d}` : null
}

export function nodeReferenceText(nodeId: string, byId: Map<string, AnalyzedPlanNode>): string {
  const n = byId.get(nodeId)
  if (!n) return `Unknown operator · node ${nodeId}`
  const label = nodeShortLabel(n, byId)
  const sub = nearestMeaningfulAncestorSubtitle(nodeId, byId)
  const head = sub ? `${label} — ${sub}` : label
  return `${head} · node ${nodeId}`
}

export function hotspotReferenceText(nodeId: string, byId: Map<string, AnalyzedPlanNode>, kind?: string | null): string {
  const base = nodeReferenceText(nodeId, byId)
  return kind ? `${base} — ${kind}` : base
}

export function findingReferenceText(nodeId: string, byId: Map<string, AnalyzedPlanNode>, findingTitle?: string | null): string {
  const base = nodeReferenceText(nodeId, byId)
  return findingTitle ? `${base} — ${findingTitle}` : base
}

export function joinSubtitleForNode(nodeId: string, byId: Map<string, AnalyzedPlanNode>): string | null {
  const n = byId.get(nodeId)
  if (!n) return null
  const js = joinLabelAndSubtitle(n, byId)
  return js?.subtitle ?? null
}

export function pairReferenceText(pair: NodePairDetail, byIdA: Map<string, AnalyzedPlanNode>, byIdB: Map<string, AnalyzedPlanNode>): string {
  const label = pairShortLabel(pair, byIdA, byIdB)
  const aSub = joinSubtitleForNode(pair.identity.nodeIdA, byIdA)
  const bSub = joinSubtitleForNode(pair.identity.nodeIdB, byIdB)
  const sub = bSub ?? aSub
  const head = sub ? `${label} — ${sub}` : label
  return `${head} · A:${pair.identity.nodeIdA} B:${pair.identity.nodeIdB}`
}

