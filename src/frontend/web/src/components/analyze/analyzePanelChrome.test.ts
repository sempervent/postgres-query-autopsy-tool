import { describe, expect, it } from 'vitest'
import { companionRailSurfaceStacked, companionRailSurfaceStyle } from './analyzePanelChrome'

describe('companionRailSurfaceStyle', () => {
  it('besideWorkspace stretches and contains scroll in the rail body (no short max-height cap)', () => {
    const s = companionRailSurfaceStyle('besideWorkspace')
    expect(s.maxHeight).toBe('none')
    expect(s.height).toBe('100%')
    expect(s.overflow).toBe('hidden')
    expect(s.display).toBe('flex')
  })

  it('stacked keeps bounded scroll for narrow layout', () => {
    const s = companionRailSurfaceStyle('stacked')
    expect(s).toEqual(companionRailSurfaceStacked)
  })
})
