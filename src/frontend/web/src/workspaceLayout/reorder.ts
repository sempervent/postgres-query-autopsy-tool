/** Shared Up/Down panel reordering for Analyze / Compare workspaces (Phase 40–41). */
export function swapWithNeighbor<T>(arr: T[], index: number, direction: -1 | 1): T[] {
  const j = index + direction
  if (j < 0 || j >= arr.length) return [...arr]
  const next = [...arr]
  ;[next[index], next[j]] = [next[j], next[index]]
  return next
}
