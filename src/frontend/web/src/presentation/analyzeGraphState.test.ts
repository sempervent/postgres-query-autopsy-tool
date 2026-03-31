import { describe, expect, test } from 'vitest'
import { applyGraphView, computeVisibleNodeIds, revealPath, shouldAutoFitOnVisibilityChange, toggleCollapsed } from './analyzeGraphState'

describe('analyzeGraphState', () => {
  test('collapse hides descendants', () => {
    const base: any = {
      nodes: [{ id: 'a', data: { nodeId: 'a', label: 'A' } }, { id: 'b', data: { nodeId: 'b', label: 'B' } }, { id: 'c', data: { nodeId: 'c', label: 'C' } }],
      edges: [{ id: 'a->b', source: 'a', target: 'b' }, { id: 'b->c', source: 'b', target: 'c' }],
    }
    const vis = computeVisibleNodeIds(base, new Set(['b']))
    expect(vis.has('a')).toBe(true)
    expect(vis.has('b')).toBe(true)
    expect(vis.has('c')).toBe(false)
  })

  test('search highlights matches and dims non-matches', () => {
    const base: any = {
      nodes: [
        { id: 'a', data: { nodeId: 'a', label: 'Seq Scan on users', searchText: 'Seq Scan users', refSubtitle: 'under Hash Join' } },
        { id: 'b', data: { nodeId: 'b', label: 'Hash Join', searchText: 'Hash Join orders users', refSubtitle: null } },
      ],
      edges: [],
    }
    const v = applyGraphView(base, { collapsed: new Set(), searchTerm: 'users' }, null)
    const a = v.nodes.find((n: any) => n.id === 'a')!.data
    const b = v.nodes.find((n: any) => n.id === 'b')!.data
    expect(a.isSearchMatch).toBe(true)
    expect(b.isSearchMatch).toBe(true)
    const v2 = applyGraphView(base, { collapsed: new Set(), searchTerm: 'seq scan' }, null)
    expect(v2.nodes.find((n: any) => n.id === 'a')!.data.isSearchMatch).toBe(true)
    expect(v2.nodes.find((n: any) => n.id === 'b')!.data.isSearchDim).toBe(true)
  })

  test('toggleCollapsed adds/removes id', () => {
    const s = new Set<string>()
    const a = toggleCollapsed(s, 'x')
    expect(a.has('x')).toBe(true)
    const b = toggleCollapsed(a, 'x')
    expect(b.has('x')).toBe(false)
  })

  test('revealPath removes collapsed ancestors', () => {
    const base: any = {
      nodes: [{ id: 'a', data: { nodeId: 'a', label: 'A' } }, { id: 'b', data: { nodeId: 'b', label: 'B' } }, { id: 'c', data: { nodeId: 'c', label: 'C' } }],
      edges: [{ id: 'a->b', source: 'a', target: 'b' }, { id: 'b->c', source: 'b', target: 'c' }],
    }
    const collapsed = new Set<string>(['a', 'b'])
    const next = revealPath(collapsed, base, 'c')
    expect(next.has('a')).toBe(false)
    expect(next.has('b')).toBe(false)
  })

  test('shouldAutoFitOnVisibilityChange triggers for large diffs', () => {
    expect(shouldAutoFitOnVisibilityChange(100, 90)).toBe(false)
    expect(shouldAutoFitOnVisibilityChange(100, 80)).toBe(true)
  })
})

