import { describe, expect, it } from 'vitest'
import {
  AnalyzeDeepLinkParam,
  CompareDeepLinkParam,
  buildAnalyzeDeepLinkSearchParams,
  buildCompareDeepLinkSearchParams,
  compareDeepLinkPath,
} from './artifactLinks'

describe('artifactLinks', () => {
  it('buildCompareDeepLinkSearchParams sets compact query keys', () => {
    const p = buildCompareDeepLinkSearchParams({
      pairArtifactId: 'pair_ab12cd',
      findingDiffId: 'fd_ef34gh',
      indexInsightDiffId: 'ii_ij56kl',
      suggestionId: 'sg_mn78op',
    })
    expect(p.get(CompareDeepLinkParam.pair)).toBe('pair_ab12cd')
    expect(p.get(CompareDeepLinkParam.finding)).toBe('fd_ef34gh')
    expect(p.get(CompareDeepLinkParam.indexDiff)).toBe('ii_ij56kl')
    expect(p.get(CompareDeepLinkParam.suggestion)).toBe('sg_mn78op')
    expect(compareDeepLinkPath('/compare', p)).toBe(
      '/compare?pair=pair_ab12cd&finding=fd_ef34gh&indexDiff=ii_ij56kl&suggestion=sg_mn78op',
    )
  })

  it('buildAnalyzeDeepLinkSearchParams sets node', () => {
    const p = buildAnalyzeDeepLinkSearchParams('node-42')
    expect(p.get(AnalyzeDeepLinkParam.node)).toBe('node-42')
  })
})
