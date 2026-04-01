import { describe, expect, test } from 'vitest'
import { accessPathChangeCue, formatIndexInsightDiffKind } from './indexInsightPresentation'

describe('indexInsightPresentation', () => {
  test('formatIndexInsightDiffKind maps numeric backend enum', () => {
    expect(formatIndexInsightDiffKind(0)).toBe('New')
    expect(formatIndexInsightDiffKind(1)).toBe('Resolved')
    expect(formatIndexInsightDiffKind('Worsened')).toBe('Worsened')
  })

  test('formatIndexInsightDiffKind maps lowercase API strings', () => {
    expect(formatIndexInsightDiffKind('resolved')).toBe('Resolved')
    expect(formatIndexInsightDiffKind('new')).toBe('New')
  })

  test('accessPathChangeCue uses human-readable family labels', () => {
    expect(accessPathChangeCue('seqScan', 'indexScan')).toBe('Access path family: Seq Scan → Index Scan')
  })
})
