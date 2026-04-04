import { afterEach, describe, expect, it } from 'vitest'
import {
  prefetchCompareSelectedPairHeavySections,
  resetComparePairHeavyPrefetchForTests,
} from './prefetchCompareSelectedPairHeavySections'

describe('prefetchCompareSelectedPairHeavySections', () => {
  afterEach(() => {
    resetComparePairHeavyPrefetchForTests()
  })

  it('is safe to call repeatedly (single coalesced dynamic import)', () => {
    expect(() => {
      prefetchCompareSelectedPairHeavySections()
      prefetchCompareSelectedPairHeavySections()
    }).not.toThrow()
  })
})
