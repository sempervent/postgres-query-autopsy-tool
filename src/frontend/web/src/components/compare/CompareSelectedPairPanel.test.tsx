import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { NodePairDetail, PlanAnalysisResult, PlanComparisonResult } from '../../api/types'
import { CompareSelectedPairPanel } from './CompareSelectedPairPanel'

vi.mock('./CompareSelectedPairHeavySections', () => {
  const Comp = () => <div data-testid="pair-heavy-stub" />
  return { CompareSelectedPairHeavySections: Comp, default: Comp }
})

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

function minimalComparison(): PlanComparisonResult {
  return {
    comparisonId: 'c1',
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

describe('CompareSelectedPairPanel', () => {
  it('shows rewrite verdict readout when rewriteVerdictOneLiner is set', () => {
    const selectedDetail: NodePairDetail = {
      pairArtifactId: 'pair_1',
      identity: {
        nodeIdA: 'a',
        nodeIdB: 'b',
        nodeTypeA: 'Seq Scan',
        nodeTypeB: 'Seq Scan',
        depthA: 0,
        depthB: 0,
        matchConfidence: 'High',
        matchScore: 1,
        scoreBreakdown: {},
      },
      rawFields: {},
      metrics: [],
      findings: { findingsA: [], findingsB: [], relatedDiffItems: [] },
      indexDeltaCues: [],
      corroborationCues: [],
      rewriteVerdictOneLiner: 'Pair inclusive time improved here.',
    }

    render(
      <CompareSelectedPairPanel
        comparison={minimalComparison()}
        pathname="/compare"
        selectedDetail={selectedDetail}
        byIdA={new Map()}
        byIdB={new Map()}
        copyPair={{ copy: async () => {}, status: null }}
        copyDeepLink={{ copy: async () => {}, status: null }}
        highlightFindingDiffId={null}
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
      />,
    )

    expect(screen.getByLabelText('Rewrite outcome for this pair')).toBeInTheDocument()
    expect(screen.getByText('Rewrite outcome')).toBeInTheDocument()
    expect(screen.getByText(/Pair inclusive time improved here/i)).toBeInTheDocument()
  })
})
