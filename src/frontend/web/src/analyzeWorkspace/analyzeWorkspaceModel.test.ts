import { describe, expect, it } from 'vitest'
import {
  applyAnalyzeWorkspacePreset,
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
})
