import { expect, test } from 'vitest'
import type { NodePairDetail, PlanAnalysisResult, PlanComparisonResult } from '../api/types'
import {
  buildCompareExportTriageSummary,
  injectCompareExportSupplementIntoHtml,
  injectCompareTriageIntoHtml,
  jsonCompareExportWithTriageEnvelope,
  markdownCompareExportSupplement,
} from './compareExportTriage'
import type { CompareLeadTakeaway } from './compareOutputGuidance'

function minimalPlan(overrides: Partial<PlanAnalysisResult> = {}): PlanAnalysisResult {
  return {
    analysisId: 'a',
    rootNodeId: 'r',
    nodes: [],
    findings: [],
    narrative: { whatHappened: '', whereTimeWent: '', whatLikelyMatters: '', whatProbablyDoesNotMatter: '' },
    summary: {
      totalNodeCount: 0,
      maxDepth: 0,
      hasActualTiming: false,
      hasBuffers: false,
      plannerCosts: 'unknown',
      topExclusiveTimeHotspotNodeIds: [],
      topInclusiveTimeHotspotNodeIds: [],
      topSharedReadHotspotNodeIds: [],
      severeFindingsCount: 0,
      warnings: [],
    },
    ...overrides,
  }
}

function minimalComparison(overrides: Partial<PlanComparisonResult> = {}): PlanComparisonResult {
  return {
    comparisonId: 'cmp_test',
    planA: minimalPlan({ analysisId: 'pa' }),
    planB: minimalPlan({ analysisId: 'pb' }),
    summary: {
      sharedReadBlocksA: 0,
      sharedReadBlocksB: 0,
      sharedReadDeltaBlocks: 0,
      nodeCountA: 1,
      nodeCountB: 1,
      nodeCountDelta: 0,
      maxDepthA: 0,
      maxDepthB: 0,
      maxDepthDelta: 0,
      severeFindingsCountA: 0,
      severeFindingsCountB: 0,
      severeFindingsDelta: 0,
    },
    matches: [],
    unmatchedNodeIdsA: [],
    unmatchedNodeIdsB: [],
    nodeDeltas: [],
    topImprovedNodes: [],
    topWorsenedNodes: [],
    pairDetails: [],
    findingsDiff: { items: [] },
    narrative: '',
    ...overrides,
  }
}

test('markdownCompareExportSupplement adds selection context for bridge and pair', () => {
  const s = buildCompareExportTriageSummary(minimalComparison(), null, {
    lead: { headline: 'Change at a glance', line: 'Plan B wins.' } as CompareLeadTakeaway,
    triageBridgeLine: 'Same pair as highlighted finding.',
    continuitySummaryCue: null,
  })
  const md = markdownCompareExportSupplement(s)
  expect(md).toContain('### Selection context')
  expect(md).toContain('Same pair as highlighted finding')
  expect(md).not.toMatch(/^## Reading thread/m)
})

test('markdownCompareExportSupplement is empty when only lead (server owns Reading thread)', () => {
  const s = buildCompareExportTriageSummary(minimalComparison(), null, {
    lead: { headline: 'H', line: 'Overview line' } as CompareLeadTakeaway,
    triageBridgeLine: null,
    continuitySummaryCue: null,
  })
  expect(markdownCompareExportSupplement(s)).toBe('')
})

test('jsonCompareExportWithTriageEnvelope adds pqatExportCompareTriage', () => {
  const cmp = minimalComparison()
  const s = buildCompareExportTriageSummary(cmp, { pairArtifactId: 'pair_x' } as NodePairDetail, {
    lead: null,
    triageBridgeLine: null,
    continuitySummaryCue: 'Continuity cue',
  })
  const out = jsonCompareExportWithTriageEnvelope(cmp, s) as Record<string, unknown>
  expect(out.pqatExportCompareTriage).toMatchObject({
    comparisonId: 'cmp_test',
    readingThreadLine: 'Continuity cue',
    primaryPairArtifactId: 'pair_x',
  })
  expect(out.comparisonId).toBe('cmp_test')
})

test('injectCompareExportSupplementIntoHtml prepends aside before body when supplement present', () => {
  const s = buildCompareExportTriageSummary(minimalComparison(), null, {
    lead: { headline: 'H', line: 'L' } as CompareLeadTakeaway,
    triageBridgeLine: 'Bridge line',
    continuitySummaryCue: null,
  })
  const html = injectCompareExportSupplementIntoHtml('<html><body><p>x</p></body></html>', s)
  expect(html).toMatch(/<body[^>]*>/)
  expect(html).toContain('pqat-exportTriage--compareSupplement')
  expect(html).toContain('Bridge line')
})

test('injectCompareTriageIntoHtml aliases supplement injector', () => {
  const s = buildCompareExportTriageSummary(minimalComparison(), null, {
    lead: null,
    triageBridgeLine: 'B',
    continuitySummaryCue: null,
  })
  expect(injectCompareTriageIntoHtml('<html><body></body></html>', s)).toContain('compareSupplement')
})
