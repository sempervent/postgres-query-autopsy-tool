import { describe, expect, it } from 'vitest'
import type { PlanComparisonResult } from '../api/types'
import { parseCompareUrlPinAndPairState } from './compareDeepLinkSync'

function minimalComparison(overrides: Partial<PlanComparisonResult> = {}): PlanComparisonResult {
  return {
    comparisonId: 'cmp-x',
    planA: {} as PlanComparisonResult['planA'],
    planB: {} as PlanComparisonResult['planB'],
    summary: {
      sharedReadBlocksA: 0,
      sharedReadBlocksB: 0,
      sharedReadDeltaBlocks: 0,
      nodeCountA: 1,
      nodeCountB: 1,
      nodeCountDelta: 0,
      maxDepthA: 0,
      maxDepthB: 0,
      maxDepthDelta: 0,
      severeFindingsCountA: 0,
      severeFindingsCountB: 0,
      severeFindingsDelta: 0,
    },
    matches: [],
    unmatchedNodeIdsA: [],
    unmatchedNodeIdsB: [],
    nodeDeltas: [],
    topImprovedNodes: [],
    topWorsenedNodes: [],
    pairDetails: [],
    findingsDiff: { items: [] },
    narrative: '',
    ...overrides,
  }
}

describe('parseCompareUrlPinAndPairState', () => {
  it('returns null ids for unknown finding / index / suggestion params', () => {
    const c = minimalComparison({
      findingsDiff: { items: [{ diffId: 'fd_ok', changeType: 'New' } as any] },
      indexComparison: { insightDiffs: [{ insightDiffId: 'ii_ok' } as any], overviewLines: [], narrativeBullets: [], eitherPlanSuggestsChunkedBitmapWorkload: false },
    })
    const r = parseCompareUrlPinAndPairState(c, '?finding=fd_bad&indexDiff=ii_bad')
    expect(r.findingDiffId).toBeNull()
    expect(r.indexInsightDiffId).toBeNull()
    expect(r.suggestionId).toBeNull()
    expect(r.pairSelection).toBeNull()
  })

  it('resolves valid finding, index, suggestion, and pair from search', () => {
    const c = minimalComparison({
      findingsDiff: { items: [{ diffId: 'fd_1', changeType: 'New' } as any] },
      indexComparison: {
        insightDiffs: [{ insightDiffId: 'ii_1' } as any],
        overviewLines: [],
        narrativeBullets: [],
        eitherPlanSuggestsChunkedBitmapWorkload: false,
      },
      compareOptimizationSuggestions: [
        { suggestionId: 'sg_1', title: 't', summary: '', details: '', rationale: '', category: 'c', suggestedActionType: 'x', confidence: 'Medium', priority: 'High', targetNodeIds: [], relatedFindingIds: [], relatedIndexInsightNodeIds: [], cautions: [], validationSteps: [] },
      ],
      pairDetails: [
        {
          pairArtifactId: 'pair_abc',
          identity: { nodeIdA: 'a1', nodeIdB: 'b1' } as any,
          rawFields: {} as any,
          metrics: [],
          findings: {} as any,
        },
      ],
    })
    const rOnlyIndex = parseCompareUrlPinAndPairState(c, '?indexDiff=ii_1&pair=pair_abc')
    expect(rOnlyIndex.findingDiffId).toBeNull()
    expect(rOnlyIndex.indexInsightDiffId).toBe('ii_1')
    expect(rOnlyIndex.suggestionId).toBeNull()
    expect(rOnlyIndex.pairSelection).toEqual({ a: 'a1', b: 'b1' })

    const rFindingWins = parseCompareUrlPinAndPairState(
      c,
      '?finding=fd_1&indexDiff=ii_1&suggestion=sg_1&pair=pair_abc',
    )
    expect(rFindingWins.findingDiffId).toBe('fd_1')
    expect(rFindingWins.indexInsightDiffId).toBeNull()
    expect(rFindingWins.suggestionId).toBeNull()
  })
})
