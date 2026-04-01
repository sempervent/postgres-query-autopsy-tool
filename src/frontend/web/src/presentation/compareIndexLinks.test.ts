import { describe, expect, test } from 'vitest'
import { findingRuleTail, relatedFindingChangesCue, relatedFindingRuleHints, relatedIndexDeltaCue } from './compareIndexLinks'
import type { PlanComparisonResult } from '../api/types'

describe('compareIndexLinks', () => {
  test('findingRuleTail strips rule prefix', () => {
    expect(findingRuleTail('F.seq-scan-concern')).toBe('seq-scan-concern')
  })

  test('related cues pluralize', () => {
    expect(relatedIndexDeltaCue(1)).toContain('1 related')
    expect(relatedIndexDeltaCue(2)).toContain('2 related')
    expect(relatedFindingChangesCue(1)).toContain('1 finding')
  })

  test('relatedFindingRuleHints resolves indices', () => {
    const c = {
      findingsDiff: {
        items: [{ ruleId: 'F.seq-scan-concern' }, { ruleId: 'R.index-access-still-heavy' }],
      },
    } as PlanComparisonResult
    expect(relatedFindingRuleHints(c, [1])).toEqual(['index-access-still-heavy'])
  })
})
