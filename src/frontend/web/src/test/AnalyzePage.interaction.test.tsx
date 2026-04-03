import { afterEach, expect, test, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AnalysisNotFoundError, analyzePlanWithQuery, PlanParseError } from '../api/client'

const { getAnalysisMock } = vi.hoisted(() => ({
  getAnalysisMock: vi.fn(),
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
    },
  ],
}

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    analyzePlanWithQuery: vi.fn(async () => mockAnalysis),
    getAnalysis: (...args: unknown[]) => getAnalysisMock(...args) as Promise<typeof mockAnalysis>,
    exportMarkdown: vi.fn(async () => ({ analysisId: 'a1', markdown: '' })),
    exportHtml: vi.fn(async () => ({ analysisId: 'a1', html: '' })),
    exportJson: vi.fn(async () => mockAnalysis),
  }
})

const clipboardWrite = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  clipboardWrite.mockClear()
  getAnalysisMock.mockImplementation(async (id: string) => ({ ...mockAnalysis, analysisId: id }))
  Object.assign(navigator, {
    clipboard: { writeText: clipboardWrite },
  })
})

afterEach(() => {
  cleanup()
  vi.mocked(analyzePlanWithQuery).mockImplementation(async () => mockAnalysis)
})

test('default selected node without workers omits worker UI', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByText(/Test finding/)

  expect(screen.queryByLabelText('Parallel workers')).toBeNull()
  expect(screen.queryByLabelText('Worker summary')).toBeNull()
})

test('Analyze findings and hotspots do not nest buttons (valid HTML)', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])

  expect(await screen.findByText(/Test finding/)).toBeInTheDocument()
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

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByText(/Mock optimization suggestion title/)

  fireEvent.click(screen.getAllByRole('button', { name: /Finding: Test finding/i })[0])
  expect(await screen.findByLabelText('Related optimization suggestion')).toBeInTheDocument()
})

test('selected node shows Access path index insight when indexInsights match node', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByText(/Test finding/)

  fireEvent.click(screen.getAllByRole('button', { name: /Finding: Test finding/i })[0])
  expect(await screen.findByLabelText('Access path index insight')).toBeInTheDocument()
  expect(screen.getByText(/Access path:.*Seq Scan.*users/i)).toBeInTheDocument()
})

test('selected node with workers shows worker summary cue and Workers grid', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByText(/Test finding/)

  fireEvent.click(screen.getAllByRole('button', { name: /Finding: Test finding/i })[0])

  expect(await screen.findByLabelText('Worker summary')).toHaveTextContent(/Workers: 2/)
  expect(screen.getByText('Workers')).toBeInTheDocument()
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

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByText(/Mock optimization suggestion title/)

  expect(screen.getByLabelText('Optimization suggestions')).toBeInTheDocument()
  expect(screen.getByText(/Index experiment/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Show node n1/i })).toBeInTheDocument()
})

test('selected node shows Buffer I/O when plan node includes buffer counters', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByText(/Test finding/)

  fireEvent.click(screen.getAllByRole('button', { name: /Finding: Test finding/i })[0])
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

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByText(/Test finding/)

  const copyBtns = screen.getAllByRole('button', { name: /Copy finding reference/i })
  fireEvent.click(copyBtns[0])
  expect(clipboardWrite).toHaveBeenCalled()

  const row = screen.getAllByRole('button', { name: /Finding: Test finding/i })[0]
  expect(within(row).getByText(/Test finding/)).toBeInTheDocument()
})

test('deep link ?node= selects that node after analyze (before URL sync overwrite)', async () => {
  render(
    <MemoryRouter initialEntries={['/?node=n1']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/QUERY PLAN cell/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  expect((await screen.findAllByText(/Test finding/)).length).toBeGreaterThan(0)

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

  await screen.findByText(/Test finding/)
  expect(getAnalysisMock).toHaveBeenCalledWith('persisted99')
})

test('invalid ?analysis= shows a clear error', async () => {
  getAnalysisMock.mockRejectedValueOnce(new AnalysisNotFoundError('badid'))
  render(
    <MemoryRouter initialEntries={['/?analysis=badid']}>
      <App />
    </MemoryRouter>,
  )

  expect(await screen.findByText(/No stored analysis/i)).toBeInTheDocument()
})

test('normalization status shows after analyze when API returns planInputNormalization', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

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
