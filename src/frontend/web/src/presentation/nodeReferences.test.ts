import { describe, expect, test } from 'vitest'
import { nearestMeaningfulAncestorSubtitle, nodeReferenceText, pairReferenceText } from './nodeReferences'

describe('nodeReferences', () => {
  test('nearestMeaningfulAncestorSubtitle prefers join ancestor', () => {
    const byId = new Map<string, any>()
    byId.set('j', { nodeId: 'j', parentNodeId: null, childNodeIds: ['c'], node: { nodeType: 'Hash Join' }, metrics: {} })
    byId.set('c', { nodeId: 'c', parentNodeId: 'j', childNodeIds: ['s'], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} })
    byId.set('s', { nodeId: 's', parentNodeId: 'c', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} })
    expect(nearestMeaningfulAncestorSubtitle('s', byId as any)).toMatch(/under Hash Join/i)
  })

  test('nodeReferenceText does not require raw ids', () => {
    const byId = new Map<string, any>()
    byId.set('x', { nodeId: 'x', parentNodeId: null, childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} })
    expect(nodeReferenceText('x', byId as any)).toBe('Seq Scan on users')
    expect(nodeReferenceText('x', byId as any)).not.toMatch(/root\./)
  })

  test('pairReferenceText uses readable pair label', () => {
    const byIdA = new Map<string, any>()
    const byIdB = new Map<string, any>()
    byIdA.set('a', { nodeId: 'a', parentNodeId: null, childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} })
    byIdB.set('b', { nodeId: 'b', parentNodeId: null, childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} })
    const pair: any = { identity: { nodeIdA: 'a', nodeIdB: 'b' } }
    expect(pairReferenceText(pair, byIdA as any, byIdB as any)).toMatch(/Seq Scan on users/)
  })
})

