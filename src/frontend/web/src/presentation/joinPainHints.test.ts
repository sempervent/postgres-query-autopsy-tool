import { describe, expect, test } from 'vitest'
import { joinSideBadgesForPair, joinSideSummaryLinesForPair } from './joinPainHints'

describe('joinSideBadgesForPair', () => {
  test('hash join emits build pressure badge from hashBuild diff', () => {
    const byIdA = new Map<string, any>()
    const byIdB = new Map<string, any>()
    byIdA.set('a', { nodeId: 'a', childNodeIds: [], node: { nodeType: 'Hash Join' }, metrics: {} })
    byIdB.set('b', { nodeId: 'b', childNodeIds: [], node: { nodeType: 'Hash Join' }, metrics: {} })

    const pair: any = {
      identity: { nodeIdA: 'a', nodeIdB: 'b' },
      contextDiff: { overallDirection: 'Worsened', highlights: [], hashBuild: { pressureDirection: 'Worsened', summary: 'hash build: batches 1→8', hashBatches: { a: 1, b: 8 }, diskUsageKb: { a: 0, b: 10 }, peakMemoryUsageKb: { a: null, b: null } } },
    }

    const b = joinSideBadgesForPair(pair, byIdA as any, byIdB as any, 3)
    expect(b.map((x) => x.text).join(' ')).toMatch(/build pressure/)
  })

  test('non-join does not emit side badges', () => {
    const byIdA = new Map<string, any>()
    const byIdB = new Map<string, any>()
    byIdA.set('a', { nodeId: 'a', childNodeIds: [], node: { nodeType: 'Seq Scan' }, metrics: {} })
    byIdB.set('b', { nodeId: 'b', childNodeIds: [], node: { nodeType: 'Seq Scan' }, metrics: {} })

    const pair: any = { identity: { nodeIdA: 'a', nodeIdB: 'b' }, contextDiff: { overallDirection: 'Worsened', highlights: [], hashBuild: { pressureDirection: 'Worsened' } } }
    expect(joinSideBadgesForPair(pair, byIdA as any, byIdB as any, 3)).toEqual([])
  })
})

describe('joinSideSummaryLinesForPair', () => {
  test('hash join emits build-side summary line', () => {
    const byIdA = new Map<string, any>()
    const byIdB = new Map<string, any>()
    byIdA.set('a', { nodeId: 'a', childNodeIds: [], node: { nodeType: 'Hash Join' }, metrics: {} })
    byIdB.set('b', { nodeId: 'b', childNodeIds: [], node: { nodeType: 'Hash Join' }, metrics: {} })

    const pair: any = {
      identity: { nodeIdA: 'a', nodeIdB: 'b' },
      contextDiff: { overallDirection: 'Worsened', highlights: [], hashBuild: { pressureDirection: 'Worsened', summary: 'hash build: batches 1→8', hashBatches: { a: 1, b: 8 }, diskUsageKb: { a: 0, b: 10 }, peakMemoryUsageKb: { a: null, b: null } } },
    }
    const lines = joinSideSummaryLinesForPair(pair, byIdA as any, byIdB as any)
    expect(lines.join(' ')).toMatch(/Build side/)
  })
})

