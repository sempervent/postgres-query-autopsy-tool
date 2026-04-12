import { describe, expect, it } from 'vitest'
import type { AnalysisFinding } from '../api/types'
import { rankedFindingsForNode, topRankedFindingForNode } from './analyzeFindingPivot'

function F(partial: Partial<AnalysisFinding> & { findingId: string }): AnalysisFinding {
  return {
    findingId: partial.findingId,
    ruleId: partial.ruleId ?? 'r',
    category: partial.category ?? 0,
    title: partial.title ?? 't',
    summary: partial.summary ?? 's',
    explanation: partial.explanation ?? 'e',
    suggestion: partial.suggestion ?? 'sg',
    severity: partial.severity ?? 1,
    confidence: partial.confidence ?? 1,
    nodeIds: partial.nodeIds ?? ['n1'],
    evidence: partial.evidence ?? ({} as Record<string, unknown>),
  }
}

describe('topRankedFindingForNode', () => {
  it('returns null when no finding cites the node', () => {
    expect(topRankedFindingForNode([F({ findingId: 'a', nodeIds: ['x'] })], 'y')).toBeNull()
  })

  it('prefers higher severity', () => {
    const low = F({ findingId: 'low', nodeIds: ['n'], severity: 1 })
    const high = F({ findingId: 'high', nodeIds: ['n'], severity: 3 })
    expect(topRankedFindingForNode([low, high], 'n')?.findingId).toBe('high')
  })
})

describe('rankedFindingsForNode', () => {
  it('returns all citing findings sorted by severity then confidence', () => {
    const a = F({ findingId: 'a', nodeIds: ['n'], severity: 1, confidence: 2 })
    const b = F({ findingId: 'b', nodeIds: ['n'], severity: 3, confidence: 0 })
    const c = F({ findingId: 'c', nodeIds: ['n'], severity: 3, confidence: 2 })
    const ranked = rankedFindingsForNode([a, b, c], 'n')
    expect(ranked.map((x) => x.findingId)).toEqual(['c', 'b', 'a'])
  })
})
