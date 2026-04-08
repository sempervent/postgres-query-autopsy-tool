import type { NodePairDetail, PlanComparisonResult } from '../api/types'

/**
 * Phase 68: compact section titles for compare continuity readouts (scan vs ordering vs join rewrites).
 * Phase 69: strong ordering, bitmap/index-only, and weak ordering hedges.
 */
export function pairContinuitySectionTitle(hint: string | null | undefined): string {
  if (!hint?.trim()) return 'Same region · strategy shift'
  const h = hint.toLowerCase()
  if (h.includes('strong ordering evidence')) return 'Ordering · strong evidence'
  if (h.includes('token-level ordering link')) return 'Ordering · verify link'
  if (h.includes('index-only path') || h.includes('index only scan')) return 'Access path · index-only'
  if (h.includes('bitmap heap stack') && h.includes('direct index-backed')) return 'Access path · bitmap to index'
  if (h.includes('bitmap heap path') || (h.includes('bitmap heap') && h.includes('same relation')))
    return 'Access path · bitmap'
  if (
    h.includes('same ordering region') ||
    h.includes('explicit sort') ||
    h.includes('feeding an explicit sort') ||
    h.includes('ordering is likely')
  )
    return 'Ordering · same region'
  if (h.includes('sequential scan') && h.includes('index-backed')) return 'Access path · same relation'
  if (h.includes('nested-loop') || h.includes('hash build') || h.includes('hash join'))
    return 'Join · same tables'

  if (
    h.includes('grouped-output') ||
    h.includes('output-shaping region') ||
    h.includes('partial vs finalize') ||
    h.includes('gather-merge')
  )
    return 'Grouped / bucket output · same region'

  return 'Same region · strategy shift'
}

/** Prefer the selected pair cue; otherwise the first story beat that maps to a pair with a cue. */
export function resolveCompareContinuitySummaryCue(
  comparison: PlanComparisonResult,
  selectedDetail: NodePairDetail | null,
): string | null {
  const fromSelected = selectedDetail?.regionContinuitySummaryCue?.trim()
  if (fromSelected) return fromSelected

  const beats = comparison.comparisonStory?.changeBeats ?? []
  for (const raw of beats) {
    if (typeof raw !== 'object' || raw === null || !('focusNodeIdA' in raw)) continue
    const fa = raw.focusNodeIdA
    const fb = raw.focusNodeIdB
    if (!fa || !fb) continue
    const pd = comparison.pairDetails.find((p) => p.identity.nodeIdA === fa && p.identity.nodeIdB === fb)
    const cue = pd?.regionContinuitySummaryCue?.trim()
    if (cue) return cue
  }
  return null
}
