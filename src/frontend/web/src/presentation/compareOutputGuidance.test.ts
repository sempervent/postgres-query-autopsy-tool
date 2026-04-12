import { expect, test } from 'vitest'
import type { NodePairDetail, PlanComparisonResult } from '../api/types'
import {
  compareFollowUpDiffSignals,
  compareLeadTakeaway,
  compareTriagePairBridgeLine,
  resolveComparePairFallbackDisplay,
} from './compareOutputGuidance'

test('compareLeadTakeaway surfaces overview', () => {
  const c = {
    comparisonStory: { overview: '  Plan B is faster at the root.  ' },
  } as PlanComparisonResult
  const lead = compareLeadTakeaway(c)
  expect(lead?.headline).toBe('Change at a glance')
  expect(lead?.line).toContain('faster')
})

test('compareLeadTakeaway returns null without overview', () => {
  expect(compareLeadTakeaway({ comparisonStory: {} } as PlanComparisonResult)).toBeNull()
})

test('compareFollowUpDiffSignals prefers New over Resolved', () => {
  const c = {
    findingsDiff: {
      items: [
        { changeType: 'Resolved', title: 'Old noise', diffId: 'fd_r' },
        { changeType: 'New', title: 'Fresh regression', diffId: 'fd_n' },
      ],
    },
  } as PlanComparisonResult
  const sig = compareFollowUpDiffSignals(c, 2)
  expect(sig[0]!.title).toContain('Fresh')
  expect(sig[0]!.diffId).toBe('fd_n')
})

const pairAb = (extra: Partial<NodePairDetail> = {}): NodePairDetail =>
  ({
    pairArtifactId: 'pair_x',
    identity: {
      nodeIdA: 'na',
      nodeIdB: 'nb',
      nodeTypeA: 'Seq Scan',
      nodeTypeB: 'Index Scan',
      depthA: 1,
      depthB: 1,
      matchConfidence: 'High',
      matchScore: 1,
      scoreBreakdown: {},
    },
    rawFields: {},
    metrics: [],
    findings: { findingsA: [], findingsB: [], relatedDiffItems: [] },
    indexDeltaCues: [],
    corroborationCues: [],
    ...extra,
  }) as NodePairDetail

test('compareTriagePairBridgeLine ties pinned finding diff to same pair', () => {
  const c = {
    matches: [{ nodeIdA: 'na', nodeIdB: 'nb' }],
    findingsDiff: {
      items: [{ changeType: 'Worsened', title: 'Seq heavier', diffId: 'fd_1', nodeIdA: 'na', nodeIdB: 'nb', ruleId: 'r', summary: '' }],
    },
    topWorsenedNodes: [],
    topImprovedNodes: [],
  } as unknown as PlanComparisonResult
  const line = compareTriagePairBridgeLine(c, pairAb(), {
    highlightFindingDiffId: 'fd_1',
    highlightIndexInsightDiffId: null,
    highlightSuggestionId: null,
  })
  expect(line).toContain('highlighted finding change')
  expect(line).toContain('Seq heavier')
})

test('compareTriagePairBridgeLine ties change story beat pair to selection', () => {
  const c = {
    matches: [],
    findingsDiff: { items: [] },
    topWorsenedNodes: [],
    topImprovedNodes: [],
    comparisonStory: {
      overview: 'x',
      changeBeats: [{ text: 'beat', focusNodeIdA: 'na', focusNodeIdB: 'nb', pairAnchorLabel: 'join' }],
    },
  } as unknown as PlanComparisonResult
  const line = compareTriagePairBridgeLine(c, pairAb(), {
    highlightFindingDiffId: null,
    highlightIndexInsightDiffId: null,
    highlightSuggestionId: null,
  })
  expect(line).toContain('change story')
})

test('compareTriagePairBridgeLine names top worsened when it matches selection', () => {
  const c = {
    matches: [],
    findingsDiff: { items: [] },
    topWorsenedNodes: [{ nodeIdA: 'na', nodeIdB: 'nb' }],
    topImprovedNodes: [],
  } as unknown as PlanComparisonResult
  const line = compareTriagePairBridgeLine(c, pairAb(), {
    highlightFindingDiffId: null,
    highlightIndexInsightDiffId: null,
    highlightSuggestionId: null,
  })
  expect(line).toContain('top worsened')
})

test('resolveComparePairFallbackDisplay returns null when bridge present', () => {
  expect(resolveComparePairFallbackDisplay('Bridge line', 'cue')).toBeNull()
})

test('resolveComparePairFallbackDisplay uses Reading thread label for specific cues', () => {
  const out = resolveComparePairFallbackDisplay(null, 'Sequential scan on orders replaced by index scan on Plan B')
  expect(out?.label).toBe('Reading thread')
  expect(out?.body).toContain('Sequential scan')
})

test('resolveComparePairFallbackDisplay omits vague short cues (no filler panel)', () => {
  expect(resolveComparePairFallbackDisplay(null, 'vague')).toBeNull()
})

test('resolveComparePairFallbackDisplay shows Reading thread for short outcome + plan vocabulary', () => {
  const out = resolveComparePairFallbackDisplay(null, 'Plan B index scan faster than Plan A seq scan at root')
  expect(out?.label).toBe('Reading thread')
  expect(out?.body).toContain('faster')
})

test('resolveComparePairFallbackDisplay returns null for empty cue', () => {
  expect(resolveComparePairFallbackDisplay(null, '   ')).toBeNull()
})

test('resolveComparePairFallbackDisplay treats whitespace-only bridge as absent', () => {
  const out = resolveComparePairFallbackDisplay(' \t', 'Plan B index scan faster than Plan A seq scan at root')
  expect(out?.label).toBe('Reading thread')
})
