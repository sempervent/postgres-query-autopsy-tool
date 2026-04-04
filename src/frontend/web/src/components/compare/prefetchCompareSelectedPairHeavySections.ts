/**
 * Warm the lazy chunk for extended pair detail (metrics, evidence, findings for the pair).
 * Safe to call repeatedly; reuses a single in-flight import promise. Mirrors `prefetchAnalyzePlanGraph` intent.
 */
let prefetchPromise: Promise<unknown> | null = null

export function prefetchCompareSelectedPairHeavySections(): void {
  if (typeof window === 'undefined') return
  prefetchPromise ??= import('./CompareSelectedPairHeavySections')
  void prefetchPromise
}

/** Tests only: allow a fresh prefetch. */
export function resetComparePairHeavyPrefetchForTests(): void {
  prefetchPromise = null
}
