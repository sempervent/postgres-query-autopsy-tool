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
      node: { nodeType: 'Seq Scan', relationName: 'users' },
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

test('Analyze findings and hotspots do not nest buttons (valid HTML)', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/Plan JSON/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: /Analyze/i })[0])

  expect(await screen.findByText('Findings')).toBeInTheDocument()
  expect(await screen.findByText(/Test finding/)).toBeInTheDocument()

  const nested = document.querySelectorAll('button button')
  expect(nested.length).toBe(0)
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
