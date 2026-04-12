import { describe, expect, it } from 'vitest'
import { buildGraphNodeIssueSummary, firstWhyClause } from './graphNodeIssueSummaryPresentation'
import type { AnalysisFinding } from '../api/types'

function F(partial: Partial<AnalysisFinding> & { findingId: string }): AnalysisFinding {
  return {
    findingId: partial.findingId,
    ruleId: partial.ruleId ?? 'r',
    category: partial.category ?? 0,
    title: partial.title ?? 't',
    summary: partial.summary ?? 's',
    explanation: partial.explanation ?? 'e',
    suggestion: partial.suggestion ?? 'sg',
    severity: partial.severity ?? 2,
    confidence: partial.confidence ?? 1,
    nodeIds: partial.nodeIds ?? ['n1'],
    evidence: partial.evidence ?? {},
  }
}

describe('firstWhyClause', () => {
  it('prefers first sentence when reasonable', () => {
    expect(firstWhyClause('Heavy seq scan on hot path. Consider index.')).toBe('Heavy seq scan on hot path.')
  })

  it('truncates long single span', () => {
    const long = 'x'.repeat(200)
    expect(firstWhyClause(long).length).toBeLessThanOrEqual(151)
  })
})

describe('buildGraphNodeIssueSummary', () => {
  it('returns null for empty list', () => {
    expect(buildGraphNodeIssueSummary([])).toBeNull()
  })

  it('uses strongest finding fields', () => {
    const out = buildGraphNodeIssueSummary([
      F({
        findingId: 'a',
        title: 'Seq scan dominates cost',
        severity: 3,
        summary: 'Most time is spent reading heap pages. Index may help.',
      }),
    ])
    expect(out?.severity).toBe(3)
    expect(out?.problemTitle).toContain('Seq scan')
    expect(out?.whyMatters.length).toBeGreaterThan(10)
    expect(out?.inspectNextLine).toMatch(/Selected node|Ranked/i)
  })
})
