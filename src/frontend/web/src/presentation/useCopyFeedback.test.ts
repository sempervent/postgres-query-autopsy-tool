import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as clip from './copyToClipboard'
import { useCopyFeedback } from './useCopyFeedback'

describe('useCopyFeedback', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('sets ok status after successful copy', async () => {
    vi.useFakeTimers()
    vi.spyOn(clip, 'copyToClipboard').mockResolvedValue(undefined)
    const { result } = renderHook(() => useCopyFeedback())
    await act(async () => {
      await result.current.copy('hello', 'Copied OK')
    })
    expect(result.current.status).toBe('Copied OK')
    await act(async () => {
      vi.advanceTimersByTime(2300)
    })
    expect(result.current.status).toBeNull()
  })

  test('sets failure status when copyToClipboard rejects', async () => {
    vi.useFakeTimers()
    vi.spyOn(clip, 'copyToClipboard').mockRejectedValue(new Error('denied'))
    const { result } = renderHook(() => useCopyFeedback())
    await act(async () => {
      await result.current.copy('hello', 'Copied OK')
    })
    expect(result.current.status).toMatch(/Copy failed/i)
    await act(async () => {
      vi.advanceTimersByTime(6000)
    })
    expect(result.current.status).toBeNull()
  })

  test('does not throw when unmounted before success timer fires (Phase 89 regression)', async () => {
    vi.useFakeTimers()
    vi.spyOn(clip, 'copyToClipboard').mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useCopyFeedback())
    await act(async () => {
      await result.current.copy('hello', 'Copied OK')
    })
    expect(result.current.status).toBe('Copied OK')
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
  })

  test('skips status update when unmount happens before copy resolves', async () => {
    vi.useFakeTimers()
    let release: (() => void) | null = null
    vi.spyOn(clip, 'copyToClipboard').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve()
        }),
    )
    const { result, unmount } = renderHook(() => useCopyFeedback())
    await act(async () => {
      void result.current.copy('hello', 'Copied OK')
    })
    unmount()
    await act(async () => {
      release?.()
    })
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
  })
})
