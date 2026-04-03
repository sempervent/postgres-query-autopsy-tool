import { describe, expect, test } from 'vitest'
import {
  buildCompareBranchViewModel,
  buildMatchLookup,
  resolveFindingDiffPair,
} from './compareBranchContext'
import type { PlanComparisonResult } from '../api/types'

function minimalComparison(): PlanComparisonResult {
  const basePlan = {
    analysisId: 'a',
    rootNodeId: 'root',
    queryText: null,
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
  }

  return {
    comparisonId: 'c1',
    planA: {
      ...basePlan,
      nodes: [
        { nodeId: 'root', parentNodeId: null, childNodeIds: ['a1'], node: { nodeType: 'Limit' }, metrics: {} },
        { nodeId: 'a1', parentNodeId: 'root', childNodeIds: ['a2'], node: { nodeType: 'Hash Join' }, metrics: {} },
        {
          nodeId: 'a2',
          parentNodeId: 'a1',
          childNodeIds: [],
          node: { nodeType: 'Seq Scan', relationName: 'users' },
          metrics: {},
        },
      ],
    },
    planB: {
      ...basePlan,
      nodes: [
        { nodeId: 'root', parentNodeId: null, childNodeIds: ['b1'], node: { nodeType: 'Limit' }, metrics: {} },
        { nodeId: 'b1', parentNodeId: 'root', childNodeIds: ['b2'], node: { nodeType: 'Hash Join' }, metrics: {} },
        {
          nodeId: 'b2',
          parentNodeId: 'b1',
          childNodeIds: [],
          node: { nodeType: 'Seq Scan', relationName: 'users' },
          metrics: {},
        },
      ],
    },
    summary: {
      runtimeMsA: 1,
      runtimeMsB: 2,
      runtimeDeltaMs: 1,
      runtimeDeltaPct: 1,
      sharedReadBlocksA: 1,
      sharedReadBlocksB: 2,
      sharedReadDeltaBlocks: 1,
      sharedReadDeltaPct: 1,
      nodeCountA: 3,
      nodeCountB: 3,
      nodeCountDelta: 0,
      maxDepthA: 2,
      maxDepthB: 2,
      maxDepthDelta: 0,
      severeFindingsCountA: 0,
      severeFindingsCountB: 0,
      severeFindingsDelta: 0,
    },
    matches: [
      { nodeIdA: 'root', nodeIdB: 'root', matchScore: 1, confidence: 'High', scoreBreakdown: {} },
      { nodeIdA: 'a1', nodeIdB: 'b1', matchScore: 0.9, confidence: 'High', scoreBreakdown: {} },
      { nodeIdA: 'a2', nodeIdB: 'b2', matchScore: 0.9, confidence: 'High', scoreBreakdown: {} },
    ],
    unmatchedNodeIdsA: [],
    unmatchedNodeIdsB: [],
    nodeDeltas: [
      {
        nodeIdA: 'a2',
        nodeIdB: 'b2',
        matchScore: 0.9,
        matchConfidence: 'High',
        nodeTypeA: 'Seq Scan',
        nodeTypeB: 'Seq Scan',
        relationName: 'users',
        indexName: null,
        inclusiveTimeMs: { a: 1, b: 3, delta: 2, deltaPct: 2 },
        exclusiveTimeMsApprox: { a: 1, b: 1, delta: 0, deltaPct: 0 },
        subtreeTimeShare: { a: 0.1, b: 0.1, delta: 0, deltaPct: 0 },
        sharedReadBlocks: { a: 1, b: 2, delta: 1, deltaPct: 1 },
        sharedReadShare: { a: 0.1, b: 0.2, delta: 0.1, deltaPct: 1 },
        rowEstimateFactor: { a: 1, b: 1, delta: 0, deltaPct: 0 },
        actualRowsTotal: { a: 1, b: 1, delta: 0, deltaPct: 0 },
        loops: { a: 1, b: 1, delta: 0, deltaPct: 0 },
      },
    ],
    topImprovedNodes: [],
    topWorsenedNodes: [],
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
          depthA: 2,
          depthB: 2,
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
    ],
    findingsDiff: { items: [] },
    narrative: '',
    diagnostics: null,
  }
}

describe('compareBranchContext', () => {
  test('buildMatchLookup maps both directions', () => {
    const { aToB, bToA } = buildMatchLookup([
      { nodeIdA: 'x', nodeIdB: 'y', matchScore: 1, confidence: 'High', scoreBreakdown: {} },
    ])
    expect(aToB.get('x')).toBe('y')
    expect(bToA.get('y')).toBe('x')
  })

  test('resolveFindingDiffPair fills missing side from matches', () => {
    const matches = [
      { nodeIdA: 'a2', nodeIdB: 'b2', matchScore: 1, confidence: 'High' as const, scoreBreakdown: {} },
    ]
    expect(resolveFindingDiffPair({ changeType: 'New', ruleId: 'r', nodeIdB: 'b2', title: '', summary: '' }, matches)).toEqual({
      a: 'a2',
      b: 'b2',
    })
    expect(resolveFindingDiffPair({ changeType: 'New', ruleId: 'r', nodeIdA: 'a2', title: '', summary: '' }, matches)).toEqual({
      a: 'a2',
      b: 'b2',
    })
  })

  test('buildCompareBranchViewModel uses human-readable labels without root id', () => {
    const c = minimalComparison()
    const vm = buildCompareBranchViewModel(c, { a: 'a2', b: 'b2' }, c.pairDetails[0])
    const flat = vm.pathRowsA.map((r) => r.label).join(' ')
    expect(flat).not.toMatch(/\broot\b/i)
    expect(vm.pathRowsA.some((r) => r.isFocal && r.label.includes('users'))).toBe(true)
    expect(vm.pathRowsA.length).toBeGreaterThanOrEqual(2)
    expect(vm.focalCues.some((x) => x.includes('conf'))).toBe(true)
    expect(vm.focalCues.some((x) => x.includes('time'))).toBe(true)
  })

  test('mapped path rows expose partner ids for interaction', () => {
    const c = minimalComparison()
    const vm = buildCompareBranchViewModel(c, { a: 'a2', b: 'b2' }, c.pairDetails[0])
    const focalA = vm.pathRowsA.find((r) => r.isFocal)
    expect(focalA?.mappedPartnerId).toBe('b2')
  })
})
