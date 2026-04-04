import { describe, expect, it } from 'vitest'
import { bottleneckCauseHintLine, bottleneckClassShortLabel } from './bottleneckPresentation'

describe('bottleneckPresentation', () => {
  it('maps bottleneckClass API strings to short labels', () => {
    expect(bottleneckClassShortLabel('sortOrSpillPressure')).toMatch(/sort/i)
    expect(bottleneckClassShortLabel('joinAmplification')).toMatch(/join/i)
  })

  it('maps causeHint to guidance lines', () => {
    expect(bottleneckCauseHintLine('primaryFocus')).toMatch(/inspect here first/i)
    expect(bottleneckCauseHintLine('downstreamSymptom')).toMatch(/upstream/i)
  })
})
