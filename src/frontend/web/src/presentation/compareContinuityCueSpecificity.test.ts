import { describe, expect, it } from 'vitest'
import {
  COMPARE_CONTINUITY_CUE_CLASSIFICATION_FIXTURES,
  compareContinuityCueIsSpecific,
} from './compareContinuityCueSpecificity'

describe('compareContinuityCueIsSpecific fixtures', () => {
  it('matches golden classification table', () => {
    for (const row of COMPARE_CONTINUITY_CUE_CLASSIFICATION_FIXTURES) {
      expect(compareContinuityCueIsSpecific(row.cue), row.note).toBe(row.specific)
    }
  })
})

describe('compareContinuityCueIsSpecific edge cases', () => {
  it('treats whitespace-only as non-specific', () => {
    expect(compareContinuityCueIsSpecific('   \t  ')).toBe(false)
  })
})
