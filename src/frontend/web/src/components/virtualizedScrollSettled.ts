/**
 * Deterministic "scroll settled" scheduling for windowed lists (Phase 129).
 * Used by VirtualizedListColumn after scrollToIndex so callers can focus rows safely.
 */

export type VirtualItemsSlice = ReadonlyArray<{ index: number }>

/**
 * Waits until `getVirtualItems()` includes `targetIndex`, then runs `onSettled` after two rAFs (paint).
 * If `maxFrames` elapses without the index appearing, still invokes `onSettled` (bounded fallback).
 * @returns cancel function
 */
export function scheduleVirtualScrollSettled(
  getVirtualItems: () => VirtualItemsSlice,
  targetIndex: number,
  onSettled: () => void,
  options?: { maxFrames?: number },
): () => void {
  let frames = 0
  const maxFrames = options?.maxFrames ?? 36
  let cancelled = false

  const tick = () => {
    if (cancelled) return
    frames++
    const vis = getVirtualItems()
    if (vis.some((v) => v.index === targetIndex)) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) onSettled()
        })
      })
      return
    }
    if (frames < maxFrames) requestAnimationFrame(tick)
    else requestAnimationFrame(() => {
      if (!cancelled) onSettled()
    })
  }

  requestAnimationFrame(tick)
  return () => {
    cancelled = true
  }
}
