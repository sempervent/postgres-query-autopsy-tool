import { describe, expect, it } from 'vitest'
import { comparisonStoryHasContent, planStoryDeckTitle, planStoryHasContent } from './storyPresentation'

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
})
