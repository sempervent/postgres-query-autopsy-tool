import { describe, expect, it } from 'vitest'
import {
  AnalyzeDeepLinkParam,
  CompareDeepLinkParam,
  buildAnalyzeDeepLinkSearchParams,
  buildCompareDeepLinkSearchParams,
  compareDeepLinkPath,
  copyArtifactShareToast,
  formatComparePinnedSummaryLine,
  shareArtifactLinkLabel,
} from './artifactLinks'

describe('artifactLinks', () => {
  it('buildCompareDeepLinkSearchParams sets compact query keys', () => {
    const p = buildCompareDeepLinkSearchParams({
      comparisonId: 'cmp_xyz',
      pairArtifactId: 'pair_ab12cd',
      findingDiffId: 'fd_ef34gh',
      indexInsightDiffId: 'ii_ij56kl',
      suggestionId: 'sg_mn78op',
    })
    expect(p.get(CompareDeepLinkParam.comparison)).toBe('cmp_xyz')
    expect(p.get(CompareDeepLinkParam.pair)).toBe('pair_ab12cd')
    expect(p.get(CompareDeepLinkParam.finding)).toBe('fd_ef34gh')
    expect(p.get(CompareDeepLinkParam.indexDiff)).toBe('ii_ij56kl')
    expect(p.get(CompareDeepLinkParam.suggestion)).toBe('sg_mn78op')
    expect(compareDeepLinkPath('/compare', p)).toBe(
      '/compare?comparison=cmp_xyz&pair=pair_ab12cd&finding=fd_ef34gh&indexDiff=ii_ij56kl&suggestion=sg_mn78op',
    )
  })

  it('buildAnalyzeDeepLinkSearchParams sets analysis and node', () => {
    const p = buildAnalyzeDeepLinkSearchParams({ analysisId: 'abc123', nodeId: 'node-42' })
    expect(p.get(AnalyzeDeepLinkParam.analysis)).toBe('abc123')
    expect(p.get(AnalyzeDeepLinkParam.node)).toBe('node-42')
  })

  it('buildAnalyzeDeepLinkSearchParams omits empty parts', () => {
    expect(buildAnalyzeDeepLinkSearchParams({}).toString()).toBe('')
    expect(buildAnalyzeDeepLinkSearchParams({ analysisId: 'x' }).get('node')).toBeNull()
  })

  it('shareArtifactLinkLabel stays capability-style in non-auth mode', () => {
    expect(shareArtifactLinkLabel(false, { accessScope: 'private', sharedGroupIds: [], allowLinkAccess: false })).toBe(
      'Copy share link',
    )
  })

  it('shareArtifactLinkLabel reflects auth scopes', () => {
    expect(shareArtifactLinkLabel(true, undefined)).toBe('Copy artifact link')
    expect(
      shareArtifactLinkLabel(true, { accessScope: 'link', sharedGroupIds: [], allowLinkAccess: true }),
    ).toBe('Copy share link')
    expect(
      shareArtifactLinkLabel(true, { accessScope: 'private', sharedGroupIds: [], allowLinkAccess: false }),
    ).toBe('Copy artifact link (private)')
  })

  it('formatComparePinnedSummaryLine lists active pins in stable order', () => {
    expect(formatComparePinnedSummaryLine({})).toBeNull()
    expect(formatComparePinnedSummaryLine({ findingDiffId: 'fd_x' })).toBe('Link includes: finding fd_x')
    expect(
      formatComparePinnedSummaryLine({
        findingDiffId: 'fd_a',
        indexInsightDiffId: 'ii_b',
        suggestionId: 'sg_c',
      }),
    ).toBe('Link includes: finding fd_a · index insight ii_b · next step sg_c')
  })

  it('copyArtifactShareToast matches label semantics', () => {
    expect(copyArtifactShareToast(false, null)).toBe('Copied share link')
    expect(copyArtifactShareToast(true, { accessScope: 'link', sharedGroupIds: [], allowLinkAccess: true })).toBe(
      'Copied share link',
    )
    expect(copyArtifactShareToast(true, { accessScope: 'private', sharedGroupIds: [], allowLinkAccess: false })).toBe(
      'Copied artifact link',
    )
  })
})
