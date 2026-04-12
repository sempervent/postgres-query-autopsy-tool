/**
 * DOM semantics for Analyze “preview vs ranked” evidence (Phase 128).
 * Ranked finding rows remain the canonical `data-finding-id` + `role="button"` surface.
 */

/** Plan-band preview list items only — never use on ranked `ClickableRow`. */
export const PQAT_PREVIEW_FINDING_ID_ATTR = 'data-pqat-preview-finding-id' as const

/** Resolve the ranked finding row inside the Ranked panel (ignores preview shelf nodes). */
export function queryRankedFindingRow(root: ParentNode, findingId: string): HTMLElement | null {
  try {
    const row = root.querySelector(`[data-finding-id="${CSS.escape(findingId)}"][role="button"]`)
    if (row instanceof HTMLElement) return row
  } catch {
    const row = root.querySelector(`[data-finding-id="${findingId.replace(/"/g, '')}"][role="button"]`)
    if (row instanceof HTMLElement) return row
  }
  return null
}
