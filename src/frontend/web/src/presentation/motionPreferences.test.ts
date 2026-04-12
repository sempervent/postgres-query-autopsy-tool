import { afterEach, describe, expect, it, vi } from 'vitest'
import { preferredScrollBehavior, scrollIntoViewOptionsForUser } from './motionPreferences'

describe('motionPreferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preferredScrollBehavior is auto when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    expect(preferredScrollBehavior()).toBe('auto')
  })

  it('preferredScrollBehavior is smooth when motion is allowed', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    expect(preferredScrollBehavior()).toBe('smooth')
  })

  it('scrollIntoViewOptionsForUser merges behavior from preference', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const o = scrollIntoViewOptionsForUser({ block: 'center', inline: 'nearest' })
    expect(o.block).toBe('center')
    expect(o.behavior).toBe('auto')
  })
})
