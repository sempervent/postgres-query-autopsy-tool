import { describe, expect, it } from 'vitest'
import {
  humanNodeAnchorFromPlan,
  normalizeComparisonStoryBeat,
  normalizeStoryPropagationBeat,
} from './planReferencePresentation'
import type { PlanAnalysisResult } from '../api/types'

describe('planReferencePresentation', () => {
  it('normalizes legacy string propagation beats', () => {
    expect(normalizeStoryPropagationBeat('hello')).toEqual({
      text: 'hello',
      focusNodeId: null,
      anchorLabel: '',
    })
  })

  it('normalizes structured propagation beats', () => {
    expect(
      normalizeStoryPropagationBeat({
        text: 'Because → likely: x',
        focusNodeId: 'root.0.1',
        anchorLabel: 'Sort on t by id',
      }),
    ).toMatchObject({
      text: 'Because → likely: x',
      focusNodeId: 'root.0.1',
      anchorLabel: 'Sort on t by id',
    })
  })

  it('normalizes comparison beats', () => {
    expect(normalizeComparisonStoryBeat('plain')).toEqual({
      text: 'plain',
      focusNodeIdA: null,
      focusNodeIdB: null,
      pairAnchorLabel: '',
      beatBriefing: null,
    })
    expect(
      normalizeComparisonStoryBeat({
        text: 'x',
        focusNodeIdA: 'a',
        focusNodeIdB: 'b',
        pairAnchorLabel: 'p',
        beatBriefing: 'Brief on B',
      }),
    ).toMatchObject({ beatBriefing: 'Brief on B' })
  })

  it('humanNodeAnchorFromPlan avoids raw root paths for unknown ids', () => {
    const plan = {
      nodes: [
        {
          nodeId: 'root.0',
          parentNodeId: null,
          childNodeIds: [],
          node: { nodeType: 'Seq Scan', relationName: 'users' },
          metrics: {},
        },
      ],
    } as unknown as PlanAnalysisResult
    expect(humanNodeAnchorFromPlan('root.0', plan)).toContain('users')
    expect(humanNodeAnchorFromPlan('root.9.9', plan)).toBe('an operator in this plan')
  })
})
