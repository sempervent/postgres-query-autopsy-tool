/** Move item at index `from` to index `to` (0-based, clamped). */
export function moveIndex<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= arr.length) return [...arr]
  const next = [...arr]
  const [item] = next.splice(from, 1)
  const clamped = Math.max(0, Math.min(to, next.length))
  next.splice(clamped, 0, item)
  return next
}

export { swapWithNeighbor } from '../workspaceLayout/reorder'
