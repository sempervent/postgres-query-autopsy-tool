import { afterEach, expect, test, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { waitForAnalyzeAppReady } from './waitForLazyApp'
import { AnalysisNotFoundError, analyzePlanWithQuery, PlanParseError } from '../api/client'
import { ANALYZE_WORKSPACE_LOCAL_STORAGE_KEY } from '../analyzeWorkspace/analyzeWorkspaceStorage'
import '../components/analyze/AnalyzeOptimizationSuggestionsPanel'

const { getAnalysisMock, fetchAppConfigMock } = vi.hoisted(() => ({
  getAnalysisMock: vi.fn(),
  fetchAppConfigMock: vi.fn(),
}))

const mockAnalysis = {
  analysisId: 'a1',
  rootNodeId: 'n0',
  queryText: null as string | null,
  nodes: [
    {
      nodeId: 'n0',
      parentNodeId: null as string | null,
      childNodeIds: ['n1'],
      node: { nodeType: 'Hash Join' },
      metrics: {},
    },
    {
      nodeId: 'n1',
      parentNodeId: 'n0',
      childNodeIds: [] as string[],
      node: {
        nodeType: 'Parallel Seq Scan',
        relationName: 'users',
        sharedHitBlocks: 5000,
        sharedReadBlocks: 120000,
        workers: [
          {
            workerNumber: 0,
            actualTotalTimeMs: 50,
            actualRows: 500000,
            sharedHitBlocks: 2500,
            sharedReadBlocks: 60000,
            tempReadBlocks: null,
            tempWrittenBlocks: null,
          },
          {
            workerNumber: 1,
            actualTotalTimeMs: 55,
            actualRows: 500000,
            sharedHitBlocks: 2500,
            sharedReadBlocks: 60000,
          },
        ],
      },
      metrics: {
        exclusiveActualTimeMsApprox: 50,
        subtreeTimeShare: 0.5,
        bufferShareOfPlan: 0.1,
      },
    },
  ],
  findings: [
    {
      findingId: 'f1',
      ruleId: 'test-rule',
      severity: 2,
      confidence: 1,
      category: 0,
      title: 'Test finding',
      summary: 'summary text',
      explanation: 'expl',
      evidence: {},
      suggestion: 'sug',
      nodeIds: ['n1'],
    },
  ],
  narrative: {
    whatHappened: 'what',
    whereTimeWent: 'where',
    whatLikelyMatters: 'matters',
    whatProbablyDoesNotMatter: 'not',
  },
  summary: {
    totalNodeCount: 2,
    maxDepth: 1,
    hasActualTiming: true,
    hasBuffers: true,
    plannerCosts: 'present' as const,
    rootInclusiveActualTimeMs: 100,
    topExclusiveTimeHotspotNodeIds: ['n1'],
    topInclusiveTimeHotspotNodeIds: [] as string[],
    topSharedReadHotspotNodeIds: ['n1'],
    severeFindingsCount: 0,
    warnings: [] as string[],
  },
  indexOverview: {
    seqScanCount: 1,
    indexScanCount: 0,
    indexOnlyScanCount: 0,
    bitmapHeapScanCount: 0,
    bitmapIndexScanCount: 0,
    hasAppendOperator: false,
    suggestsChunkedBitmapWorkload: false,
    chunkedWorkloadNote: null,
  },
  indexInsights: [
    {
      nodeId: 'n1',
      accessPathFamily: 'seqScan',
      nodeType: 'Parallel Seq Scan',
      relationName: 'users',
      indexName: null,
      signalKinds: ['missingIndexInvestigation'],
      headline: 'Seq Scan on `users` — filter/index investigation may be warranted',
      facts: {},
    },
  ],
  explainMetadata: {
    options: { format: 'json', analyze: true, verbose: true, buffers: true, costs: true },
    sourceExplainCommand: null,
  },
  planInputNormalization: { kind: 'rawJson' as const, detail: null },
  optimizationSuggestions: [
    {
      suggestionId: 'sg_test_1',
      category: 'index_experiment',
      suggestedActionType: 'create_index_candidate',
      title: 'Mock optimization suggestion title',
      summary: 'Mock summary for UI test — validate with EXPLAIN.',
      details: 'detail',
      rationale: 'rationale',
      confidence: 'medium',
      priority: 'high',
      targetNodeIds: ['n1'],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: ['caution line'],
      validationSteps: ['Run EXPLAIN (ANALYZE, BUFFERS).'],
      suggestionFamily: 'index_experiments',
      recommendedNextAction: 'Prototype a btree aligned with filters on users.',
      whyItMatters: 'Seq scans on large relations deserve a measured index experiment.',
      targetDisplayLabel: 'Parallel Seq Scan on users',
    },
  ],
}

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    fetchAppConfig: (...args: unknown[]) => fetchAppConfigMock(...args) as ReturnType<typeof actual.fetchAppConfig>,
    analyzePlanWithQuery: vi.fn(async () => mockAnalysis),
    getAnalysis: (...args: unknown[]) => getAnalysisMock(...args) as Promise<typeof mockAnalysis>,
    exportMarkdown: vi.fn(async () => ({ analysisId: 'a1', markdown: '' })),
    exportHtml: vi.fn(async () => ({ analysisId: 'a1', html: '' })),
    exportJson: vi.fn(async () => mockAnalysis),
  }
})

const clipboardWrite = vi.fn().mockResolvedValue(undefined)

const defaultAppConfig = {
  authEnabled: false,
  authMode: 'None',
  authIdentityKind: 'none',
  authHelp: '',
  requireIdentityForWrites: false,
  defaultAccessScope: 'link',
  rateLimitingEnabled: false,
  storage: { databasePath: 'data/autopsy.db' },
}

beforeEach(() => {
  try {
    localStorage.removeItem(ANALYZE_WORKSPACE_LOCAL_STORAGE_KEY)
  } catch {
    /* jsdom / restricted storage */
  }
  clipboardWrite.mockClear()
  fetchAppConfigMock.mockResolvedValue(defaultAppConfig)
  getAnalysisMock.mockImplementation(async (id: string) => ({ ...mockAnalysis, analysisId: id }))
  Object.assign(navigator, {
    clipboard: { writeText: clipboardWrite },
  })
})

afterEach(() => {
  cleanup()
  vi.mocked(analyzePlanWithQuery).mockImplementation(async () => mockAnalysis)
})

test(
  'default selected node without workers omits worker UI',
  async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await waitForAnalyzeAppReady()

    fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
    expect(await screen.findByRole('button', { name: 'Finding: Test finding' }, { timeout: 15_000 })).toBeInTheDocument()

    expect(screen.queryByLabelText('Parallel workers')).toBeNull()
    expect(screen.queryByLabelText('Worker summary')).toBeNull()
  },
  20_000,
)

test('Analyze findings and hotspots do not nest buttons (valid HTML)', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])

  expect(await screen.findByRole('button', { name: 'Finding: Test finding' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { name: 'Findings' }).length).toBeGreaterThan(0)

  const nested = document.querySelectorAll('button button')
  expect(nested.length).toBe(0)
})

test('selected node shows related optimization suggestion when targeted', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByLabelText('Optimization suggestions')

  fireEvent.click(screen.getByRole('button', { name: 'Finding: Test finding' }))
  expect(await screen.findByLabelText('Related optimization suggestion')).toBeInTheDocument()
})

test('selected node shows Access path index insight when indexInsights match node', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByRole('button', { name: 'Finding: Test finding' })

  fireEvent.click(screen.getByRole('button', { name: 'Finding: Test finding' }))
  expect(await screen.findByLabelText('Access path index insight')).toBeInTheDocument()
  expect(screen.getByText(/Access path:.*Seq Scan.*users/i)).toBeInTheDocument()
})

test('selected node with workers shows worker summary cue and Workers grid', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByRole('button', { name: 'Finding: Test finding' })

  fireEvent.click(screen.getByRole('button', { name: 'Finding: Test finding' }))

  expect(await screen.findByLabelText('Worker summary')).toHaveTextContent(/Workers: 2/)
  fireEvent.click(screen.getByText('Parallel workers'))
  const grid = screen.getByLabelText('Parallel workers')
  expect(within(grid).getByText('Total time')).toBeInTheDocument()
  expect(within(grid).getByText('50ms')).toBeInTheDocument()
  expect(within(grid).getByText('55ms')).toBeInTheDocument()
})

test('optimization suggestions section shows title category and node jump', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  const optSection = await screen.findByLabelText('Optimization suggestions')
  expect(within(optSection).getByText(/Mock optimization suggestion title/)).toBeInTheDocument()

  expect(screen.getByLabelText('Optimization suggestions')).toBeInTheDocument()
  expect(within(optSection).getByText(/Index experiments/i)).toBeInTheDocument()
  expect(within(optSection).getByText(/Medium confidence/i)).toBeInTheDocument()
  expect(within(optSection).queryByText(/Confidence: medium/i)).toBeNull()
  expect(within(optSection).getByText(/Try next/i)).toBeInTheDocument()
  expect(within(optSection).getByRole('button', { name: /Focus Parallel Seq Scan on users/i })).toBeInTheDocument()
})

test('selected node shows Buffer I/O when plan node includes buffer counters', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByRole('button', { name: 'Finding: Test finding' })

  fireEvent.click(screen.getByRole('button', { name: 'Finding: Test finding' }))
  expect(await screen.findByText('Buffer I/O')).toBeInTheDocument()
  expect(screen.getByText(/Shared read blocks:/)).toBeInTheDocument()
  expect(screen.getByText(/Shared hit blocks:/)).toBeInTheDocument()
})

test('finding Copy uses clipboard without triggering row navigation side effects', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByRole('button', { name: 'Finding: Test finding' })

  const copyBtns = screen.getAllByRole('button', { name: /Copy finding reference/i })
  fireEvent.click(copyBtns[0])
  expect(clipboardWrite).toHaveBeenCalled()

  const row = screen.getByRole('button', { name: 'Finding: Test finding' })
  expect(within(row).getByText(/Test finding/)).toBeInTheDocument()
})

test('deep link ?node= selects that node after analyze (before URL sync overwrite)', async () => {
  render(
    <MemoryRouter initialEntries={['/?node=n1']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  expect(await screen.findByRole('button', { name: 'Finding: Test finding' })).toBeInTheDocument()

  await waitFor(() => {
    expect(screen.getAllByRole('button', { name: /Copy share link/i }).length).toBeGreaterThan(0)
  })
  fireEvent.click(screen.getAllByRole('button', { name: /Copy share link/i })[0])
  expect(clipboardWrite).toHaveBeenCalled()
  const arg = clipboardWrite.mock.calls.at(-1)?.[0] as string
  expect(arg).toContain('node=n1')
  expect(arg).toMatch(/analysis=a1\b/)
})

test('?analysis= loads persisted analysis via getAnalysis', async () => {
  render(
    <MemoryRouter initialEntries={['/?analysis=persisted99']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  await screen.findByRole('button', { name: 'Finding: Test finding' })
  expect(getAnalysisMock).toHaveBeenCalledWith('persisted99')
})

test('invalid ?analysis= shows a clear error', async () => {
  getAnalysisMock.mockRejectedValueOnce(new AnalysisNotFoundError('badid'))
  render(
    <MemoryRouter initialEntries={['/?analysis=badid']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  expect(await screen.findByText(/No stored analysis/i)).toBeInTheDocument()
})

test('normalization status shows after analyze when API returns planInputNormalization', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  expect(await screen.findByLabelText('Plan input normalization')).toHaveTextContent(/Parsed raw JSON directly/)
})

test('PlanParseError surfaces message and hint without stack trace', async () => {
  vi.mocked(analyzePlanWithQuery).mockRejectedValueOnce(new PlanParseError('Could not rebuild JSON.', 'Try copying the cell directly.'))
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: 'x' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  const err = await screen.findByText(/Error:/i)
  expect(err.parentElement?.textContent).toContain('Could not rebuild JSON.')
  expect(err.parentElement?.textContent).toContain('Try copying the cell directly.')
})

test('Plan source / EXPLAIN metadata section shows planner cost line', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByLabelText('Plan source and EXPLAIN metadata')
  expect(screen.getByText(/Planner costs:/i)).toBeInTheDocument()
})

test('suggested EXPLAIN copy uses clipboard', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  const sourceSql = screen
    .getAllByRole('textbox')
    .find((el) => (el as HTMLTextAreaElement).placeholder.includes('SELECT ...'))
  expect(sourceSql).toBeTruthy()
  fireEvent.change(sourceSql!, { target: { value: 'SELECT 1' } })
  fireEvent.click(screen.getByText('Suggested EXPLAIN command (copy-paste)'))
  const btn = await screen.findByRole('button', { name: /Copy suggested EXPLAIN/i })
  fireEvent.click(btn)
  expect(clipboardWrite).toHaveBeenCalled()
  expect(String(clipboardWrite.mock.calls.at(-1)?.[0])).toContain('EXPLAIN (')
})

test('auth mode shows Copy artifact link (private) when artifactAccess is private', async () => {
  fetchAppConfigMock.mockResolvedValueOnce({
    authEnabled: true,
    authMode: 'BearerSubject',
    authIdentityKind: 'legacy_bearer',
    authHelp: 'Legacy bearer mode.',
    requireIdentityForWrites: true,
    defaultAccessScope: 'private',
    rateLimitingEnabled: false,
    storage: { databasePath: 'data/autopsy.db' },
  })
  vi.mocked(analyzePlanWithQuery).mockResolvedValueOnce({
    ...mockAnalysis,
    artifactAccess: {
      ownerUserId: 'u1',
      accessScope: 'private',
      sharedGroupIds: [],
      allowLinkAccess: false,
    },
  })
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByRole('button', { name: 'Finding: Test finding' })
  expect(screen.getAllByRole('button', { name: /Copy artifact link \(private\)/i }).length).toBeGreaterThan(0)
})

test(
  'plan workspace: text mode hides React Flow; graph mode shows canvas',
  async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await waitForAnalyzeAppReady()

    fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
    await screen.findByLabelText('Analyze workspace', {}, { timeout: 15_000 })

    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    expect(document.querySelector('.react-flow')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Graph' }))
    await waitFor(
      () => {
        expect(document.querySelector('.react-flow')).not.toBeNull()
      },
      { timeout: 15_000 },
    )
  },
  25_000,
)

test('customize workspace Down on guide order persists layout to localStorage', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  await waitForAnalyzeAppReady()

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByRole('button', { name: 'Finding: Test finding' }, { timeout: 15_000 })

  const customizeSummaries = screen.getAllByText('Customize workspace').filter((n) => n.tagName === 'SUMMARY')
  expect(customizeSummaries.length).toBeGreaterThan(0)
  fireEvent.click(customizeSummaries[0])
  const guideList = await screen.findByRole('list', { name: 'Plan guide section order' }, { timeout: 15_000 })
  const downButtons = within(guideList).getAllByRole('button', { name: 'Down' })
  fireEvent.click(downButtons[0])

  const raw = localStorage.getItem(ANALYZE_WORKSPACE_LOCAL_STORAGE_KEY)
  expect(raw).toBeTruthy()
  const stored = JSON.parse(raw!) as { guideSectionOrder: string[] }
  expect(stored.guideSectionOrder[0]).toBe('whatHappened')
})
