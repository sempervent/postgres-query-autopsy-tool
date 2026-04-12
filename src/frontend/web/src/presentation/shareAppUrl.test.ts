import { describe, expect, test, vi } from 'vitest'
import {
  analyzeDeepLinkClipboardPayload,
  appUrlForPath,
  compareCompactPinContextPayload,
  compareDeepLinkClipboardPayload,
} from './shareAppUrl'

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

  test('compareDeepLinkClipboardPayload appends pinned artifact lines when provided', () => {
    const block = compareDeepLinkClipboardPayload('https://pqat.test/compare?comparison=c1&indexDiff=ii_x', 'c1', 'pair_7', {
      findingDiffId: 'fd_a',
      indexInsightDiffId: 'ii_x',
      suggestionId: 'sg_y',
    })
    expect(block.split('\n')).toEqual([
      'https://pqat.test/compare?comparison=c1&indexDiff=ii_x',
      'PQAT compare: c1',
      'Pair ref: pair_7',
      'Highlighted finding: fd_a',
      'Highlighted index change: ii_x',
      'Highlighted next step: sg_y',
    ])
  })

  test('compareCompactPinContextPayload omits URL and stacks ids + pinned summary line', () => {
    const block = compareCompactPinContextPayload(
      'c1',
      'pair_9',
      { indexInsightDiffId: 'ii_x' },
      { rewriteOutcomeOneLiner: 'Faster here.' },
    )
    expect(block).not.toContain('http')
    expect(block).toContain('PQAT compare: c1')
    expect(block).toContain('Pair ref: pair_9')
    expect(block).toContain('Link includes:')
    expect(block).toContain('index insight ii_x')
    expect(block).toContain('Rewrite outcome: Faster here.')
  })

  test('analyzeDeepLinkClipboardPayload stacks URL, analysis id, optional node', () => {
    const block = analyzeDeepLinkClipboardPayload('https://pqat.test/?analysis=a1&node=n2', 'a1', 'n2')
    expect(block).toContain('PQAT analysis: a1')
    expect(block).toContain('Node: n2')
  })

  test('analyzeDeepLinkClipboardPayload optional Start here headline after analysis id', () => {
    const block = analyzeDeepLinkClipboardPayload('https://pqat.test/?analysis=a1', 'a1', null, {
      startHereHeadline: 'Heavy seq scan',
    })
    expect(block.split('\n')).toEqual([
      'https://pqat.test/?analysis=a1',
      'PQAT analysis: a1',
      'Start here: Heavy seq scan',
    ])
  })
})
