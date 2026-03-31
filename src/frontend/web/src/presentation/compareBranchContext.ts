import type { AnalysisFinding, AnalyzedPlanNode, FindingDiffItem, NodeDelta, NodePairDetail, PlanComparisonResult } from '../api/types'
import { joinSideBadgesForPair } from './joinPainHints'
import { nodeShortLabel } from './nodeLabels'

export type CompareBranchRow = {
  nodeId: string
  depth: number
  label: string
  mappedPartnerId: string | null
  /** Row is the selected focal node on this side. */
  isFocal: boolean
  /** Node appears in unmatched list for this plan. */
  sideUnmatched: boolean
  /** Path segment vs immediate child of focal. */
  segment: 'path' | 'child'
}

export type CompareBranchViewModel = {
  pathRowsA: CompareBranchRow[]
  pathRowsB: CompareBranchRow[]
  childRowsA: CompareBranchRow[]
  childRowsB: CompareBranchRow[]
  /** Compact chips for the focal pair (deltas, structure, hints). */
  focalCues: string[]
  /** When operator types differ for the mapped pair. */
  operatorShiftLabel: string | null
  /** Shown when we cannot build a full pair context. */
  contextNote: string | null
}

function pathFromRootToNode(nodeId: string, byId: Map<string, AnalyzedPlanNode>, rootId: string): string[] {
  const up: string[] = []
  let cur: string | null | undefined = nodeId
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    up.push(cur)
    if (cur === rootId) break
    cur = byId.get(cur)?.parentNodeId ?? null
  }
  up.reverse()
  return up
}

function rowForSide(
  id: string,
  byId: Map<string, AnalyzedPlanNode>,
  depth: number,
  focalId: string,
  segment: 'path' | 'child',
  matchPartner: (id: string) => string | null,
  unmatched: Set<string>,
): CompareBranchRow {
  const n = byId.get(id)
  const label = n ? nodeShortLabel(n, byId) : 'Unknown operator'
  return {
    nodeId: id,
    depth,
    label,
    mappedPartnerId: matchPartner(id),
    isFocal: id === focalId,
    sideUnmatched: unmatched.has(id),
    segment,
  }
}

export function buildMatchLookup(matches: PlanComparisonResult['matches']) {
  const aToB = new Map<string, string>()
  const bToA = new Map<string, string>()
  for (const m of matches ?? []) {
    aToB.set(m.nodeIdA, m.nodeIdB)
    bToA.set(m.nodeIdB, m.nodeIdA)
  }
  return { aToB, bToA }
}

/** Resolve a findings diff item to a mapped pair when only one side is anchored. */
export function resolveFindingDiffPair(
  item: FindingDiffItem,
  matches: PlanComparisonResult['matches'],
): { a: string; b: string } | null {
  if (item.nodeIdA && item.nodeIdB) return { a: item.nodeIdA, b: item.nodeIdB }
  if (item.nodeIdA) {
    const m = matches.find((x) => x.nodeIdA === item.nodeIdA)
    return m ? { a: m.nodeIdA, b: m.nodeIdB } : null
  }
  if (item.nodeIdB) {
    const m = matches.find((x) => x.nodeIdB === item.nodeIdB)
    return m ? { a: m.nodeIdA, b: m.nodeIdB } : null
  }
  return null
}

function pickNodeDelta(nodeDeltas: NodeDelta[], nodeIdA: string, nodeIdB: string): NodeDelta | null {
  return nodeDeltas.find((d) => d.nodeIdA === nodeIdA && d.nodeIdB === nodeIdB) ?? null
}

function severeFindingHits(findings: AnalysisFinding[], nodeId: string, threshold = 3): number {
  return findings.filter((f) => f.severity >= threshold && f.nodeIds?.includes(nodeId)).length
}

export function buildCompareBranchViewModel(
  comparison: PlanComparisonResult,
  selected: { a: string; b: string } | null,
  selectedDetail: NodePairDetail | null,
): CompareBranchViewModel {
  if (!selected) {
    return {
      pathRowsA: [],
      pathRowsB: [],
      childRowsA: [],
      childRowsB: [],
      focalCues: [],
      operatorShiftLabel: null,
      contextNote: 'Select a mapped pair to see branch context in both plans.',
    }
  }

  const byA = new Map((comparison.planA.nodes ?? []).map((n) => [n.nodeId, n]))
  const byB = new Map((comparison.planB.nodes ?? []).map((n) => [n.nodeId, n]))
  const rootA = comparison.planA.rootNodeId
  const rootB = comparison.planB.rootNodeId
  const { aToB, bToA } = buildMatchLookup(comparison.matches)
  const unmatchedA = new Set(comparison.unmatchedNodeIdsA ?? [])
  const unmatchedB = new Set(comparison.unmatchedNodeIdsB ?? [])

  const pathA = pathFromRootToNode(selected.a, byA, rootA)
  const pathB = pathFromRootToNode(selected.b, byB, rootB)

  const pathRowsA = pathA.map((id, i) =>
    rowForSide(id, byA, i, selected.a, 'path', (nid) => aToB.get(nid) ?? null, unmatchedA),
  )
  const pathRowsB = pathB.map((id, i) =>
    rowForSide(id, byB, i, selected.b, 'path', (nid) => bToA.get(nid) ?? null, unmatchedB),
  )

  const focalA = byA.get(selected.a)
  const focalB = byB.get(selected.b)
  const childIdsA = (focalA?.childNodeIds ?? []).slice(0, 8)
  const childIdsB = (focalB?.childNodeIds ?? []).slice(0, 8)

  const depthFocalA = Math.max(0, pathA.length - 1)
  const depthFocalB = Math.max(0, pathB.length - 1)

  const childRowsA = childIdsA.map((id) =>
    rowForSide(id, byA, depthFocalA + 1, selected.a, 'child', (nid) => aToB.get(nid) ?? null, unmatchedA),
  )
  const childRowsB = childIdsB.map((id) =>
    rowForSide(id, byB, depthFocalB + 1, selected.b, 'child', (nid) => bToA.get(nid) ?? null, unmatchedB),
  )

  const delta = pickNodeDelta(comparison.nodeDeltas ?? [], selected.a, selected.b)
  const focalCues: string[] = []

  if (selectedDetail) {
    if (selectedDetail.identity.nodeTypeA !== selectedDetail.identity.nodeTypeB) {
      focalCues.push('op family shift')
    }
    focalCues.push(`conf ${selectedDetail.identity.matchConfidence}`)
    const joinBadges = joinSideBadgesForPair(selectedDetail, byA, byB, 2)
    for (const b of joinBadges) focalCues.push(b.text)
  }

  if (delta) {
    const t = delta.inclusiveTimeMs
    if (t?.delta != null && t.delta !== 0) focalCues.push(`time Δ ${t.delta > 0 ? '+' : ''}${String(t.delta)}ms`)
    const r = delta.sharedReadBlocks
    if (r?.delta != null && r.delta !== 0) focalCues.push(`reads Δ ${r.delta > 0 ? '+' : ''}${String(r.delta)}`)
  }

  if (selectedDetail) {
    const sevA = severeFindingHits(selectedDetail.findings.findingsA, selected.a)
    const sevB = severeFindingHits(selectedDetail.findings.findingsB, selected.b)
    if (sevA + sevB > 0) focalCues.push(`severe findings ${sevA + sevB}`)
    const hl = selectedDetail.contextDiff?.highlights?.[0]
    if (hl) focalCues.push(hl.length > 48 ? `${hl.slice(0, 47)}…` : hl)
  }

  const operatorShiftLabel =
    selectedDetail && selectedDetail.identity.nodeTypeA !== selectedDetail.identity.nodeTypeB
      ? `${selectedDetail.identity.nodeTypeA} ↔ ${selectedDetail.identity.nodeTypeB}`
      : null

  let contextNote: string | null = null
  if (!focalA || !focalB) contextNote = 'One side of the pair is missing from the analyzed node list.'
  else if (unmatchedA.has(selected.a) || unmatchedB.has(selected.b)) contextNote = 'Selected node is unmatched on one plan; mapping is partial.'

  return {
    pathRowsA,
    pathRowsB,
    childRowsA,
    childRowsB,
    focalCues: Array.from(new Set(focalCues)).slice(0, 8),
    operatorShiftLabel,
    contextNote,
  }
}
