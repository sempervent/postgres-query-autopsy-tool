import { describe, expect, test } from 'vitest'
import { contextBadges } from './contextBadges'
import { joinLabelAndSubtitle, nodeShortLabel } from './nodeLabels'

describe('nodeShortLabel', () => {
  test('seq scan on relation', () => {
    const n: any = { nodeId: 'root.0', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} }
    expect(nodeShortLabel(n)).toBe('Seq Scan on users')
  })

  test('index scan with index name', () => {
    const n: any = { nodeId: 'x', childNodeIds: [], node: { nodeType: 'Index Scan', relationName: 'orders', indexName: 'orders_customer_id_idx' }, metrics: {} }
    expect(nodeShortLabel(n)).toContain('using orders_customer_id_idx')
  })
})

describe('joinLabelAndSubtitle', () => {
  test('hash join build/probe from hash child', () => {
    const byId = new Map<string, any>()
    byId.set('j', { nodeId: 'j', childNodeIds: ['probe', 'hash'], node: { nodeType: 'Hash Join', hashCond: '(u.id = o.user_id)' }, metrics: {} })
    byId.set('probe', { nodeId: 'probe', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'users' }, metrics: {} })
    byId.set('hash', { nodeId: 'hash', childNodeIds: ['build'], node: { nodeType: 'Hash' }, metrics: {} })
    byId.set('build', { nodeId: 'build', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'orders' }, metrics: {} })

    const js = joinLabelAndSubtitle(byId.get('j'), byId as any)
    expect(js?.label).toBe('Hash Join (users × orders)')
    expect(js?.subtitle).toMatch(/build: orders/)
    expect(js?.subtitle).toMatch(/probe: users/)
    expect(js?.subtitle).toMatch(/cond:/)
  })

  test('nested loop outer/inner', () => {
    const byId = new Map<string, any>()
    byId.set('j', { nodeId: 'j', childNodeIds: ['outer', 'inner'], node: { nodeType: 'Nested Loop' }, metrics: {} })
    byId.set('outer', { nodeId: 'outer', childNodeIds: [], node: { nodeType: 'Seq Scan', relationName: 'customers' }, metrics: {} })
    byId.set('inner', { nodeId: 'inner', childNodeIds: [], node: { nodeType: 'Index Scan', relationName: 'line_items', indexName: 'li_cust_idx' }, metrics: {} })

    const js = joinLabelAndSubtitle(byId.get('j'), byId as any)
    expect(js?.label).toBe('Nested Loop (customers × line_items)')
    expect(js?.subtitle).toMatch(/outer: customers/)
    expect(js?.subtitle).toMatch(/inner: line_items/)
  })
})

describe('contextBadges', () => {
  test('caps badges and formats arrows', () => {
    const diff: any = {
      overallDirection: 'Mixed',
      highlights: [],
      hashBuild: { pressureDirection: 'Worsened' },
      scanWaste: { wasteDirection: 'Improved' },
      sort: { sortSpillDirection: 'Neutral' },
      memoize: { effectivenessDirection: 'Improved' },
    }
    const b = contextBadges(diff, 3)
    expect(b.length).toBeLessThanOrEqual(3)
    expect(b.map((x) => x.text).join(' ')).toMatch(/hash pressure/)
  })
})

