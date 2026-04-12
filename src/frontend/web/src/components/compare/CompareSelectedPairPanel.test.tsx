import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { NodePairDetail, PlanAnalysisResult, PlanComparisonResult } from '../../api/types'
import { CompareSelectedPairPanel } from './CompareSelectedPairPanel'

vi.mock('./CompareSelectedPairHeavySections', () => {
  const Comp = () => <div data-testid="pair-heavy-stub" />
  return { CompareSelectedPairHeavySections: Comp, default: Comp }
})

afterEach(() => cleanup())

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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId={null}
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
        pairHandoffKind="navigator"
      />,
    )

    expect(screen.getByLabelText('Rewrite outcome for this pair')).toBeInTheDocument()
    expect(screen.getByText('Rewrite outcome')).toBeInTheDocument()
    expect(screen.getByText(/Pair inclusive time improved here/i)).toBeInTheDocument()
  })

  it('shows compare-pinned-summary when a highlight pin is active', () => {
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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId="fd_x"
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
      />,
    )

    expect(screen.getByTestId('compare-pinned-summary')).toHaveTextContent(/Link includes: finding fd_x/)
    expect(screen.getByTestId('compare-copy-pin-context')).toBeInTheDocument()
  })

  it('shows triage bridge when triageBridgeLine is provided', () => {
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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId={null}
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
        triageBridgeLine="This is the top worsened pair—where the comparison ranks the largest regression."
        pairHandoffKind="summary"
      />,
    )

    expect(screen.getByTestId('compare-visual-pair-continuation-contract')).toHaveTextContent(/From the summary/)
    expect(screen.getByTestId('compare-selected-pair-triage-bridge')).toHaveTextContent(/top worsened pair/i)
  })

  it('shows summary handoff as reopened when origin is a saved link', () => {
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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId={null}
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
        triageBridgeLine="This is the top worsened pair—where the comparison ranks the largest regression."
        pairHandoffKind="summary"
        pairHandoffOrigin="link"
      />,
    )

    expect(screen.getByTestId('compare-pair-handoff-hint')).toHaveTextContent(/Summary — reopened/)
    expect(screen.getByTestId('compare-pair-handoff-hint')).toHaveAttribute('data-pqat-handoff-origin', 'link')
  })

  it('shows briefing handoff as reopened when origin is a saved link', () => {
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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId={null}
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
        continuityPairFallback={{ label: 'Reading thread', body: 'Cue body for briefing.' }}
        pairHandoffKind="briefing"
        pairHandoffOrigin="link"
      />,
    )
    expect(screen.getByTestId('compare-pair-handoff-hint')).toHaveTextContent(/Briefing — reopened/)
  })

  it('shows pinned handoff as reopened when origin is a saved link', () => {
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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId="fd_x"
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
        pairHandoffKind="pinned"
        pairHandoffOrigin="link"
      />,
    )
    expect(screen.getByTestId('compare-pair-handoff-hint')).toHaveTextContent(/Pinned — reopened/)
  })

  it('shows navigator handoff as reopened when origin is a saved link', () => {
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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId={null}
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
        pairHandoffKind="navigator"
        pairHandoffOrigin="link"
      />,
    )
    expect(screen.getByTestId('compare-pair-handoff-hint')).toHaveTextContent(/From the lists — reopened/)
  })

  it('shows continuity fallback when bridge is absent but fallback line is provided', () => {
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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId={null}
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
        continuityPairFallback={{
          label: 'Reading thread',
          body: 'Narrower access path on Plan B for this region.',
        }}
        pairHandoffKind="briefing"
      />,
    )

    expect(screen.getByTestId('compare-visual-pair-continuation-contract')).toHaveTextContent(/From the briefing/)
    expect(screen.queryByTestId('compare-selected-pair-triage-bridge')).not.toBeInTheDocument()
    expect(screen.getByTestId('compare-selected-pair-continuity-fallback')).toHaveTextContent(/Narrower access path/i)
  })

  it('exposes continuation region labeling without duplicating handoff on the heading', () => {
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
        copyPinContext={{ copy: async () => {}, status: null }}
        highlightFindingDiffId={null}
        highlightIndexInsightDiffId={null}
        highlightSuggestionId={null}
        compareOptForPair={null}
        pairSubtitle={() => null}
        pairHandoffKind="navigator"
        pairHandoffOrigin="session"
      />,
    )

    const region = screen.getByTestId('compare-visual-pair-continuation-contract')
    expect(region).toHaveAttribute('role', 'region')
    expect(region.getAttribute('aria-labelledby')).toContain('compare-selected-pair-heading')

    const hint = screen.getByTestId('compare-pair-handoff-hint')
    expect(region.getAttribute('aria-describedby')).toBe(hint.id)
    expect(hint).toHaveTextContent(/From the lists/)

    const h2 = screen.getByRole('heading', { name: 'Selected node pair' })
    expect(h2).not.toHaveAttribute('aria-describedby')
    expect(hint).toHaveAttribute('data-pqat-handoff-origin', 'session')
  })
})
