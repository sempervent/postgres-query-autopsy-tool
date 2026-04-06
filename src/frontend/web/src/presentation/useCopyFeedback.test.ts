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
      vi.advanceTimersByTime(2000)
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
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.status).toBeNull()
  })
})
