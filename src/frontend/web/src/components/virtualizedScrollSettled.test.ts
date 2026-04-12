import { describe, expect, it, vi } from 'vitest'
import { scheduleVirtualScrollSettled } from './virtualizedScrollSettled'

async function flushRaf(times: number) {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }
}

describe('scheduleVirtualScrollSettled', () => {
  it('invokes onSettled after target index appears (two rAFs after detection)', async () => {
    const settled = vi.fn()
    scheduleVirtualScrollSettled(() => [{ index: 4 }], 4, settled, { maxFrames: 8 })
    await flushRaf(12)
    expect(settled).toHaveBeenCalledTimes(1)
  })

  it('invokes onSettled after maxFrames when index never appears (bounded fallback)', async () => {
    const settled = vi.fn()
    scheduleVirtualScrollSettled(() => [], 9, settled, { maxFrames: 3 })
    await flushRaf(20)
    expect(settled).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onSettled after cancel()', async () => {
    const settled = vi.fn()
    const cancel = scheduleVirtualScrollSettled(() => [], 1, settled, { maxFrames: 40 })
    cancel()
    await flushRaf(25)
    expect(settled).not.toHaveBeenCalled()
  })
})
