import { describe, expect, test } from 'vitest'
import { buildAnalyzeGraph } from './analyzeGraphAdapter'

describe('buildAnalyzeGraph', () => {
  test('builds readable nodes and edges', () => {
    const analysis: any = {
      analysisId: 'x',
      rootNodeId: 'root',
      queryText: null,
      nodes: [
        { nodeId: 'root', parentNodeId: null, childNodeIds: ['root.0'], node: { nodeType: 'Hash Join' }, metrics: { exclusiveActualTimeMsApprox: 10, subtreeTimeShare: 1 } },
        { nodeId: 'root.0', parentNodeId: 'root', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: { exclusiveActualTimeMsApprox: 20, subtreeTimeShare: 0.7 } },
      ],
      findings: [{ findingId: 'f1', ruleId: 'X', severity: 3, confidence: 2, category: 0, title: 't', summary: 's', explanation: '', evidence: {}, suggestion: '', nodeIds: ['root.0'] }],
      narrative: { whatHappened: '', whereTimeWent: '', whatLikelyMatters: '', whatProbablyDoesNotMatter: '' },
      summary: {
        totalNodeCount: 2,
        maxDepth: 1,
        hasActualTiming: true,
        hasBuffers: false,
        plannerCosts: 'present',
        topExclusiveTimeHotspotNodeIds: ['root.0'],
        topInclusiveTimeHotspotNodeIds: [],
        topSharedReadHotspotNodeIds: [],
        severeFindingsCount: 1,
        warnings: [],
      },
    }

    const g = buildAnalyzeGraph(analysis)
    expect(g.nodes.length).toBe(2)
    expect(g.edges.length).toBe(1)
    const n = g.nodes.find((x) => x.id === 'root.0')!
    expect(n.data.label).toBe('Seq Scan on users')
    expect(n.data.refSubtitle).toMatch(/under Hash Join/i)
    expect(n.data.isHotExclusive).toBe(true)
    expect(n.data.findingsCount).toBe(1)
  })
})

