import { describe, expect, it } from 'vitest'
import type { OptimizationSuggestion, PlanAnalysisResult } from '../api/types'
import {
  analyzeFollowUpScanSignals,
  analyzeTakeawayFromResult,
  buildAnalyzeTriageBundle,
  filterTriageEchoScanLabels,
  firstVirtualRowIndexAlignedWithAnalyzeTriage,
  suggestionAlignsWithAnalyzeTriage,
} from './analyzeOutputGuidance'
import type { SuggestionListVirtualRow } from './optimizationSuggestionsPresentation'

function baseAnalysis(over: Partial<PlanAnalysisResult>): PlanAnalysisResult {
  return {
    analysisId: 'a',
    rootNodeId: 'n0',
    queryText: null,
    nodes: [],
    findings: [],
    narrative: {
      whatHappened: '',
      whereTimeWent: '',
      whatLikelyMatters: '',
      whatProbablyDoesNotMatter: '',
    },
    summary: {
      totalNodeCount: 1,
      maxDepth: 0,
      hasActualTiming: false,
      hasBuffers: false,
      plannerCosts: 'unknown',
      rootInclusiveActualTimeMs: null,
      topExclusiveTimeHotspotNodeIds: [],
      topInclusiveTimeHotspotNodeIds: [],
      topSharedReadHotspotNodeIds: [],
      severeFindingsCount: 0,
      warnings: [],
    },
    indexOverview: null,
    indexInsights: [],
    optimizationSuggestions: [],
    ...over,
  } as unknown as PlanAnalysisResult
}

describe('analyzeTakeawayFromResult', () => {
  it('prefers highest-severity finding', () => {
    const a = baseAnalysis({
      findings: [
        {
          findingId: 'f1',
          ruleId: 'r1',
          severity: 1,
          confidence: 1,
          category: 0,
          title: 'Low priority',
          summary: 'low sum',
          explanation: '',
          evidence: {},
          suggestion: '',
          nodeIds: ['n1'],
        },
        {
          findingId: 'f2',
          ruleId: 'r2',
          severity: 3,
          confidence: 1,
          category: 0,
          title: 'Hot path concern',
          summary: 'Rows misestimated on scan.',
          explanation: '',
          evidence: {},
          suggestion: 'Check stats',
          nodeIds: ['n2'],
        },
      ],
    })
    const t = analyzeTakeawayFromResult(a)
    expect(t?.headline).toBe('Hot path concern')
    expect(t?.supportingLine).toContain('misestimated')
    expect(t?.focusNodeId).toBe('n2')
    expect(t?.primaryFindingId).toBe('f2')
  })

  it('falls back to first inspect step when no findings', () => {
    const a = baseAnalysis({
      planStory: {
        planOverview: 'Overview text',
        workConcentration: 'w',
        likelyExpenseDrivers: 'd',
        executionShape: '',
        inspectFirstPath: '',
        inspectFirstSteps: [{ stepNumber: 1, title: 'Open the scan', body: 'Check filters on users.', focusNodeId: 'n9' }],
        propagationBeats: [],
        indexShapeNote: '',
      },
    })
    const t = analyzeTakeawayFromResult(a)
    expect(t?.headline).toBe('Open the scan')
    expect(t?.focusNodeId).toBe('n9')
    expect(t?.primaryFindingId).toBeUndefined()
  })
})

describe('buildAnalyzeTriageBundle', () => {
  it('keeps scan signals aligned with takeaway primary id', () => {
    const a = baseAnalysis({
      findings: [
        {
          findingId: 'f1',
          ruleId: 'r1',
          severity: 3,
          confidence: 1,
          category: 0,
          title: 'Top',
          summary: 'x',
          explanation: '',
          evidence: {},
          suggestion: '',
          nodeIds: ['n1'],
        },
        {
          findingId: 'f2',
          ruleId: 'r2',
          severity: 2,
          confidence: 1,
          category: 0,
          title: 'Second',
          summary: 'y',
          explanation: '',
          evidence: {},
          suggestion: '',
          nodeIds: ['n2'],
        },
      ],
    })
    const b = buildAnalyzeTriageBundle(a)
    expect(b.takeaway?.primaryFindingId).toBe('f1')
    expect(b.scanSignals.map((s) => s.findingId)).toEqual(['f2'])
  })
})

describe('analyzeFollowUpScanSignals', () => {
  it('returns next findings after primary id', () => {
    const a = baseAnalysis({
      findings: [
        {
          findingId: 'f1',
          ruleId: 'r1',
          severity: 1,
          confidence: 1,
          category: 0,
          title: 'Low priority',
          summary: 'x',
          explanation: '',
          evidence: {},
          suggestion: '',
          nodeIds: ['n1'],
        },
        {
          findingId: 'f2',
          ruleId: 'r2',
          severity: 3,
          confidence: 1,
          category: 0,
          title: 'Hot path concern',
          summary: 'y',
          explanation: '',
          evidence: {},
          suggestion: '',
          nodeIds: ['n2'],
        },
        {
          findingId: 'f3',
          ruleId: 'r3',
          severity: 2,
          confidence: 1,
          category: 0,
          title: 'Medium item',
          summary: 'z',
          explanation: '',
          evidence: {},
          suggestion: '',
          nodeIds: ['n3'],
        },
      ],
    })
    const sig = analyzeFollowUpScanSignals(a, 'f2', 2)
    expect(sig.map((s) => s.findingId)).toEqual(['f3', 'f1'])
  })
})

describe('suggestionAlignsWithAnalyzeTriage', () => {
  const sg = (over: Partial<OptimizationSuggestion>): OptimizationSuggestion =>
    ({
      suggestionId: 's1',
      category: 'index_experiment',
      suggestedActionType: 'x',
      title: 't',
      summary: 'sum',
      details: '',
      rationale: '',
      confidence: 'high',
      priority: 'high',
      targetNodeIds: [],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: [],
      ...over,
    }) as OptimizationSuggestion

  it('is true when relatedFindingIds includes primary finding', () => {
    expect(
      suggestionAlignsWithAnalyzeTriage(sg({ relatedFindingIds: ['f-top'] }), {
        primaryFindingId: 'f-top',
        triageFocusNodeId: null,
        primaryFindingNodeIds: [],
      }),
    ).toBe(true)
  })

  it('is true when a target node matches triage focus', () => {
    expect(
      suggestionAlignsWithAnalyzeTriage(sg({ targetNodeIds: ['n-focus'] }), {
        primaryFindingId: null,
        triageFocusNodeId: 'n-focus',
        primaryFindingNodeIds: null,
      }),
    ).toBe(true)
  })

  it('is true when targets overlap primary finding node ids', () => {
    expect(
      suggestionAlignsWithAnalyzeTriage(sg({ targetNodeIds: ['n99'], relatedFindingIds: [] }), {
        primaryFindingId: 'f1',
        triageFocusNodeId: 'other',
        primaryFindingNodeIds: ['n99', 'n100'],
      }),
    ).toBe(true)
  })

  it('is false without evidence overlap', () => {
    expect(
      suggestionAlignsWithAnalyzeTriage(sg({ targetNodeIds: ['z'], relatedFindingIds: [] }), {
        primaryFindingId: 'f1',
        triageFocusNodeId: 'x',
        primaryFindingNodeIds: ['a'],
      }),
    ).toBe(false)
  })
})

describe('firstVirtualRowIndexAlignedWithAnalyzeTriage', () => {
  const card = (id: string, related: string[]): SuggestionListVirtualRow => ({
    kind: 'card',
    key: `c-${id}`,
    suggestion: {
      suggestionId: id,
      category: 'index_experiment',
      suggestedActionType: 'x',
      title: 't',
      summary: 's',
      details: '',
      rationale: '',
      confidence: 'high',
      priority: 'high',
      targetNodeIds: [],
      relatedFindingIds: related,
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: [],
    } as OptimizationSuggestion,
  })

  it('returns index of first aligned card after headers', () => {
    const rows = [
      { kind: 'header' as const, key: 'h1', label: 'G' },
      card('s1', []),
      card('s2', ['f-top']),
    ]
    const idx = firstVirtualRowIndexAlignedWithAnalyzeTriage(rows, {
      primaryFindingId: 'f-top',
      triageFocusNodeId: null,
      primaryFindingNodeIds: null,
    })
    expect(idx).toBe(2)
  })

  it('returns -1 when no card aligns', () => {
    const rows = [{ kind: 'header' as const, key: 'h1', label: 'G' }, card('s1', [])]
    expect(
      firstVirtualRowIndexAlignedWithAnalyzeTriage(rows, {
        primaryFindingId: 'other',
        triageFocusNodeId: null,
        primaryFindingNodeIds: null,
      }),
    ).toBe(-1)
  })
})

describe('filterTriageEchoScanLabels', () => {
  it('drops scan labels that repeat the Start here headline', () => {
    const takeaway = { headline: 'Seq scan concern', supportingLine: '…' }
    expect(filterTriageEchoScanLabels(['Seq scan concern', 'Other signal'], takeaway)).toEqual(['Other signal'])
  })

  it('treats headline match as case- and whitespace-insensitive', () => {
    const takeaway = { headline: 'Hot Path', supportingLine: '…' }
    expect(filterTriageEchoScanLabels(['hot  path', 'Z'], takeaway)).toEqual(['Z'])
  })

  it('drops scan labels that only extend the same opening phrase as the headline', () => {
    const takeaway = {
      headline: 'Seq scan concern on public.shipments',
      supportingLine: '…',
    }
    expect(
      filterTriageEchoScanLabels(
        ['Seq scan concern on public.shipments (detail)', 'Other signal'],
        takeaway,
      ),
    ).toEqual(['Other signal'])
  })

  it('keeps scan labels that diverge from the headline within the headline length', () => {
    const takeaway = {
      headline: 'Hot path on lineitems',
      supportingLine: '…',
    }
    expect(filterTriageEchoScanLabels(['Buffer read on orders', 'Z'], takeaway)).toEqual(['Buffer read on orders', 'Z'])
  })
})
