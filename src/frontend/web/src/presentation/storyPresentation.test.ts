import { describe, expect, it } from 'vitest'
import {
  comparisonStoryHasContent,
  planInspectFirstSteps,
  planStoryDeckTitle,
  planStoryHasContent,
} from './storyPresentation'

describe('storyPresentation', () => {
  it('detects plan story content', () => {
    expect(planStoryHasContent(null)).toBe(false)
    expect(planStoryHasContent({ planOverview: 'x', workConcentration: '', likelyExpenseDrivers: '', executionShape: '', inspectFirstPath: '', propagationBeats: [], indexShapeNote: '' })).toBe(true)
  })

  it('detects comparison story content', () => {
    expect(comparisonStoryHasContent(null)).toBe(false)
    expect(comparisonStoryHasContent({ overview: 'delta', changeBeats: [], investigationPath: '', structuralReading: '' })).toBe(true)
  })

  it('uses narrative-first deck title', () => {
    expect(planStoryDeckTitle()).toBe('Plan briefing')
  })

  it('planInspectFirstSteps prefers structured rows when present', () => {
    expect(
      planInspectFirstSteps({
        planOverview: 'x',
        workConcentration: '',
        likelyExpenseDrivers: '',
        executionShape: '',
        inspectFirstPath: 'legacy',
        inspectFirstSteps: [{ stepNumber: 1, title: 'Anchor', body: 'Do this' }],
        propagationBeats: [],
        indexShapeNote: '',
      }),
    ).toHaveLength(1)
  })

  it('planInspectFirstSteps is empty when steps are absent', () => {
    expect(
      planInspectFirstSteps({
        planOverview: 'x',
        workConcentration: '',
        likelyExpenseDrivers: '',
        executionShape: '',
        inspectFirstPath: 'only legacy',
        propagationBeats: [],
        indexShapeNote: '',
      }),
    ).toHaveLength(0)
  })
})
