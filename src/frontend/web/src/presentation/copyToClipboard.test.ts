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

  test('prefers navigator.clipboard.writeText when defined', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    await copyToClipboard('payload-a')
    expect(writeText).toHaveBeenCalledWith('payload-a')
  })

  test('falls back to execCommand when writeText is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {},
      configurable: true,
      writable: true,
    })
    const execFn = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { value: execFn, configurable: true, writable: true })
    await copyToClipboard('payload-b')
    expect(execFn).toHaveBeenCalledWith('copy')
  })

  test('throws when both clipboard and execCommand fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => false),
      configurable: true,
      writable: true,
    })
    await expect(copyToClipboard('x')).rejects.toThrow(/execCommand/i)
  })
})
