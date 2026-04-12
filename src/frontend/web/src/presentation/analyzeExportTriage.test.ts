import { describe, expect, it } from 'vitest'
import type { PlanAnalysisResult } from '../api/types'
import {
  injectTriageIntoHtml,
  jsonExportWithTriageEnvelope,
  markdownTriagePreamble,
} from './analyzeExportTriage'

describe('analyzeExportTriage', () => {
  it('markdownTriagePreamble returns empty without headline', () => {
    expect(markdownTriagePreamble(null)).toBe('')
    expect(markdownTriagePreamble({ headline: '', supportingLine: 'x', primaryFindingId: 'f' })).toBe('')
  })

  it('markdownTriagePreamble includes headline, support, rule', () => {
    const md = markdownTriagePreamble({
      headline: 'Seq scan pressure',
      supportingLine: 'Check filters.',
      primaryFindingId: 'f1',
    })
    expect(md).toContain('## Start here')
    expect(md).toContain('**Seq scan pressure**')
    expect(md).toContain('Check filters.')
    expect(md).toContain('---')
  })

  it('injectTriageIntoHtml inserts after body tag', () => {
    const html = '<!doctype html><html><body><p>x</p></body></html>'
    const out = injectTriageIntoHtml(html, { headline: 'H', supportingLine: 'S' })
    expect(out).toContain('<body>')
    expect(out).toContain('Start here')
    expect(out).toContain('H')
    expect(out).toContain('S')
  })

  it('injectTriageIntoHtml escapes HTML in takeaway', () => {
    const out = injectTriageIntoHtml('<body></body>', { headline: '<script>', supportingLine: '&' })
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('&amp;')
  })

  it('jsonExportWithTriageEnvelope adds pqatExportTriage when headline present', () => {
    const analysis = { analysisId: 'a1', rootNodeId: 'r' } as unknown as PlanAnalysisResult
    const out = jsonExportWithTriageEnvelope(analysis, {
      headline: 'Top finding',
      supportingLine: 'Details',
      primaryFindingId: 'f9',
      focusNodeId: 'n1',
    })
    expect(out.pqatExportTriage).toEqual({
      startHereHeadline: 'Top finding',
      startHereSummary: 'Details',
      primaryFindingId: 'f9',
      focusNodeId: 'n1',
    })
    expect((out as { analysisId: string }).analysisId).toBe('a1')
  })

  it('jsonExportWithTriageEnvelope passes through without takeaway headline', () => {
    const analysis = { analysisId: 'a1' } as unknown as PlanAnalysisResult
    const out = jsonExportWithTriageEnvelope(analysis, { headline: '', supportingLine: '' })
    expect(out).not.toHaveProperty('pqatExportTriage')
  })
})
