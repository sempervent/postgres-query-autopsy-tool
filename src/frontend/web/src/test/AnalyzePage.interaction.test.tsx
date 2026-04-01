import { expect, test, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

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
}

vi.mock('../api/client', () => ({
  analyzePlanWithQuery: vi.fn(async () => mockAnalysis),
  exportMarkdown: vi.fn(async () => ({ analysisId: 'a1', markdown: '' })),
  exportHtml: vi.fn(async () => ({ analysisId: 'a1', html: '' })),
  exportJson: vi.fn(async () => mockAnalysis),
}))

const clipboardWrite = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  clipboardWrite.mockClear()
  Object.assign(navigator, {
    clipboard: { writeText: clipboardWrite },
  })
})

test('default selected node without workers omits worker UI', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/Plan JSON/i)[0], { target: { value: '[]' } })
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

  fireEvent.change(screen.getAllByPlaceholderText(/Plan JSON/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])

  expect(await screen.findByText(/Test finding/)).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { name: 'Findings' }).length).toBeGreaterThan(0)

  const nested = document.querySelectorAll('button button')
  expect(nested.length).toBe(0)
})

test('selected node shows Access path index insight when indexInsights match node', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/Plan JSON/i)[0], { target: { value: '[]' } })
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

  fireEvent.change(screen.getAllByPlaceholderText(/Plan JSON/i)[0], { target: { value: '[]' } })
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

test('selected node shows Buffer I/O when plan node includes buffer counters', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/Plan JSON/i)[0], { target: { value: '[]' } })
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

  fireEvent.change(screen.getAllByPlaceholderText(/Plan JSON/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])
  await screen.findByText(/Test finding/)

  const copyBtns = screen.getAllByRole('button', { name: /Copy finding reference/i })
  fireEvent.click(copyBtns[0])
  expect(clipboardWrite).toHaveBeenCalled()

  const row = screen.getAllByRole('button', { name: /Finding: Test finding/i })[0]
  expect(within(row).getByText(/Test finding/)).toBeInTheDocument()
})
