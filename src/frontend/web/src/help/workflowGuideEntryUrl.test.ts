import { afterEach, expect, test, vi } from 'vitest'
import { buildCopyGuidedLinkUrlFromLocation, buildWorkflowGuideAbsoluteUrl } from './workflowGuideEntryUrl'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('buildWorkflowGuideAbsoluteUrl sets guide=1 on origin + pathname', () => {
  vi.stubGlobal('window', { location: { origin: 'https://pqat.example' } })
  expect(buildWorkflowGuideAbsoluteUrl('/compare')).toBe('https://pqat.example/compare?guide=1')
})

test('buildWorkflowGuideAbsoluteUrl drops existing query string', () => {
  vi.stubGlobal('window', { location: { origin: 'https://pqat.example' } })
  expect(buildWorkflowGuideAbsoluteUrl('/')).toBe('https://pqat.example/?guide=1')
})

test('buildCopyGuidedLinkUrlFromLocation merges guide=1 and keeps other params', () => {
  const loc = {
    origin: 'https://pqat.example',
    pathname: '/compare',
    search: '?comparison=cmp_1&pair=pair_2',
    hash: '',
  }
  const out = buildCopyGuidedLinkUrlFromLocation(loc)
  const u = new URL(out)
  expect(u.pathname).toBe('/compare')
  expect(u.searchParams.get('comparison')).toBe('cmp_1')
  expect(u.searchParams.get('pair')).toBe('pair_2')
  expect(u.searchParams.get('guide')).toBe('1')
})

test('buildCopyGuidedLinkUrlFromLocation replaces existing guide param and preserves hash', () => {
  const loc = {
    origin: 'https://pqat.example',
    pathname: '/',
    search: '?guide=true&foo=bar',
    hash: '#x',
  }
  const out = buildCopyGuidedLinkUrlFromLocation(loc)
  const u = new URL(out.split('#')[0]!)
  expect(u.searchParams.get('guide')).toBe('1')
  expect(u.searchParams.get('foo')).toBe('bar')
  expect(out.endsWith('#x')).toBe(true)
})
