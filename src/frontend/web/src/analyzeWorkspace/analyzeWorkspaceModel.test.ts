import { describe, expect, it } from 'vitest'
import {
  applyAnalyzeWorkspacePreset,
  coerceAnalyzeGuideSectionOrder,
  coerceAnalyzeLowerBandOrder,
  defaultAnalyzeWorkspaceLayout,
  mergeAnalyzeWorkspaceLayout,
} from './analyzeWorkspaceModel'

describe('analyzeWorkspaceModel', () => {
  it('defaults are balanced preset with all regions visible', () => {
    const d = defaultAnalyzeWorkspaceLayout()
    expect(d.preset).toBe('balanced')
    expect(d.visibility.workspace).toBe(true)
    expect(d.lowerBandOrder).toEqual(['findings', 'suggestions', 'selectedNode'])
  })

  it('merge keeps unknown keys visible and accepts partial visibility', () => {
    const m = mergeAnalyzeWorkspaceLayout({
      v: 1,
      preset: null,
      visibility: { guide: false, findings: false },
      guideSectionOrder: ['hotspots', 'selection', 'whatHappened', 'topFindings', 'nextSteps', 'sourceQuery'],
      lowerBandOrder: ['selectedNode', 'findings', 'suggestions'],
    })
    expect(m.visibility.guide).toBe(false)
    expect(m.visibility.findings).toBe(false)
    expect(m.visibility.workspace).toBe(true)
    expect(m.guideSectionOrder[0]).toBe('hotspots')
    expect(m.lowerBandOrder[0]).toBe('selectedNode')
  })

  it('focus preset hides suggestions region', () => {
    const f = applyAnalyzeWorkspacePreset('focus')
    expect(f.visibility.suggestions).toBe(false)
    expect(f.lowerBandOrder).toEqual(['findings', 'selectedNode', 'suggestions'])
  })

  it('wideGraph preset hides plan guide rail', () => {
    const w = applyAnalyzeWorkspacePreset('wideGraph')
    expect(w.visibility.guide).toBe(false)
    expect(w.visibility.workspace).toBe(true)
  })

  it('reviewer preset orders lower band findings → selected → suggestions', () => {
    const r = applyAnalyzeWorkspacePreset('reviewer')
    expect(r.lowerBandOrder).toEqual(['findings', 'selectedNode', 'suggestions'])
    expect(r.visibility.suggestions).toBe(true)
  })

  it('compact preset hides summary, guide, and suggestions', () => {
    const c = applyAnalyzeWorkspacePreset('compact')
    expect(c.visibility.summary).toBe(false)
    expect(c.visibility.guide).toBe(false)
    expect(c.visibility.suggestions).toBe(false)
  })

  it('coerceAnalyzeGuideSectionOrder rejects partial or duplicate lists', () => {
    expect(coerceAnalyzeGuideSectionOrder(['selection'])).toBeNull()
    expect(coerceAnalyzeGuideSectionOrder(['selection', 'selection', 'hotspots', 'topFindings', 'nextSteps', 'sourceQuery'])).toBeNull()
  })

  it('coerceAnalyzeLowerBandOrder rejects invalid permutations', () => {
    expect(coerceAnalyzeLowerBandOrder(['findings', 'suggestions'])).toBeNull()
  })
})
