import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { THEME_STORAGE_KEY, DEFAULT_THEME_PREFERENCE } from './themeConstants'
import { resolveEffectiveTheme } from './resolveEffectiveTheme'
import { useThemePreference } from './useThemePreference'
import * as authHeaders from '../api/authHeaders'

const fetchUserPreferenceMock = vi.hoisted(() => vi.fn())
const saveUserPreferenceMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    fetchUserPreference: fetchUserPreferenceMock,
    saveUserPreference: saveUserPreferenceMock,
  }
})

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  })
}

describe('resolveEffectiveTheme', () => {
  it('respects explicit dark and light', () => {
    expect(resolveEffectiveTheme('dark', false)).toBe('dark')
    expect(resolveEffectiveTheme('dark', true)).toBe('dark')
    expect(resolveEffectiveTheme('light', true)).toBe('light')
    expect(resolveEffectiveTheme('light', false)).toBe('light')
  })

  it('follows system when preference is system', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark')
    expect(resolveEffectiveTheme('system', false)).toBe('light')
  })
})

describe('useThemePreference', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-effective-theme')
    document.documentElement.removeAttribute('data-theme-preference')
    document.documentElement.style.colorScheme = ''
    mockMatchMedia(true)
    fetchUserPreferenceMock.mockReset()
    saveUserPreferenceMock.mockReset()
    fetchUserPreferenceMock.mockResolvedValue(null)
    saveUserPreferenceMock.mockResolvedValue(true)
  })

  it('defaults to system and applies resolved theme to document', () => {
    const { result } = renderHook(() => useThemePreference())
    expect(result.current.preference).toBe(DEFAULT_THEME_PREFERENCE)

    act(() => {
      /* effects */
    })

    expect(document.documentElement.getAttribute('data-theme-preference')).toBe('system')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-effective-theme')).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('persists explicit light and updates dom', () => {
    const { result } = renderHook(() => useThemePreference())

    act(() => {
      result.current.setPreference('light')
    })

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-effective-theme')).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('persists explicit dark', () => {
    const { result } = renderHook(() => useThemePreference())

    act(() => {
      result.current.setPreference('dark')
    })

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-effective-theme')).toBe('dark')
  })

  it('updates effective theme when system color scheme changes', () => {
    const mqState = { matches: true }
    let onChange: (() => void) | undefined
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        get matches() {
          return mqState.matches
        },
        media: query,
        addEventListener: (_: string, fn: () => void) => {
          onChange = fn
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    })

    const { result } = renderHook(() => useThemePreference())
    act(() => {})

    expect(result.current.preference).toBe('system')
    expect(result.current.effectiveTheme).toBe('dark')

    mqState.matches = false
    act(() => {
      onChange?.()
    })

    expect(result.current.effectiveTheme).toBe('light')
    expect(document.documentElement.getAttribute('data-effective-theme')).toBe('light')
  })
})

describe('useThemePreference server sync', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-effective-theme')
    document.documentElement.removeAttribute('data-theme-preference')
    document.documentElement.style.colorScheme = ''
    mockMatchMedia(false)
    fetchUserPreferenceMock.mockReset()
    saveUserPreferenceMock.mockReset()
    fetchUserPreferenceMock.mockResolvedValue('dark')
    saveUserPreferenceMock.mockResolvedValue(true)
    vi.spyOn(authHeaders, 'hasAuthFetchCredentials').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hydrates preference from server when serverSyncEnabled', async () => {
    const { result } = renderHook(() => useThemePreference({ serverSyncEnabled: true }))

    await waitFor(() => {
      expect(result.current.preference).toBe('dark')
    })

    expect(fetchUserPreferenceMock).toHaveBeenCalled()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute('data-effective-theme')).toBe('dark')
  })

  it('debounces save to server after preference change', async () => {
    const { result } = renderHook(() => useThemePreference({ serverSyncEnabled: true }))

    await waitFor(() => {
      expect(result.current.preference).toBe('dark')
    })

    await waitFor(
      () => {
        expect(saveUserPreferenceMock).toHaveBeenCalled()
      },
      { timeout: 3000 },
    )

    saveUserPreferenceMock.mockClear()

    act(() => {
      result.current.setPreference('light')
    })

    expect(saveUserPreferenceMock).not.toHaveBeenCalled()

    await waitFor(
      () => {
        expect(saveUserPreferenceMock).toHaveBeenCalledWith('appearance_theme_v1', 'light')
      },
      { timeout: 3000 },
    )
  })
})
