import { describe, expect, it } from 'vitest'
import type { OptimizationSuggestion } from '../api/types'
import {
  flattenGroupedSuggestionsForVirtualList,
  groupOptimizationSuggestionsForUi,
  normalizeOptimizationSuggestionForDisplay,
  resolveCompareSuggestionParamToCanonicalId,
  suggestionConfidenceShort,
  suggestionMetadataSentence,
  suggestionFamilyLabel,
} from './optimizationSuggestionsPresentation'

describe('optimizationSuggestionsPresentation', () => {
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
