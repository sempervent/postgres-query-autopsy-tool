import { describe, expect, test, vi } from 'vitest'
import { analyzeDeepLinkClipboardPayload, appUrlForPath, compareDeepLinkClipboardPayload } from './shareAppUrl'

describe('shareAppUrl', () => {
  test('appUrlForPath prefixes origin', () => {
    vi.stubGlobal('window', { location: { origin: 'https://pqat.test' } })
    expect(appUrlForPath('/compare?x=1')).toBe('https://pqat.test/compare?x=1')
    vi.unstubAllGlobals()
  })

  test('compareDeepLinkClipboardPayload stacks URL, comparison id, optional pair ref', () => {
    const block = compareDeepLinkClipboardPayload('https://pqat.test/compare?comparison=c1', 'c1', 'pair_7')
    expect(block.split('\n')).toEqual([
      'https://pqat.test/compare?comparison=c1',
      'PQAT compare: c1',
      'Pair ref: pair_7',
    ])
  })

  test('analyzeDeepLinkClipboardPayload stacks URL, analysis id, optional node', () => {
    const block = analyzeDeepLinkClipboardPayload('https://pqat.test/?analysis=a1&node=n2', 'a1', 'n2')
    expect(block).toContain('PQAT analysis: a1')
    expect(block).toContain('Node: n2')
  })
})
