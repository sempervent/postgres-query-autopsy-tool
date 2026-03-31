import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

vi.mock('../api/client', () => {
  return {
    comparePlansWithDiagnostics: vi.fn(async () => {
      const basePlan: any = {
        analysisId: 'x',
        rootNodeId: 'root',
        queryText: null,
        findings: [],
        narrative: { whatHappened: '', whereTimeWent: '', whatLikelyMatters: '', whatProbablyDoesNotMatter: '' },
        summary: {
          totalNodeCount: 2,
          maxDepth: 1,
          hasActualTiming: true,
          hasBuffers: true,
          topExclusiveTimeHotspotNodeIds: [],
          topInclusiveTimeHotspotNodeIds: [],
          topSharedReadHotspotNodeIds: [],
          severeFindingsCount: 0,
          warnings: [],
        },
      }

      return {
        comparisonId: 'cmp-1',
        planA: {
          ...basePlan,
          nodes: [
            { nodeId: 'a1', parentNodeId: null, childNodeIds: [], node: { nodeType: 'Hash Join' }, metrics: {} },
            { nodeId: 'a2', parentNodeId: 'a1', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} },
          ],
        },
        planB: {
          ...basePlan,
          nodes: [
            { nodeId: 'b1', parentNodeId: null, childNodeIds: [], node: { nodeType: 'Hash Join' }, metrics: {} },
            { nodeId: 'b2', parentNodeId: 'b1', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} },
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
            nodeTypeB: 'Seq Scan',
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
        pairDetails: [
          {
            identity: {
              nodeIdA: 'a2',
              nodeIdB: 'b2',
              nodeTypeA: 'Seq Scan',
              nodeTypeB: 'Seq Scan',
              relationNameA: 'users',
              relationNameB: 'users',
              indexNameA: null,
              indexNameB: null,
              joinTypeA: null,
              joinTypeB: null,
              depthA: 1,
              depthB: 1,
              matchConfidence: 'High',
              matchScore: 0.9,
              scoreBreakdown: {},
            },
            rawFields: {},
            metrics: [],
            findings: { findingsA: [], findingsB: [], relatedDiffItems: [] },
            contextEvidenceA: null,
            contextEvidenceB: null,
            contextDiff: null,
          },
          {
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
          },
        ],
        findingsDiff: {
          items: [
            { changeType: 'New', ruleId: 'buffer-read-hotspot', nodeIdB: 'b2', severityA: null, severityB: 3, title: 't', summary: 's' },
          ],
        },
        narrative: 'n',
        diagnostics: null,
      }
    }),
  }
})

test('compare page is truthful (no stale MVP placeholder copy)', () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )

  expect(screen.getByText('Compare plans')).toBeInTheDocument()
  expect(screen.queryByText(/placeholder diff summary/i)).toBeNull()
  expect(screen.queryByText(/This MVP/i)).toBeNull()
  expect(screen.getByText(/Heuristic node mapping/i)).toBeInTheDocument()
})

test('compare page renders summary + what changed most and allows selecting a top change', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getAllByPlaceholderText(/Plan A/i)[0], { target: { value: '[]' } })
  fireEvent.change(screen.getAllByPlaceholderText(/Plan B/i)[0], { target: { value: '[]' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0])

  expect(await screen.findByText('Summary')).toBeInTheDocument()
  expect(screen.getByText('What changed most')).toBeInTheDocument()

  const selected = screen.getByText('Selected node pair').closest('div')!
  expect(within(selected).getByText(/Seq Scan on users/i)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Top improved/i }))
  expect(within(selected).getByText('Hash Join → Hash Join')).toBeInTheDocument()
})

