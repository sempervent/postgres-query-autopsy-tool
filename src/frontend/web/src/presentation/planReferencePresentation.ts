import type { ComparisonStoryBeat, PlanAnalysisResult, StoryPropagationBeat } from '../api/types'
import { nodeShortLabel } from './nodeLabels'

/** Normalize API beat (Phase 61 object or legacy string). */
export function normalizeStoryPropagationBeat(raw: string | StoryPropagationBeat): StoryPropagationBeat {
  if (typeof raw === 'string') return { text: raw, focusNodeId: null, anchorLabel: '' }
  return {
    text: raw.text,
    focusNodeId: raw.focusNodeId ?? null,
    anchorLabel: raw.anchorLabel ?? '',
  }
}

/** Human anchor for a node id in a plan snapshot; avoids showing raw root paths when unknown. */
export function humanNodeAnchorFromPlan(nodeId: string | null | undefined, plan: PlanAnalysisResult): string {
  if (!nodeId?.trim()) return 'this plan'
  const byId = new Map(plan.nodes.map((n) => [n.nodeId, n]))
  const n = byId.get(nodeId)
  if (n) return nodeShortLabel(n, byId)
  return /^root[.\d]*$/i.test(nodeId) ? 'an operator in this plan' : nodeId
}

export function normalizeComparisonStoryBeat(raw: string | ComparisonStoryBeat): ComparisonStoryBeat {
  if (typeof raw === 'string')
    return { text: raw, focusNodeIdA: null, focusNodeIdB: null, pairAnchorLabel: '', beatBriefing: null }
  return {
    text: raw.text,
    focusNodeIdA: raw.focusNodeIdA ?? null,
    focusNodeIdB: raw.focusNodeIdB ?? null,
    pairAnchorLabel: raw.pairAnchorLabel ?? '',
    beatBriefing: raw.beatBriefing ?? null,
  }
}
