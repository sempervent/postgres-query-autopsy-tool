import { describe, expect, test } from 'vitest'
import { bufferCounterRowsForApiNode, planNodeApiHasAnyBufferCounter } from './bufferFieldsPresentation'

describe('bufferFieldsPresentation', () => {
  test('detects explicit zero as present', () => {
    expect(planNodeApiHasAnyBufferCounter({ sharedReadBlocks: 0 })).toBe(true)
  })

  test('rows include only defined keys', () => {
    const rows = bufferCounterRowsForApiNode({ sharedReadBlocks: 42, tempWrittenBlocks: 1 })
    expect(rows.map((r) => r.label)).toContain('Shared read blocks')
    expect(rows.map((r) => r.label)).toContain('Temp written blocks')
    expect(rows.find((r) => r.label === 'Shared hit blocks')).toBeUndefined()
  })
})
