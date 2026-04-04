import { describe, expect, it } from 'vitest'
import { normalizeComparisonStoryBeat, normalizeStoryPropagationBeat } from './planReferencePresentation'

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
    })
  })
})
