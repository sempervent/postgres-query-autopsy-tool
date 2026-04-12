import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { VirtualizedListColumn, type VirtualizedListColumnHandle } from './VirtualizedListColumn'

describe('VirtualizedListColumn', () => {
  it('exposes scrollToIndex on ref without throwing', () => {
    const ref = createRef<VirtualizedListColumnHandle>()
    render(
      <VirtualizedListColumn ref={ref} count={20} estimateSize={48} aria-label="test list">
        {(i) => (
          <div style={{ minHeight: 48 }} data-row={i}>
            row {i}
          </div>
        )}
      </VirtualizedListColumn>,
    )
    expect(ref.current).toBeTruthy()
    expect(() => ref.current!.scrollToIndex(5, { align: 'start' })).not.toThrow()
  })
})
