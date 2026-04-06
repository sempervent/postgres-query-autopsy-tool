import { describe, expect, it } from 'vitest'
import { operatorBriefingLine, pairBriefingLines } from './briefingReadoutPresentation'
import type { AnalyzedPlanNode } from '../api/types'

describe('briefingReadoutPresentation', () => {
  it('returns null when briefing absent', () => {
    expect(operatorBriefingLine(null)).toBeNull()
    expect(operatorBriefingLine({} as AnalyzedPlanNode)).toBeNull()
  })

  it('returns trimmed briefing when set', () => {
    const n = { operatorBriefingLine: '  x  ' } as AnalyzedPlanNode
    expect(operatorBriefingLine(n)).toBe('x')
  })

  it('pairBriefingLines reads both sides', () => {
    const a = { operatorBriefingLine: 'A' } as AnalyzedPlanNode
    const b = { operatorBriefingLine: 'B' } as AnalyzedPlanNode
    expect(pairBriefingLines(a, b)).toEqual({ lineA: 'A', lineB: 'B' })
  })
})
