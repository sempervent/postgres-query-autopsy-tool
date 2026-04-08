import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { OptimizationSuggestion, PlanAnalysisResult, PlanComparisonResult } from '../../api/types'
import { CompareNextStepsList } from './CompareNextStepsList'

vi.mock('./prefetchCompareSelectedPairHeavySections', () => ({
  prefetchCompareSelectedPairHeavySections: vi.fn(),
}))

function minimalPlan(overrides: Partial<PlanAnalysisResult> = {}): PlanAnalysisResult {
  return {
    analysisId: 'a',
    rootNodeId: 'r',
    nodes: [],
    findings: [],
    narrative: { whatHappened: '', whereTimeWent: '', whatLikelyMatters: '', whatProbablyDoesNotMatter: '' },
    summary: {
      totalNodeCount: 0,
      maxDepth: 0,
      hasActualTiming: false,
      hasBuffers: false,
      plannerCosts: 'unknown',
      topExclusiveTimeHotspotNodeIds: [],
      topInclusiveTimeHotspotNodeIds: [],
      topSharedReadHotspotNodeIds: [],
      severeFindingsCount: 0,
      warnings: [],
    },
    ...overrides,
  }
}

function suggestion(id: string, title: string): OptimizationSuggestion {
  return {
    suggestionId: id,
    category: 'c',
    suggestedActionType: 't',
    title,
    summary: 'sum',
    details: '',
    rationale: '',
    confidence: 'Medium',
    priority: 'High',
    targetNodeIds: [],
    relatedFindingIds: [],
    relatedIndexInsightNodeIds: [],
    cautions: [],
    validationSteps: [],
  }
}

function minimalComparison(): PlanComparisonResult {
  return {
    comparisonId: 'cmp',
    planA: minimalPlan({ analysisId: 'pa' }),
    planB: minimalPlan({ analysisId: 'pb' }),
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
  }
}

describe('CompareNextStepsList', () => {
  it('Home and End move focus between Pin controls', () => {
    const top = [suggestion('s1', 'One'), suggestion('s2', 'Two'), suggestion('s3', 'Three')]
    const copy = { copy: vi.fn(), status: null as string | null }

    render(
      <CompareNextStepsList
        comparison={minimalComparison()}
        compareOptimizationTop={top}
        selectedPlanBNodeId={null}
        selectedPairArtifactId={null}
        highlightSuggestionId={null}
        setHighlightFindingDiffId={vi.fn()}
        setHighlightIndexInsightDiffId={vi.fn()}
        setHighlightSuggestionId={vi.fn()}
        setSelectedPair={vi.fn()}
        copyCompareSuggestion={copy as any}
      />,
    )

    const pins = screen.getAllByRole('button', { name: /Pin “/ })
    expect(pins).toHaveLength(3)

    pins[1]!.focus()
    expect(document.activeElement).toBe(pins[1])

    fireEvent.keyDown(pins[1]!, { key: 'Home' })
    expect(document.activeElement).toBe(pins[0])

    fireEvent.keyDown(pins[0]!, { key: 'End' })
    expect(document.activeElement).toBe(pins[2])
  })
})
