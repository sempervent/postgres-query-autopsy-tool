import { describe, expect, it } from 'vitest'
import type { NodePairDetail, PlanComparisonResult } from '../api/types'
import { pairContinuitySectionTitle, resolveCompareContinuitySummaryCue } from './compareContinuityPresentation'

describe('pairContinuitySectionTitle', () => {
  it('classifies access-path continuity', () => {
    expect(
      pairContinuitySectionTitle(
        'Same relation (t): plan A used a broad sequential scan; plan B uses a narrower index-backed path',
      ),
    ).toBe('Access path · same relation')
  })

  it('classifies ordering continuity', () => {
    expect(
      pairContinuitySectionTitle(
        'Same relation (t): plan A used a broad sequential scan feeding an explicit sort step; plan B reads',
      ),
    ).toBe('Ordering · same region')
  })

  it('falls back for unknown hint shapes', () => {
    expect(pairContinuitySectionTitle('Some other continuity text')).toBe('Same region · strategy shift')
  })

  it('classifies strong ordering hint titles', () => {
    expect(pairContinuitySectionTitle('Strong ordering evidence: same ordering region on t')).toBe('Ordering · strong evidence')
  })

  it('classifies grouped-output continuity titles', () => {
    expect(
      pairContinuitySectionTitle('Same grouped-output region: plan A uses a gather-merge stack'),
    ).toBe('Grouped output · same region')
  })
})

describe('resolveCompareContinuitySummaryCue', () => {
  const minimalComparison = {
    comparisonId: 'c',
    pairDetails: [
      {
        identity: { nodeIdA: 'a1', nodeIdB: 'b1' },
        regionContinuitySummaryCue: 'From story beat',
      },
    ],
    comparisonStory: {
      changeBeats: [
        {
          text: 'beat',
          focusNodeIdA: 'a1',
          focusNodeIdB: 'b1',
          pairAnchorLabel: 'x',
        },
      ],
    },
  } as unknown as PlanComparisonResult

  it('prefers selected pair cue over story beat', () => {
    const selected = {
      identity: { nodeIdA: 'x', nodeIdB: 'y' },
      regionContinuitySummaryCue: 'Selected cue',
    } as unknown as NodePairDetail
    const cmp = {
      ...minimalComparison,
      pairDetails: [
        ...minimalComparison.pairDetails,
        { identity: { nodeIdA: 'x', nodeIdB: 'y' }, regionContinuitySummaryCue: 'Selected cue' },
      ],
    } as unknown as PlanComparisonResult
    expect(resolveCompareContinuitySummaryCue(cmp, selected)).toBe('Selected cue')
  })

  it('falls back to first beat-mapped pair cue', () => {
    expect(resolveCompareContinuitySummaryCue(minimalComparison, null)).toBe('From story beat')
  })
})
