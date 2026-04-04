import type { ComparisonStoryBeat, StoryPropagationBeat } from '../api/types'

/** Normalize API beat (Phase 61 object or legacy string). */
export function normalizeStoryPropagationBeat(raw: string | StoryPropagationBeat): StoryPropagationBeat {
  if (typeof raw === 'string') return { text: raw, focusNodeId: null, anchorLabel: '' }
  return {
    text: raw.text,
    focusNodeId: raw.focusNodeId ?? null,
    anchorLabel: raw.anchorLabel ?? '',
  }
}

export function normalizeComparisonStoryBeat(raw: string | ComparisonStoryBeat): ComparisonStoryBeat {
  if (typeof raw === 'string') return { text: raw, focusNodeIdA: null, focusNodeIdB: null, pairAnchorLabel: '' }
  return {
    text: raw.text,
    focusNodeIdA: raw.focusNodeIdA ?? null,
    focusNodeIdB: raw.focusNodeIdB ?? null,
    pairAnchorLabel: raw.pairAnchorLabel ?? '',
  }
}
