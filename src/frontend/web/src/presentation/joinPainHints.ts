import type { AnalyzedPlanNode, EvidenceChangeDirection, NodePairDetail, OperatorContextEvidenceDiff } from '../api/types'
import type { Badge } from './contextBadges'
import { contextBadges } from './contextBadges'

function tone(dir: EvidenceChangeDirection): Badge['tone'] {
  if (dir === 'Improved') return 'good'
  if (dir === 'Worsened') return 'bad'
  if (dir === 'Mixed') return 'mixed'
  return 'neutral'
}

function arrow(dir: EvidenceChangeDirection): string {
  if (dir === 'Improved') return '↓'
  if (dir === 'Worsened') return '↑'
  if (dir === 'Mixed') return '±'
  if (dir === 'Neutral') return '•'
  return ''
}

function nodeTypeLower(n: AnalyzedPlanNode | null | undefined): string {
  return String((n?.node as any)?.nodeType ?? '').toLowerCase()
}

function isHashJoinNode(n: AnalyzedPlanNode | null | undefined): boolean {
  return nodeTypeLower(n).includes('hash join')
}

function isNestedLoopNode(n: AnalyzedPlanNode | null | undefined): boolean {
  return nodeTypeLower(n) === 'nested loop'
}

function isMergeJoinNode(n: AnalyzedPlanNode | null | undefined): boolean {
  return nodeTypeLower(n).includes('merge join')
}

function isJoinNode(n: AnalyzedPlanNode | null | undefined): boolean {
  const t = nodeTypeLower(n)
  return t.includes(' join') || t === 'nested loop'
}

export function joinSideBadgesForPair(
  pair: NodePairDetail | null | undefined,
  byIdA: Map<string, AnalyzedPlanNode>,
  byIdB: Map<string, AnalyzedPlanNode>,
  maxBadges = 3,
): Badge[] {
  if (!pair?.contextDiff) return []

  const a = byIdA.get(pair.identity.nodeIdA)
  const b = byIdB.get(pair.identity.nodeIdB)
  const diff = pair.contextDiff

  const out: Badge[] = []

  // Hash Join: hash build evidence is build-side evidence.
  if ((isHashJoinNode(a) || isHashJoinNode(b)) && diff.hashBuild?.pressureDirection && diff.hashBuild.pressureDirection !== 'NotApplicable') {
    out.push({ text: `build pressure ${arrow(diff.hashBuild.pressureDirection)}`, tone: tone(diff.hashBuild.pressureDirection) })
  }

  // Nested Loop: inner-side scan waste (when present) is inner-side evidence.
  if ((isNestedLoopNode(a) || isNestedLoopNode(b)) && diff.nestedLoop?.innerSideWaste?.wasteDirection && diff.nestedLoop.innerSideWaste.wasteDirection !== 'NotApplicable') {
    out.push({ text: `inner waste ${arrow(diff.nestedLoop.innerSideWaste.wasteDirection)}`, tone: tone(diff.nestedLoop.innerSideWaste.wasteDirection) })
  } else if ((isNestedLoopNode(a) || isNestedLoopNode(b)) && diff.nestedLoop?.amplificationDirection && diff.nestedLoop.amplificationDirection !== 'NotApplicable') {
    // Still nested-loop-specific and directioned, but attribute conservatively to inner repeated work.
    out.push({ text: `inner pressure ${arrow(diff.nestedLoop.amplificationDirection)}`, tone: tone(diff.nestedLoop.amplificationDirection) })
  }

  // Merge Join: no reliable side-attributed diff today; avoid guessing.
  if ((isMergeJoinNode(a) || isMergeJoinNode(b)) && out.length === 0) {
    // intentionally no side-attributed badges
  }

  if (out.length > 0) return out.slice(0, maxBadges)

  // Fallback to existing generic badges for joins (and only joins).
  if (isJoinNode(a) || isJoinNode(b)) return contextBadges(diff, maxBadges)
  return []
}

export function joinSideSummaryLinesForPair(
  pair: NodePairDetail | null | undefined,
  byIdA: Map<string, AnalyzedPlanNode>,
  byIdB: Map<string, AnalyzedPlanNode>,
): string[] {
  if (!pair?.contextDiff) return []
  const a = byIdA.get(pair.identity.nodeIdA)
  const b = byIdB.get(pair.identity.nodeIdB)
  const d = pair.contextDiff

  const lines: string[] = []

  if ((isHashJoinNode(a) || isHashJoinNode(b)) && d.hashBuild?.summary && d.hashBuild.pressureDirection !== 'NotApplicable') {
    const dir = d.hashBuild.pressureDirection
    const verdict =
      dir === 'Improved' ? 'Build side improved' : dir === 'Worsened' ? 'Build side worsened' : dir === 'Mixed' ? 'Build side mixed' : 'Build side changed'
    lines.push(`${verdict}: ${d.hashBuild.summary}.`)
  }

  if ((isNestedLoopNode(a) || isNestedLoopNode(b)) && d.nestedLoop?.innerSideWaste?.summary && d.nestedLoop.innerSideWaste.wasteDirection !== 'NotApplicable') {
    const dir = d.nestedLoop.innerSideWaste.wasteDirection
    const verdict =
      dir === 'Improved' ? 'Inner side improved' : dir === 'Worsened' ? 'Inner side worsened' : dir === 'Mixed' ? 'Inner side mixed' : 'Inner side changed'
    lines.push(`${verdict}: ${d.nestedLoop.innerSideWaste.summary}.`)
  } else if ((isNestedLoopNode(a) || isNestedLoopNode(b)) && d.nestedLoop?.summary && d.nestedLoop.amplificationDirection !== 'NotApplicable') {
    const dir = d.nestedLoop.amplificationDirection
    const verdict =
      dir === 'Improved' ? 'Inner repeated work improved' : dir === 'Worsened' ? 'Inner repeated work worsened' : dir === 'Mixed' ? 'Inner repeated work mixed' : 'Inner repeated work changed'
    lines.push(`${verdict}: ${d.nestedLoop.summary}.`)
  }

  return lines.slice(0, 2)
}

export function joinSideContextLineForNode(node: AnalyzedPlanNode | null | undefined): string | null {
  if (!node?.contextEvidence) return null
  const t = nodeTypeLower(node)

  if (t.includes('hash join')) {
    const hb = node.contextEvidence.hashJoin?.childHash
    if (!hb) return null
    const bits: string[] = []
    if (typeof hb.hashBatches === 'number' && hb.hashBatches > 1) bits.push(`batches ${hb.hashBatches}`)
    if (typeof hb.diskUsageKb === 'number' && hb.diskUsageKb > 0) bits.push(`disk ${hb.diskUsageKb}kB`)
    if (typeof hb.peakMemoryUsageKb === 'number' && hb.peakMemoryUsageKb > 0) bits.push(`mem ${hb.peakMemoryUsageKb}kB`)
    if (!bits.length) return null
    return `build side: ${bits.join(', ')}`
  }

  if (t === 'nested loop') {
    const waste = node.contextEvidence.nestedLoop?.innerSideScanWaste
    if (!waste) return null
    const bits: string[] = []
    if (typeof waste.rowsRemovedByFilter === 'number' && waste.rowsRemovedByFilter > 0) bits.push(`rows removed ${waste.rowsRemovedByFilter}`)
    if (typeof waste.removedRowsShareApprox === 'number' && waste.removedRowsShareApprox > 0.05) bits.push(`waste ${(waste.removedRowsShareApprox * 100).toFixed(0)}%`)
    if (!bits.length) return null
    const rel = waste.relationName ? `${waste.relationName}` : 'inner scan'
    return `inner side: ${rel} (${bits.join(', ')})`
  }

  return null
}

export function joinSideHintInline(diff: OperatorContextEvidenceDiff | null | undefined): string | null {
  if (!diff) return null
  if (diff.hashBuild?.pressureDirection && diff.hashBuild.pressureDirection !== 'NotApplicable') return `build pressure ${arrow(diff.hashBuild.pressureDirection)}`
  if (diff.nestedLoop?.innerSideWaste?.wasteDirection && diff.nestedLoop.innerSideWaste.wasteDirection !== 'NotApplicable')
    return `inner waste ${arrow(diff.nestedLoop.innerSideWaste.wasteDirection)}`
  if (diff.nestedLoop?.amplificationDirection && diff.nestedLoop.amplificationDirection !== 'NotApplicable') return `inner pressure ${arrow(diff.nestedLoop.amplificationDirection)}`
  return null
}

