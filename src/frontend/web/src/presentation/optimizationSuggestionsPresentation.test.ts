import { describe, expect, it } from 'vitest'
import type { OptimizationSuggestion } from '../api/types'
import {
  compareSuggestionAnchorsSelectedPlanB,
  flattenGroupedSuggestionsForVirtualList,
  groupOptimizationSuggestionsForUi,
  normalizeOptimizationSuggestionForDisplay,
  resolveCompareSuggestionParamToCanonicalId,
  sortSuggestionsForLeverage,
  suggestionActionLaneLabel,
  suggestionConfidenceShort,
  suggestionMetadataSentence,
  suggestionFamilyLabel,
  suggestionReferenceText,
  suggestionTryNextDuplicatesSummary,
} from './optimizationSuggestionsPresentation'

describe('optimizationSuggestionsPresentation', () => {
  it('suggestionReferenceText builds a ticket-friendly block', () => {
    const s = {
      suggestionId: 'sg_x',
      category: 'sort_ordering',
      suggestedActionType: 'review_sort',
      title: 'Review sort inputs',
      summary: 'Short summary',
      details: '',
      rationale: 'Because buffers',
      confidence: 'medium',
      priority: 'high',
      targetNodeIds: ['n1'],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: [],
      suggestionFamily: 'query_shape_ordering',
      recommendedNextAction: 'Try reducing work before the sort',
      whyItMatters: 'Sort spills dominate',
      relatedBottleneckInsightIds: ['bn_1'],
    } as OptimizationSuggestion
    const text = suggestionReferenceText(s, 'analysis-abc')
    expect(text).toContain('PQAT analysis: analysis-abc')
    expect(text).toContain('[sg_x]')
    expect(text).toContain('Try next:')
    expect(text).toContain('Focus node id: n1')
    expect(text).toContain('Linked bottleneck insight: bn_1')
  })

  it('suggestionReferenceText puts scope line before title for stable ticket paste (compare)', () => {
    const s = {
      suggestionId: 'sg_cmp',
      category: 'observe_before_change',
      suggestedActionType: 'validate',
      title: 'Title line',
      summary: 'S',
      details: '',
      rationale: 'R',
      confidence: 'medium',
      priority: 'high',
      targetNodeIds: [],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: [],
      suggestionFamily: 'operational_tuning_validation',
      recommendedNextAction: 'Next',
      whyItMatters: 'W',
    } as OptimizationSuggestion
    const text = suggestionReferenceText(s, { comparisonId: 'cmp-stable' })
    const lines = text.split('\n')
    expect(lines[0]).toBe('PQAT compare: cmp-stable')
    expect(lines[1]).toContain('Title line')
    expect(lines[1]).toContain('[sg_cmp]')
  })

  it('compareSuggestionAnchorsSelectedPlanB matches first target to selected Plan B node', () => {
    const s = {
      suggestionId: 'sg_x',
      category: 'join_strategy',
      suggestedActionType: 'reduce_sort',
      title: 'T',
      summary: 'S',
      details: '',
      rationale: 'R',
      confidence: 'medium',
      priority: 'high',
      targetNodeIds: ['b1', 'other'],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: [],
      suggestionFamily: 'query_shape_ordering',
      recommendedNextAction: 'N',
      whyItMatters: 'W',
    } as OptimizationSuggestion
    expect(compareSuggestionAnchorsSelectedPlanB(s, 'b1')).toBe(true)
    expect(compareSuggestionAnchorsSelectedPlanB(s, 'missing')).toBe(false)
    expect(compareSuggestionAnchorsSelectedPlanB(s, null)).toBe(false)
  })

  it('suggestionReferenceText adds pair scope line when anchorsSelectedPlanBPair is true', () => {
    const s = {
      suggestionId: 'sg_cmp',
      category: 'join_strategy',
      suggestedActionType: 'reduce_sort',
      title: 'Check join order',
      summary: 'S',
      details: '',
      rationale: 'R',
      confidence: 'medium',
      priority: 'high',
      targetNodeIds: ['node-b-9'],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: [],
      suggestionFamily: 'query_shape_ordering',
      recommendedNextAction: 'Probe hash side',
      whyItMatters: 'W',
    } as OptimizationSuggestion
    const text = suggestionReferenceText(s, {
      comparisonId: 'cmp-88',
      anchorsSelectedPlanBPair: true,
    })
    expect(text).toContain('PQAT compare: cmp-88')
    expect(text).toContain('Pair scope: aligns with selected pair (Plan B node node-b-9)')
    expect(text).toContain('Check join order')
  })

  it('suggestionReferenceText supports compare scope, pinned pair, and finding diff', () => {
    const s = {
      suggestionId: 'sg_cmp',
      category: 'join_strategy',
      suggestedActionType: 'reduce_sort',
      title: 'Check join order',
      summary: 'S',
      details: '',
      rationale: 'R',
      confidence: 'medium',
      priority: 'high',
      targetNodeIds: ['b1'],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: [],
      suggestionFamily: 'query_shape_ordering',
      recommendedNextAction: 'Probe hash side',
      whyItMatters: 'W',
      relatedFindingDiffIds: ['fd_9'],
    } as OptimizationSuggestion
    const text = suggestionReferenceText(s, {
      comparisonId: 'cmp-88',
      pairArtifactId: 'pair_z',
    })
    expect(text).toContain('PQAT compare: cmp-88')
    expect(text).toContain('Pinned pair ref: pair_z')
    expect(text).toContain('Related finding diff: fd_9')
  })

  it('uses readable confidence fragments without legacy colon prefix', () => {
    expect(suggestionConfidenceShort('high')).toBe('High confidence')
    expect(suggestionConfidenceShort('high')).not.toMatch(/confidence:/i)
  })

  it('metadata sentence joins family, confidence, priority with middle dots', () => {
    const s = {
      suggestionFamily: 'statistics_planner_accuracy',
      confidence: 'high',
      priority: 'high',
    } as OptimizationSuggestion
    const line = suggestionMetadataSentence(s)
    expect(line).toContain('Statistics & planner accuracy')
    expect(line).toContain('High confidence')
    expect(line).toContain('High priority')
    expect(line).toContain('·')
  })

  it('groups by family when list is long enough', () => {
    const mk = (family: string, id: string): OptimizationSuggestion => ({
      suggestionId: id,
      category: 'index_experiment',
      suggestedActionType: 'create_index_candidate',
      title: 't',
      summary: 's',
      details: '',
      rationale: '',
      confidence: 'medium',
      priority: 'medium',
      targetNodeIds: [],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: [],
      suggestionFamily: family,
      recommendedNextAction: 'a',
      whyItMatters: 'b',
    })

    const items = [
      mk('index_experiments', '1'),
      mk('index_experiments', '2'),
      mk('statistics_planner_accuracy', '3'),
      mk('statistics_planner_accuracy', '4'),
      mk('query_shape_ordering', '5'),
    ]
    const groups = groupOptimizationSuggestionsForUi(items, { minItems: 4, minDistinctFamilies: 2 })
    expect(groups.length).toBeGreaterThanOrEqual(2)
    expect(groups.some((g) => g.familyLabel === suggestionFamilyLabel('index_experiments'))).toBe(true)
  })

  it('flattenGroupedSuggestionsForVirtualList interleaves family headers before cards', () => {
    const groups = [
      { familyKey: 'a', familyLabel: 'Family A', items: [{ suggestionId: '1' } as OptimizationSuggestion] },
      { familyKey: 'b', familyLabel: 'Family B', items: [{ suggestionId: '2' } as OptimizationSuggestion] },
    ]
    const flat = flattenGroupedSuggestionsForVirtualList(groups)
    expect(flat.map((r) => r.kind)).toEqual(['header', 'card', 'header', 'card'])
    expect(flat[0]).toMatchObject({ kind: 'header', label: 'Family A' })
    expect(flat[2]).toMatchObject({ kind: 'header', label: 'Family B' })
  })

  it('normalizeOptimizationSuggestionForDisplay backfills family and readable fields for legacy payloads', () => {
    const legacy = {
      suggestionId: 'sg_legacy',
      category: 'statistics_maintenance',
      suggestedActionType: 'analyze_table',
      title: 'Old title',
      summary: 'Short summary',
      details: '',
      rationale: '',
      confidence: 'medium',
      priority: 'medium',
      targetNodeIds: ['node-b2'],
      relatedFindingIds: [],
      relatedIndexInsightNodeIds: [],
      cautions: [],
      validationSteps: ['Run ANALYZE on the hot table'],
    } as OptimizationSuggestion
    const n = normalizeOptimizationSuggestionForDisplay(legacy)
    expect(n.suggestionFamily).toBe('statistics_planner_accuracy')
    expect(n.recommendedNextAction).toContain('ANALYZE')
    expect((n.whyItMatters ?? '').length).toBeGreaterThan(10)
    expect(n.targetDisplayLabel).toBe('node-b2')
  })

  it('sortSuggestionsForLeverage orders by priority then confidence', () => {
    const mk = (id: string, priority: string, confidence: string): OptimizationSuggestion =>
      ({
        suggestionId: id,
        category: 'observe_before_change',
        suggestedActionType: 'validate',
        title: id,
        summary: 's',
        details: '',
        rationale: '',
        confidence,
        priority,
        targetNodeIds: [],
        relatedFindingIds: [],
        relatedIndexInsightNodeIds: [],
        cautions: [],
        validationSteps: [],
      }) as OptimizationSuggestion
    const sorted = sortSuggestionsForLeverage([mk('low', 'low', 'high'), mk('crit', 'critical', 'low'), mk('mid', 'medium', 'high')])
    expect(sorted.map((s) => s.suggestionId)).toEqual(['crit', 'mid', 'low'])
  })

  it('suggestionTryNextDuplicatesSummary detects identical summary and try line', () => {
    expect(suggestionTryNextDuplicatesSummary('Same text', 'Same text')).toBe(true)
    expect(suggestionTryNextDuplicatesSummary('A', 'B')).toBe(false)
  })

  it('suggestionActionLaneLabel maps categories to scan-friendly lanes', () => {
    expect(suggestionActionLaneLabel('index_experiment')).toBe('Experiment')
    expect(suggestionActionLaneLabel('observe_before_change')).toBe('Validate / observe')
  })

  it('resolveCompareSuggestionParamToCanonicalId maps alsoKnownAs to suggestionId', () => {
    const suggestions = [
      {
        suggestionId: 'sg_canonical',
        alsoKnownAs: ['sg_legacy'],
        category: 'observe_before_change',
        suggestedActionType: 'validate_with_explain_analyze',
        title: 't',
        summary: 's',
        details: '',
        rationale: '',
        confidence: 'medium',
        priority: 'medium',
        targetNodeIds: [],
        relatedFindingIds: [],
        relatedIndexInsightNodeIds: [],
        cautions: [],
        validationSteps: [],
      } as OptimizationSuggestion,
    ]
    expect(resolveCompareSuggestionParamToCanonicalId(suggestions, 'sg_legacy')).toBe('sg_canonical')
    expect(resolveCompareSuggestionParamToCanonicalId(suggestions, 'sg_canonical')).toBe('sg_canonical')
    expect(resolveCompareSuggestionParamToCanonicalId(suggestions, 'missing')).toBeNull()
  })
})
