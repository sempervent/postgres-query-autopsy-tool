import { describe, expect, it } from 'vitest'
import {
  ANALYZE_RANKED_BAND_RESTORED_HINT,
  analyzeRankedPivotThreadLabel,
} from './analyzeRankedContinuityCopy'

describe('analyzeRankedContinuityCopy', () => {
  it('keeps in-session pivot thread calm', () => {
    expect(analyzeRankedPivotThreadLabel('session')).toBe('Continues from plan')
  })

  it('marks graph-pivot thread when the analysis was restored from a link', () => {
    expect(analyzeRankedPivotThreadLabel('link')).toBe('Continues from plan — reopened')
  })

  it('exposes a stable band hint for the non-pivot restored band', () => {
    expect(ANALYZE_RANKED_BAND_RESTORED_HINT).toBe('Ranked — reopened')
  })
})
