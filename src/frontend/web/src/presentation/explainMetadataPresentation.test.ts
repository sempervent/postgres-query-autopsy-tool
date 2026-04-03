import { describe, expect, test } from 'vitest'
import { formatDeclaredExplainOptionsLine, plannerCostsLabel } from './explainMetadataPresentation'

describe('plannerCostsLabel', () => {
  test('maps API values to readable strings', () => {
    expect(plannerCostsLabel('present')).toMatch(/present/)
    expect(plannerCostsLabel('notDetected')).toMatch(/not detected/i)
  })
})

describe('formatDeclaredExplainOptionsLine', () => {
  test('formats flags', () => {
    const line = formatDeclaredExplainOptionsLine({
      options: { format: 'json', analyze: true, costs: false },
    })
    expect(line).toContain('FORMAT json')
    expect(line).toContain('ANALYZE')
    expect(line).toContain('COSTS off')
  })
})
