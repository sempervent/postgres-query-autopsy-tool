import { describe, expect, test } from 'vitest'
import { buildHotspots } from './hotspotPresentation'

describe('buildHotspots', () => {
  test('uses readable labels not node ids', () => {
    const analysis: any = {
      analysisId: 'x',
      rootNodeId: 'root',
      nodes: [
        { nodeId: 'root', childNodeIds: ['root.0'], node: { nodeType: 'Hash Join' }, metrics: { exclusiveActualTimeMsApprox: 10, subtreeTimeShare: 0.5 } },
        { nodeId: 'root.0', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: { exclusiveActualTimeMsApprox: 20, subtreeTimeShare: 0.7 } },
      ],
      findings: [],
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
        severeFindingsCount: 0,
        warnings: [],
      },
    }

    const hs = buildHotspots(analysis)
    expect(hs[0].label).toBe('Seq Scan on users')
    expect(hs[0].label).not.toMatch(/root\./)
  })
})

