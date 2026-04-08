import { afterEach, describe, expect, test, vi } from 'vitest'
import { copyToClipboard } from './copyToClipboard'

describe('copyToClipboard', () => {
  const origClipboard = navigator.clipboard

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: origClipboard,
      configurable: true,
      writable: true,
    })
    vi.restoreAllMocks()
  })

  test('uses synchronous execCommand(copy) when it succeeds (preserves user activation)', async () => {
    const execFn = vi.fn(() => true)
    vi.spyOn(document, 'execCommand').mockImplementation(execFn as typeof document.execCommand)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    await copyToClipboard('payload-sync')
    expect(execFn).toHaveBeenCalledWith('copy')
    expect(writeText).not.toHaveBeenCalled()
  })

  test('falls back to navigator.clipboard.writeText when execCommand returns false', async () => {
    const execFn = vi.fn(() => false)
    vi.spyOn(document, 'execCommand').mockImplementation(execFn as typeof document.execCommand)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    await copyToClipboard('payload-async')
    expect(writeText).toHaveBeenCalledWith('payload-async')
  })

  test('falls back to execCommand when writeText is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {},
      configurable: true,
      writable: true,
    })
    const execFn = vi.fn(() => true)
    vi.spyOn(document, 'execCommand').mockImplementation(execFn as typeof document.execCommand)
    await copyToClipboard('payload-fallback')
    expect(execFn).toHaveBeenCalledWith('copy')
  })

  test('throws when execCommand fails and Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    vi.spyOn(document, 'execCommand').mockReturnValue(false as boolean)
    await expect(copyToClipboard('x')).rejects.toThrow(/Clipboard unavailable/i)
  })
})
