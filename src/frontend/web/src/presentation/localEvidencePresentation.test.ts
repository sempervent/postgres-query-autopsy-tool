import { describe, expect, it } from 'vitest'
import type { AnalysisFinding } from '../api/types'
import {
  ariaLabelFullWriteUpInRankedList,
  ariaLabelOpenStrongestInRankedList,
  evidenceNavCopy,
  findingConfidenceLabel,
  maxSeverityInFindings,
  severityWord,
} from './localEvidencePresentation'

function F(severity: number, id: string): AnalysisFinding {
  return {
    findingId: id,
    ruleId: 'r',
    category: 0,
    title: 't',
    summary: 's',
    explanation: 'e',
    suggestion: 'sg',
    severity,
    confidence: 1,
    nodeIds: ['n1'],
    evidence: {},
  }
}

describe('maxSeverityInFindings', () => {
  it('returns 0 for empty', () => {
    expect(maxSeverityInFindings([])).toBe(0)
  })

  it('returns max severity', () => {
    expect(maxSeverityInFindings([F(1, 'a'), F(3, 'b'), F(2, 'c')])).toBe(3)
  })
})

describe('severityWord', () => {
  it('maps known severities', () => {
    expect(severityWord(3)).toBe('High')
  })
})

describe('findingConfidenceLabel', () => {
  it('maps model confidence', () => {
    expect(findingConfidenceLabel(0)).toBe('Low')
    expect(findingConfidenceLabel(1)).toBe('Medium')
    expect(findingConfidenceLabel(2)).toBe('High')
  })
})

describe('evidence navigation copy (Phase 126)', () => {
  it('exposes stable CTA strings', () => {
    expect(evidenceNavCopy.openInRankedList).toBe('Open in ranked list')
    expect(evidenceNavCopy.openStrongestInRankedList).toBe('Open strongest in ranked list')
    expect(evidenceNavCopy.fullWriteUpInRanked).toBe('Full write-up in Ranked')
    expect(evidenceNavCopy.openStrongestWriteUpInRanked).toBe('Open strongest write-up in Ranked')
  })

  it('builds aria labels for ranked-list actions', () => {
    expect(ariaLabelFullWriteUpInRankedList('X')).toBe('Full write-up in ranked list: X')
    expect(ariaLabelOpenStrongestInRankedList('Y')).toBe('Open strongest finding in ranked list: Y')
  })
})
