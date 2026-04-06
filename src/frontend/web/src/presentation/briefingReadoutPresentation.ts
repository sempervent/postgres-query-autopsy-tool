import type { AnalyzedPlanNode } from '../api/types'

/** Phase 63: backend-dense briefing line when present. */
export function operatorBriefingLine(node: AnalyzedPlanNode | null | undefined): string | null {
  const s = node?.operatorBriefingLine?.trim()
  return s || null
}

export function pairBriefingLines(
  nodeA: AnalyzedPlanNode | undefined,
  nodeB: AnalyzedPlanNode | undefined,
): { lineA: string | null; lineB: string | null } {
  return { lineA: operatorBriefingLine(nodeA), lineB: operatorBriefingLine(nodeB) }
}
