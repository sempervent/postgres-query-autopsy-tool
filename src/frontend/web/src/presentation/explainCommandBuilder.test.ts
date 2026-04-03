import { describe, expect, test } from 'vitest'
import { buildSuggestedExplainSql } from './explainCommandBuilder'

describe('buildSuggestedExplainSql', () => {
  test('returns null when query text empty', () => {
    expect(buildSuggestedExplainSql('  ', { analyze: true, verbose: true, buffers: true, costs: true })).toBeNull()
  })

  test('wraps query and includes COSTS true when enabled', () => {
    const sql = buildSuggestedExplainSql('SELECT 1', {
      analyze: true,
      verbose: false,
      buffers: true,
      costs: true,
    })
    expect(sql).toContain('EXPLAIN (ANALYZE, BUFFERS, COSTS true, FORMAT JSON)')
    expect(sql).toContain('SELECT 1')
    expect(sql?.trim().endsWith(';')).toBe(true)
  })

  test('uses COSTS false when toggled off', () => {
    const sql = buildSuggestedExplainSql('SELECT 1;', {
      analyze: false,
      verbose: true,
      buffers: false,
      costs: false,
    })
    expect(sql).toContain('COSTS false')
    expect(sql).not.toContain('ANALYZE')
    expect(sql).toContain('VERBOSE')
  })
})
