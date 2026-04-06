import { describe, expect, test, vi, afterEach } from 'vitest'
import { appUrlForPath } from './shareAppUrl'

describe('appUrlForPath', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('prefixes window.location.origin', () => {
    vi.stubGlobal('window', { location: { origin: 'https://pqat.test' } })
    expect(appUrlForPath('/analyze/abc')).toBe('https://pqat.test/analyze/abc')
  })
})
