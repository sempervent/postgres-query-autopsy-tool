import { describe, expect, it } from 'vitest'
import { compareSuggestionsByPriority, optimizationCategoryLabel } from './optimizationSuggestionsPresentation'

describe('optimizationSuggestionsPresentation', () => {
  it('maps known categories to readable labels', () => {
    expect(optimizationCategoryLabel('timescaledb_workload')).toContain('Timescale')
    expect(optimizationCategoryLabel('index_experiment')).toContain('Index')
  })

  it('sorts by priority', () => {
    const a = { priority: 'low' }
    const b = { priority: 'high' }
    expect(compareSuggestionsByPriority(a, b)).toBeGreaterThan(0)
  })
})
