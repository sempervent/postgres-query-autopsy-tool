/** Pure helpers for Compare pin / roving-keyboard behavior (Phase 96). */

/** Advance position in a bounded list of focusable indices (no wrap). */
export function nextRovingOrdinal(ordinal: number, delta: number, length: number): number {
  if (length <= 0) return 0
  const n = ordinal + delta
  if (n < 0) return 0
  if (n >= length) return length - 1
  return n
}
