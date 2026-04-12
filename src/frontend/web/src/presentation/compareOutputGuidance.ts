import type { FindingDiffItem, NodePairDetail, PlanComparisonResult } from '../api/types'
import { resolveFindingDiffPair } from './compareBranchContext'
import { compareContinuityCueIsSpecific } from './compareContinuityCueSpecificity'
import { normalizeComparisonStoryBeat } from './planReferencePresentation'

export { compareContinuityCueIsSpecific }

export type CompareLeadTakeaway = {
  headline: string
  line: string
}

export type CompareDiffScanSignal = {
  title: string
  diffId?: string
}

function clipOneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function changeTypeRank(changeType: string): number {
  const t = (changeType || '').toLowerCase()
  if (t === 'new') return 5
  if (t === 'worsened') return 4
  if (t === 'improved') return 3
  if (t === 'unchanged') return 2
  if (t === 'resolved') return 1
  return 0
}

function sortFindingDiffsForScan(items: FindingDiffItem[]) {
  return [...items].sort((a, b) => {
    const dr = changeTypeRank(String(b.changeType)) - changeTypeRank(String(a.changeType))
    if (dr !== 0) return dr
    return (b.severityB ?? 0) - (a.severityB ?? 0)
  })
}

/** Top finding-diff rows for a compact “also scan” strip (after the lead takeaway). */
export function compareFollowUpDiffSignals(comparison: PlanComparisonResult, limit = 2): CompareDiffScanSignal[] {
  const raw = comparison.findingsDiff?.items ?? []
  if (!raw.length) return []
  return sortFindingDiffsForScan(raw)
    .slice(0, limit)
    .map((i) => ({
      title: clipOneLine(i.title, 100),
      diffId: i.diffId?.trim() || undefined,
    }))
}

/** Compact lead from the API change story; avoids duplicating the full deck. */
export function compareLeadTakeaway(comparison: PlanComparisonResult): CompareLeadTakeaway | null {
  const overview = comparison.comparisonStory?.overview?.trim()
  if (!overview) return null
  return {
    headline: 'Change at a glance',
    line: overview,
  }
}

export type CompareTriagePins = {
  highlightFindingDiffId: string | null
  highlightIndexInsightDiffId: string | null
  highlightSuggestionId: string | null
}

/**
 * One-line bridge from summary / pins / navigator emphasis → selected pair (Phase 110).
 * Avoids repeating the full change briefing.
 */
export function compareTriagePairBridgeLine(
  comparison: PlanComparisonResult,
  selectedDetail: NodePairDetail | null,
  pins: CompareTriagePins,
): string | null {
  if (!selectedDetail) return null
  const id = selectedDetail.identity

  if (pins.highlightFindingDiffId) {
    const item = comparison.findingsDiff?.items?.find((i) => i.diffId === pins.highlightFindingDiffId)
    if (item) {
      const r = resolveFindingDiffPair(item, comparison.matches ?? [])
      if (r && r.a === id.nodeIdA && r.b === id.nodeIdB) {
        return `Same pair as the highlighted finding change: ${clipOneLine(item.title, 72)}`
      }
    }
  }

  if (pins.highlightIndexInsightDiffId) {
    const ii = comparison.indexComparison?.insightDiffs?.find((x) => x.insightDiffId === pins.highlightIndexInsightDiffId)
    if (ii) {
      const pairMatch = ii.nodeIdA === id.nodeIdA && ii.nodeIdB === id.nodeIdB
      const bMatch = ii.nodeIdB === id.nodeIdB
      if (pairMatch || bMatch) {
        return 'Plan B matches the index row you highlighted above.'
      }
    }
  }

  if (pins.highlightSuggestionId) {
    const sid = pins.highlightSuggestionId
    for (const s of comparison.compareOptimizationSuggestions ?? []) {
      const match = s.suggestionId === sid || (s.alsoKnownAs ?? []).includes(sid)
      if (match && (s.targetNodeIds ?? []).includes(id.nodeIdB)) {
        return 'Highlighted next step targets this pair’s Plan B node.'
      }
    }
  }

  const beats = comparison.comparisonStory?.changeBeats ?? []
  for (const raw of beats) {
    const b = normalizeComparisonStoryBeat(raw)
    if (
      b.focusNodeIdA &&
      b.focusNodeIdB &&
      b.focusNodeIdA === id.nodeIdA &&
      b.focusNodeIdB === id.nodeIdB
    ) {
      return 'Same pair you opened from the change story under Start here.'
    }
  }

  const w0 = comparison.topWorsenedNodes?.[0]
  if (w0 && w0.nodeIdA === id.nodeIdA && w0.nodeIdB === id.nodeIdB) {
    return 'This is the top worsened pair—where the comparison ranks the largest regression.'
  }
  const i0 = comparison.topImprovedNodes?.[0]
  if (i0 && i0.nodeIdA === id.nodeIdA && i0.nodeIdB === id.nodeIdB) {
    return 'This is the top improved pair in the navigator ranking.'
  }

  return null
}

/**
 * When the pair bridge is empty, show a compact fallback without repeating a vague chip (Phase 113).
 */
export function resolveComparePairFallbackDisplay(
  triageBridgeLine: string | null | undefined,
  continuitySummaryCue: string | null | undefined,
): { label: string; body: string } | null {
  if (triageBridgeLine?.trim()) return null
  const cue = continuitySummaryCue?.trim()
  if (!cue) return null
  if (compareContinuityCueIsSpecific(cue)) return { label: 'Reading thread', body: cue }
  return null
}
