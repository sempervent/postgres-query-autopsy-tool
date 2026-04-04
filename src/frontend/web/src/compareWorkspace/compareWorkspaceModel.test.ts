import { describe, expect, test } from 'vitest'
import {
  applyCompareWorkspacePreset,
  coerceCompareLeftStackOrder,
  coerceCompareSummarySectionOrder,
  defaultCompareWorkspaceLayout,
  mergeCompareWorkspaceLayout,
} from './compareWorkspaceModel'

describe('compareWorkspaceModel', () => {
  test('default layout enables all regions', () => {
    const d = defaultCompareWorkspaceLayout()
    expect(Object.values(d.visibility).every(Boolean)).toBe(true)
    expect(d.mainColumnOrder).toEqual(['navigator', 'pair'])
  })

  test('review preset puts pair column first', () => {
    const r = applyCompareWorkspacePreset('review')
    expect(r.mainColumnOrder).toEqual(['pair', 'navigator'])
    expect(r.visibility.intro).toBe(false)
  })

  test('diffHeavy preset orders findings diff before worsened block in left stack', () => {
    const d = applyCompareWorkspacePreset('diffHeavy')
    expect(d.leftStackOrder[0]).toBe('findingsDiff')
  })

  test('merge applies boolean visibility overrides', () => {
    const m = mergeCompareWorkspaceLayout({
      v: 1,
      visibility: { findingsDiff: false, intro: false },
    })
    expect(m.visibility.findingsDiff).toBe(false)
    expect(m.visibility.intro).toBe(false)
    expect(m.visibility.input).toBe(true)
  })

  test('merge rejects invalid summary section order', () => {
    const m = mergeCompareWorkspaceLayout({
      summarySectionOrder: ['summaryCards', 'summaryMeta'],
    })
    expect(m.summarySectionOrder).toEqual(defaultCompareWorkspaceLayout().summarySectionOrder)
  })

  test('wideGraph preset favors pair column and hides intro', () => {
    const w = applyCompareWorkspacePreset('wideGraph')
    expect(w.visibility.intro).toBe(false)
    expect(w.mainColumnOrder).toEqual(['pair', 'navigator'])
  })

  test('coerceCompareSummarySectionOrder rejects partial lists', () => {
    expect(coerceCompareSummarySectionOrder(['summaryCards'])).toBeNull()
  })

  test('coerceCompareLeftStackOrder rejects invalid permutations', () => {
    expect(coerceCompareLeftStackOrder(['findingsDiff', 'findingsDiff', 'unmatchedNodes'])).toBeNull()
  })
})
