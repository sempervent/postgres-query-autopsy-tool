import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { waitForCompareAppReady } from './waitForLazyApp'
import { COMPARE_WORKSPACE_LOCAL_STORAGE_KEY } from '../compareWorkspace/compareWorkspaceStorage'

const { compareWithPlanTextsMock, getComparisonMock, prefetchPairHeavyMock } = vi.hoisted(() => ({
  compareWithPlanTextsMock: vi.fn(),
  getComparisonMock: vi.fn(),
  prefetchPairHeavyMock: vi.fn(),
}))

vi.mock('../components/compare/prefetchCompareSelectedPairHeavySections', () => ({
  prefetchCompareSelectedPairHeavySections: prefetchPairHeavyMock,
  resetComparePairHeavyPrefetchForTests: vi.fn(),
}))

function mockComparisonPayload(): any {
  const basePlan: any = {
    analysisId: 'x',
    rootNodeId: 'root',
    queryText: null,
    planInputNormalization: { kind: 'rawJson' },
    explainMetadata: { options: { format: 'json', analyze: true, verbose: true }, sourceExplainCommand: null },
    findings: [],
    narrative: { whatHappened: '', whereTimeWent: '', whatLikelyMatters: '', whatProbablyDoesNotMatter: '' },
    summary: {
      totalNodeCount: 2,
      maxDepth: 1,
      hasActualTiming: true,
      hasBuffers: true,
      plannerCosts: 'present' as const,
      topExclusiveTimeHotspotNodeIds: [],
      topInclusiveTimeHotspotNodeIds: [],
      topSharedReadHotspotNodeIds: [],
      severeFindingsCount: 0,
      warnings: [],
    },
    indexOverview: null,
    indexInsights: [],
    optimizationSuggestions: [],
  }

  return {
    comparisonId: 'cmp-1',
    planA: {
      ...basePlan,
      queryText: 'SELECT * FROM a',
      nodes: [
            { nodeId: 'a1', parentNodeId: null, childNodeIds: [], node: { nodeType: 'Hash Join' }, metrics: {} },
            { nodeId: 'a2', parentNodeId: 'a1', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} },
          ],
        },
        planB: {
          ...basePlan,
          queryText: 'SELECT * FROM b',
          planInputNormalization: { kind: 'queryPlanTable' },
          nodes: [
            { nodeId: 'b1', parentNodeId: null, childNodeIds: [], node: { nodeType: 'Hash Join' }, metrics: {} },
            {
              nodeId: 'b2',
              parentNodeId: 'b1',
              childNodeIds: [],
              node: { nodeType: 'Index Scan', relationName: 'users', indexName: 'users_pkey' },
              metrics: {},
            },
          ],
        },
        summary: {
          runtimeMsA: 100,
          runtimeMsB: 120,
          runtimeDeltaMs: 20,
          runtimeDeltaPct: 0.2,
          sharedReadBlocksA: 10,
          sharedReadBlocksB: 12,
          sharedReadDeltaBlocks: 2,
          sharedReadDeltaPct: 0.2,
          nodeCountA: 2,
          nodeCountB: 2,
          nodeCountDelta: 0,
          maxDepthA: 1,
          maxDepthB: 1,
          maxDepthDelta: 0,
          severeFindingsCountA: 0,
          severeFindingsCountB: 0,
          severeFindingsDelta: 0,
        },
        matches: [
          { nodeIdA: 'a1', nodeIdB: 'b1', matchScore: 0.9, confidence: 'High', scoreBreakdown: {} },
          { nodeIdA: 'a2', nodeIdB: 'b2', matchScore: 0.9, confidence: 'High', scoreBreakdown: {} },
        ],
        unmatchedNodeIdsA: [],
        unmatchedNodeIdsB: [],
        nodeDeltas: [],
        topWorsenedNodes: [
          {
            nodeIdA: 'a2',
            nodeIdB: 'b2',
            matchScore: 0.9,
            matchConfidence: 'High',
            nodeTypeA: 'Seq Scan',
            nodeTypeB: 'Index Scan',
            relationName: 'users',
            indexName: null,
            inclusiveTimeMs: { a: 10, b: 30, delta: 20, deltaPct: 2 },
            exclusiveTimeMsApprox: { a: 5, b: 15, delta: 10, deltaPct: 2 },
            subtreeTimeShare: { a: 0.1, b: 0.2, delta: 0.1, deltaPct: 1 },
            sharedReadBlocks: { a: 1, b: 2, delta: 1, deltaPct: 1 },
            sharedReadShare: { a: 0.1, b: 0.2, delta: 0.1, deltaPct: 1 },
            rowEstimateFactor: { a: 1, b: 1, delta: 0, deltaPct: 0 },
            actualRowsTotal: { a: 1, b: 1, delta: 0, deltaPct: 0 },
            loops: { a: 1, b: 1, delta: 0, deltaPct: 0 },
          },
        ],
        topImprovedNodes: [
          {
            nodeIdA: 'a1',
            nodeIdB: 'b1',
            matchScore: 0.8,
            matchConfidence: 'Medium',
            nodeTypeA: 'Hash Join',
            nodeTypeB: 'Hash Join',
            relationName: null,
            indexName: null,
            inclusiveTimeMs: { a: 90, b: 80, delta: -10, deltaPct: -0.11 },
            exclusiveTimeMsApprox: { a: 20, b: 10, delta: -10, deltaPct: -0.5 },
            subtreeTimeShare: { a: 0.9, b: 0.8, delta: -0.1, deltaPct: -0.11 },
            sharedReadBlocks: { a: 9, b: 8, delta: -1, deltaPct: -0.11 },
            sharedReadShare: { a: 0.9, b: 0.8, delta: -0.1, deltaPct: -0.11 },
            rowEstimateFactor: { a: 1, b: 1, delta: 0, deltaPct: 0 },
            actualRowsTotal: { a: 1, b: 1, delta: 0, deltaPct: 0 },
            loops: { a: 1, b: 1, delta: 0, deltaPct: 0 },
          },
        ],
        indexComparison: {
          overviewLines: ['Sequential scans decreased from 2 to 1.'],
          insightDiffs: [
            {
              kind: 'resolved',
              summary: 'Missing-index-style cue cleared on users',
              nodeIdA: 'a2',
              nodeIdB: 'b2',
              relatedFindingDiffIndexes: [0],
              insightDiffId: 'ii_mock_resolved',
              relatedFindingDiffIds: ['fd_mock_buf'],
            },
            {
              kind: 'new',
              summary: 'Index path still read-heavy on line_items',
              nodeIdA: null,
              nodeIdB: null,
              relatedFindingDiffIndexes: [],
              insightDiffId: 'ii_mock_new',
            },
          ],
          narrativeBullets: [],
          eitherPlanSuggestsChunkedBitmapWorkload: false,
        },
        pairDetails: [
          {
            pairArtifactId: 'pair_mock_worse',
            identity: {
              nodeIdA: 'a2',
              nodeIdB: 'b2',
              nodeTypeA: 'Seq Scan',
              nodeTypeB: 'Index Scan',
              relationNameA: 'users',
              relationNameB: 'users',
              indexNameA: null,
              indexNameB: 'users_pkey',
              joinTypeA: null,
              joinTypeB: null,
              depthA: 1,
              depthB: 1,
              matchConfidence: 'High',
              matchScore: 0.9,
              scoreBreakdown: {},
              accessPathFamilyA: 'seqScan',
              accessPathFamilyB: 'indexScan',
            },
            rawFields: {},
            metrics: [],
            findings: { findingsA: [], findingsB: [], relatedDiffItems: [] },
            contextEvidenceA: null,
            contextEvidenceB: null,
            contextDiff: null,
            indexDeltaCues: ['Access path family: Seq Scan → Index Scan', 'Improved index posture: test cue'],
            corroborationCues: ['Corroborated: seq-scan-concern (Resolved) ↔ index delta (resolved)'],
          },
          {
            pairArtifactId: 'pair_mock_join',
            identity: {
              nodeIdA: 'a1',
              nodeIdB: 'b1',
              nodeTypeA: 'Hash Join',
              nodeTypeB: 'Hash Join',
              relationNameA: null,
              relationNameB: null,
              indexNameA: null,
              indexNameB: null,
              joinTypeA: 'Hash',
              joinTypeB: 'Hash',
              depthA: 0,
              depthB: 0,
              matchConfidence: 'Medium',
              matchScore: 0.8,
              scoreBreakdown: {},
            },
            rawFields: {},
            metrics: [],
            findings: { findingsA: [], findingsB: [], relatedDiffItems: [] },
            contextEvidenceA: null,
            contextEvidenceB: null,
            contextDiff: null,
            indexDeltaCues: [],
            corroborationCues: [],
          },
        ],
        findingsDiff: {
          items: [
            {
              changeType: 'New',
              ruleId: 'buffer-read-hotspot',
              nodeIdA: 'a2',
              nodeIdB: 'b2',
              severityA: null,
              severityB: 3,
              title: 't',
              summary: 's',
              diffId: 'fd_mock_buf',
              relatedIndexDiffIndexes: [0],
              relatedIndexDiffIds: ['ii_mock_resolved'],
            },
            {
              changeType: 'New',
              ruleId: 'anchor-b-only',
              nodeIdB: 'b1',
              severityA: null,
              severityB: 1,
              title: 'only b',
              summary: 'resolved via match table',
              diffId: 'fd_mock_anchor',
            },
          ],
        },
        compareOptimizationSuggestions: [
          {
            suggestionId: 'sg_cmp_mock',
            category: 'observe_before_change',
            suggestedActionType: 'validate_with_explain_analyze',
            title: 'Compare next step mock title',
            summary: 'Validate plan B with buffers after this structural change.',
            details: '',
            rationale: 'mock',
            confidence: 'medium',
            priority: 'high',
            targetNodeIds: ['b2'],
            relatedFindingIds: [],
            relatedIndexInsightNodeIds: [],
            cautions: [],
            validationSteps: ['EXPLAIN (ANALYZE, BUFFERS).'],
            suggestionFamily: 'operational_tuning_validation',
            recommendedNextAction: 'Re-run EXPLAIN on plan B with production-like parameters.',
            whyItMatters: 'Compare suggestions should read as post-change guidance, not raw diff labels.',
            targetDisplayLabel: 'Seq Scan on users',
          },
        ],
        narrative: 'n',
        bottleneckBrief: {
          lines: ['Primary bottleneck class is unchanged (CPU / operator hotspot). Use pair timing to judge magnitude.'],
        },
        comparisonStory: {
          overview: 'Plan B is ~20ms slower than A at root inclusive time (~20% of A).',
          changeBeats: [
            {
              text: 'Largest measured shift is in mapped pair “Seq Scan on users → Seq Scan on users”—open it for deltas.',
              focusNodeIdA: 'a1',
              focusNodeIdB: 'b1',
              pairAnchorLabel: 'Seq Scan on users → Seq Scan on users',
            },
            'Both plans carry ranked bottlenecks—compare posture lines with pair deltas.',
          ],
          investigationPath: 'Start with the top worsened mapped pair to see what regressed in place.',
          structuralReading: 'Heuristic read: similar node counts with big runtime swing often mean selectivity or access-path changes.',
        },
        diagnostics: null,
  }
}

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    compareWithPlanTexts: (...a: unknown[]) => compareWithPlanTextsMock(...a) as ReturnType<typeof actual.compareWithPlanTexts>,
    getComparison: (...a: unknown[]) => getComparisonMock(...a) as ReturnType<typeof actual.getComparison>,
  }
})

const clipboardWrite = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  prefetchPairHeavyMock.mockClear()
  compareWithPlanTextsMock.mockImplementation(async () => mockComparisonPayload())
  getComparisonMock.mockImplementation(async (id: string) => ({
    ...mockComparisonPayload(),
    comparisonId: id,
  }))
  clipboardWrite.mockClear()
  try {
    localStorage.removeItem(COMPARE_WORKSPACE_LOCAL_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  Object.assign(navigator, {
    clipboard: { writeText: clipboardWrite },
  })
})

afterEach(() => {
  cleanup()
})

test('compare page is truthful (no stale MVP placeholder copy)', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  expect(screen.getByText('Compare plans')).toBeInTheDocument()
  expect(screen.queryByText(/placeholder diff summary/i)).toBeNull()
  expect(screen.queryByText(/This MVP/i)).toBeNull()
  expect(screen.getByText(/Heuristic node mapping/i)).toBeInTheDocument()
})

test(
  'compare deep link pair query restores mapped pair after compare',
  async () => {
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/compare', search: '?pair=pair_mock_join' }]}
      >
        <App />
      </MemoryRouter>,
    )
    await waitForCompareAppReady()

    fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
    fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])

    expect(await screen.findByText('Summary', undefined, { timeout: 15_000 })).toBeInTheDocument()
    await waitFor(
      () => {
        const h = screen.getByRole('heading', { name: 'Selected node pair' })
        const p = h.nextElementSibling as HTMLElement
        expect(p.textContent).toMatch(/Hash Join/)
      },
      { timeout: 15_000 },
    )
  },
  20_000,
)

test('selected pair: eager copy actions and confidence line; heavy block includes metric deltas', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])

  await screen.findByText('Summary', {}, { timeout: 15_000 })
  expect(screen.getByRole('heading', { name: 'Selected node pair' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy reference' })).toBeInTheDocument()
  expect(screen.getByText(/confidence: High · score/)).toBeInTheDocument()
  await waitFor(
    () => {
      expect(screen.getByText('Key metric deltas')).toBeInTheDocument()
    },
    { timeout: 15_000 },
  )
})

test('summary meta shows bottleneck posture when bottleneckBrief lines are present', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])

  await screen.findByText('Summary', {}, { timeout: 15_000 })
  expect(screen.getByLabelText('Change story')).toBeInTheDocument()
  expect(screen.getByText(/Plan B is ~20ms slower/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Open pair/i })).toBeInTheDocument()
  expect(screen.getByLabelText('Bottleneck posture A vs B')).toBeInTheDocument()
  expect(screen.getByText(/Primary bottleneck class is unchanged/i)).toBeInTheDocument()
})

test('compare navigator worsened row hover invokes pair heavy prefetch helper', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])

  await screen.findByText('Navigator', undefined, { timeout: 15_000 })
  const worsenedRow = screen.getByRole('button', { name: /Worsened pair:/i })
  prefetchPairHeavyMock.mockClear()
  fireEvent.mouseEnter(worsenedRow)
  expect(prefetchPairHeavyMock).toHaveBeenCalled()
})

test('compare page renders summary + what changed most and allows selecting a top change', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])

  expect(await screen.findByText('Summary')).toBeInTheDocument()
  expect(screen.getByText('What changed most')).toBeInTheDocument()

  const selectedHeading = screen.getByRole('heading', { name: 'Selected node pair' })
  const selectedPrimary = selectedHeading.nextElementSibling as HTMLElement
  expect(within(selectedPrimary).getByText(/Seq Scan on users → Index Scan on users/)).toBeInTheDocument()

  expect(screen.getByText('Index changes')).toBeInTheDocument()
  expect(screen.getByText(/Sequential scans decreased/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Access path / index delta' })).toBeInTheDocument()
  expect(screen.getByText(/Access path family: Seq Scan → Index Scan/)).toBeInTheDocument()
  expect(screen.getByText('index Δ')).toBeInTheDocument()
  expect(screen.getByText('Related index change')).toBeInTheDocument()
  expect(screen.getByText(/1 related index delta/)).toBeInTheDocument()
  expect(screen.getByText(/Supported by 1 finding change/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Finding ↔ index corroboration' })).toBeInTheDocument()
  expect(screen.getByLabelText('Compare optimization suggestions')).toBeInTheDocument()
  expect(screen.getByText('Next steps after this change')).toBeInTheDocument()
  expect(screen.getAllByText(/Compare next step mock title/).length).toBeGreaterThanOrEqual(1)
  const sug = screen.getByLabelText('Compare optimization suggestions')
  expect(within(sug).getByText(/Operational tuning & validation/i)).toBeInTheDocument()
  expect(within(sug).getByText(/Next ·/)).toBeInTheDocument()
  expect(within(sug).queryByText(/Priority: high/i)).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: /^Top improved:/i }))
  expect(within(selectedPrimary).getByText('Hash Join → Hash Join')).toBeInTheDocument()
})

test(
  'compare navigator uses ClickableRow: no nested buttons, selection syncs across navigator and findings diff',
  async () => {
    render(
      <MemoryRouter initialEntries={['/compare']}>
        <App />
      </MemoryRouter>,
    )
    await waitForCompareAppReady()

    fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
    fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])

    await screen.findByText('Navigator', undefined, { timeout: 15_000 })
    expect(document.querySelectorAll('button button').length).toBe(0)

    const worsenedRow = screen.getByRole('button', { name: /Worsened pair:/i })
    const improvedRow = screen.getByRole('button', { name: /Improved pair:/i })
    await waitFor(
      () => {
        expect(worsenedRow.getAttribute('aria-pressed')).toBe('true')
        expect(improvedRow.getAttribute('aria-pressed')).toBe('false')
      },
      { timeout: 15_000 },
    )

    const diffRow = screen.getByRole('button', { name: /Finding diff: buffer-read-hotspot/i })
    expect(diffRow.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(improvedRow)
    expect(worsenedRow.getAttribute('aria-pressed')).toBe('false')
    expect(improvedRow.getAttribute('aria-pressed')).toBe('true')
    expect(diffRow.getAttribute('aria-pressed')).toBe('false')
  },
  25_000,
)

test('navigator Copy pair reference does not change selection', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])
  await screen.findByText('Navigator')

  const worsenedRow = screen.getByRole('button', { name: /Worsened pair:/i })
  const copyBtn = within(worsenedRow).getByRole('button', { name: /Copy pair reference/i })
  await waitFor(() => expect(worsenedRow.getAttribute('aria-pressed')).toBe('true'))
  fireEvent.click(copyBtn)
  expect(clipboardWrite).toHaveBeenCalled()
  expect(worsenedRow.getAttribute('aria-pressed')).toBe('true')
})

test('branch context shows twin paths and clicking a mapped ancestor updates selection', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])

  expect(await screen.findByRole('region', { name: 'Compare branch context' })).toBeInTheDocument()
  expect(screen.getByText('Plan A — path to selected')).toBeInTheDocument()

  const hashJoinA = screen.getByRole('button', { name: /Plan A branch row: Hash Join/i })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Plan A branch row: Seq Scan on users/i }).getAttribute('aria-pressed')).toBe(
      'true',
    ),
  )

  fireEvent.click(hashJoinA)
  const selectedHeading = screen.getByRole('heading', { name: 'Selected node pair' })
  const selectedPrimary = selectedHeading.nextElementSibling as HTMLElement
  expect(within(selectedPrimary).getByText('Hash Join → Hash Join')).toBeInTheDocument()
  expect(hashJoinA.getAttribute('aria-pressed')).toBe('true')
})

test('finding diff with only Plan B anchor resolves pair and syncs selection', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])
  await screen.findByText('Findings diff')

  fireEvent.click(screen.getByRole('button', { name: /Finding diff: anchor-b-only/i }))
  const selectedHeading = screen.getByRole('heading', { name: 'Selected node pair' })
  const selectedPrimary = selectedHeading.nextElementSibling as HTMLElement
  expect(within(selectedPrimary).getByText('Hash Join → Hash Join')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Finding diff: anchor-b-only/i }).getAttribute('aria-pressed')).toBe('true')
})

test('keyboard activates navigator row selection', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])
  await screen.findByText('Navigator')

  const improvedRow = screen.getByRole('button', { name: /Improved pair:/i })
  improvedRow.focus()
  fireEvent.keyDown(improvedRow, { key: 'Enter' })

  const worsenedRow = screen.getByRole('button', { name: /Worsened pair:/i })
  expect(improvedRow.getAttribute('aria-pressed')).toBe('true')
  expect(worsenedRow.getAttribute('aria-pressed')).toBe('false')
})

test('?comparison= loads persisted comparison via getComparison', async () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/compare', search: '?comparison=reopen-cmp' }]}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  expect(await screen.findByText('Summary')).toBeInTheDocument()
  expect(getComparisonMock).toHaveBeenCalledWith('reopen-cmp')
})

test('?comparison= suggestion= legacy alias in alsoKnownAs highlights canonical suggestion row', async () => {
  getComparisonMock.mockImplementation(async (id: string) => {
    const base = mockComparisonPayload()
    return {
      ...base,
      comparisonId: id,
      compareOptimizationSuggestions: [
        {
          ...(base.compareOptimizationSuggestions ?? [])[0],
          suggestionId: 'sg_canonical',
          alsoKnownAs: ['sg_legacy_alias'],
        },
      ],
    }
  })
  render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/compare', search: '?comparison=reopen-cmp&suggestion=sg_legacy_alias' },
      ]}
    >
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  await screen.findByLabelText('Compare optimization suggestions')
  const row = document.querySelector(
    '[data-artifact="compare-suggestion"][data-artifact-id="sg_canonical"]',
  )
  expect(row).toBeTruthy()
  expect(row?.classList.contains('pqat-suggestionItem--highlight')).toBe(true)
})

test('customize workspace hides findings diff list until re-enabled', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])
  await screen.findByRole('heading', { name: 'Findings diff' })

  const cust = screen.getAllByText(/Customize workspace layout/i).find((el) => el.tagName === 'SUMMARY')
  expect(cust).toBeTruthy()
  fireEvent.click(cust!)
  const findingsToggle = await waitFor(
    () => screen.getByRole('checkbox', { name: /Show panel: findings diff/i }),
    { timeout: 15_000 },
  )
  fireEvent.click(findingsToggle)
  expect(screen.queryByRole('heading', { name: 'Findings diff' })).toBeNull()

  fireEvent.click(findingsToggle)
  expect(await screen.findByRole('heading', { name: 'Findings diff' })).toBeInTheDocument()
})

test('customize workspace Down on navigator order persists layout to localStorage', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])
  await screen.findByRole('heading', { name: 'Findings diff' })

  const customizeSummaries = screen.getAllByText(/Customize workspace layout/i).filter((n) => n.tagName === 'SUMMARY')
  expect(customizeSummaries.length).toBeGreaterThan(0)
  fireEvent.click(customizeSummaries[0])
  const navList = await screen.findByRole('list', { name: 'Compare navigator block order' })
  const downButtons = within(navList).getAllByRole('button', { name: 'Down' })
  fireEvent.click(downButtons[0])

  const raw = localStorage.getItem(COMPARE_WORKSPACE_LOCAL_STORAGE_KEY)
  expect(raw).toBeTruthy()
  const stored = JSON.parse(raw!) as { leftStackOrder: string[] }
  expect(stored.leftStackOrder[0]).toBe('findingsDiff')
})

test('Plan capture / EXPLAIN context shows per-side query and normalization', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )
  await waitForCompareAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])
  await screen.findByText('Summary')

  fireEvent.click(screen.getByText('Plan capture / EXPLAIN context (A vs B)'))
  expect(await screen.findByText('Plan A (baseline)')).toBeInTheDocument()
  expect(screen.getAllByText(/Source query: provided/).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText(/Parsed raw JSON directly/)).toBeInTheDocument()
  expect(screen.getByText(/Normalized QUERY PLAN output/)).toBeInTheDocument()
})

