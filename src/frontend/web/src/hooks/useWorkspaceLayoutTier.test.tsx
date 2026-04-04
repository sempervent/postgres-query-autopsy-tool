import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceLayoutTier } from './useWorkspaceLayoutTier'

function mockViewportWidth(widthPx: number) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      let matches = false
      if (query === '(min-width: 1320px)') matches = widthPx >= 1320
      else if (query === '(min-width: 900px)') matches = widthPx >= 900
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
  })
}

describe('useWorkspaceLayoutTier', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'matchMedia')
  })

  it('returns narrow below 900px', () => {
    mockViewportWidth(640)
    const { result } = renderHook(() => useWorkspaceLayoutTier())
    expect(result.current).toBe('narrow')
  })

  it('returns medium from 900px up to 1319px', () => {
    mockViewportWidth(1100)
    const { result } = renderHook(() => useWorkspaceLayoutTier())
    expect(result.current).toBe('medium')
  })

  it('returns wide at 1320px and above', () => {
    mockViewportWidth(1600)
    const { result } = renderHook(() => useWorkspaceLayoutTier())
    expect(result.current).toBe('wide')
  })
})
