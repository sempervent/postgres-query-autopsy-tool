/**
 * Phase 41: Compare workspace layout — mirrors Analyze workspace patterns (visibility, section order, persistence v1).
 */

export const COMPARE_WORKSPACE_LAYOUT_VERSION = 1 as const

export type CompareWorkspaceRegionId =
  | 'intro'
  | 'input'
  | 'topChanges'
  | 'summaryCards'
  | 'summaryCaptureContext'
  | 'summaryIndexChanges'
  | 'summaryCompareSuggestions'
  | 'summaryMeta'
  | 'worsenedImproved'
  | 'findingsDiff'
  | 'unmatchedNodes'
  | 'branchStrip'
  | 'selectedPair'

export type CompareSummarySectionId =
  | 'summaryCards'
  | 'summaryCaptureContext'
  | 'summaryIndexChanges'
  | 'summaryCompareSuggestions'
  | 'summaryMeta'

export type CompareLeftStackId = 'worsenedImproved' | 'findingsDiff' | 'unmatchedNodes'

export type CompareMainColumnId = 'navigator' | 'pair'

export type CompareWorkspacePresetId = 'balanced' | 'review' | 'diffHeavy' | 'compact' | 'wideGraph'

export type CompareWorkspaceLayoutState = {
  v: typeof COMPARE_WORKSPACE_LAYOUT_VERSION
  preset: CompareWorkspacePresetId | null
  visibility: Record<CompareWorkspaceRegionId, boolean>
  /** Blocks inside the summary column (first row, left). */
  summarySectionOrder: CompareSummarySectionId[]
  /** Blocks inside the navigator column (worsened/improved, findings diff, unmatched). */
  leftStackOrder: CompareLeftStackId[]
  /** Desktop: two columns — navigator vs branch+selected pair. */
  mainColumnOrder: [CompareMainColumnId, CompareMainColumnId]
}

export const compareWorkspaceRegionLabels: Record<CompareWorkspaceRegionId, string> = {
  intro: 'Show panel: Compare intro',
  input: 'Show panel: plan inputs & Compare',
  topChanges: 'Show panel: what changed most',
  summaryCards: 'Show panel: summary metric cards',
  summaryCaptureContext: 'Show panel: plan capture / EXPLAIN (A vs B)',
  summaryIndexChanges: 'Show panel: index changes (summary)',
  summaryCompareSuggestions: 'Show panel: next steps (summary)',
  summaryMeta: 'Show panel: findings counts & narrative',
  worsenedImproved: 'Show panel: worsened / improved lists',
  findingsDiff: 'Show panel: findings diff',
  unmatchedNodes: 'Show panel: unmatched nodes',
  branchStrip: 'Show panel: branch context strip',
  selectedPair: 'Show panel: selected pair detail',
}

export const compareSummarySectionLabels: Record<CompareSummarySectionId, string> = {
  summaryCards: 'Summary cards & share',
  summaryCaptureContext: 'Plan capture / EXPLAIN context',
  /** Wording distinct from on-page "Index changes" heading (avoids duplicate text in Customize UI). */
  summaryIndexChanges: 'Summary column · index block',
  summaryCompareSuggestions: 'Compare next steps (top)',
  summaryMeta: 'Findings line & narrative',
}

export const compareLeftStackLabels: Record<CompareLeftStackId, string> = {
  worsenedImproved: 'Worsened / improved navigator',
  findingsDiff: 'Findings diff list',
  unmatchedNodes: 'Unmatched nodes',
}

const allVis = (): Record<CompareWorkspaceRegionId, boolean> => ({
  intro: true,
  input: true,
  topChanges: true,
  summaryCards: true,
  summaryCaptureContext: true,
  summaryIndexChanges: true,
  summaryCompareSuggestions: true,
  summaryMeta: true,
  worsenedImproved: true,
  findingsDiff: true,
  unmatchedNodes: true,
  branchStrip: true,
  selectedPair: true,
})

const defaultSummaryOrder: CompareSummarySectionId[] = [
  'summaryCards',
  'summaryCaptureContext',
  'summaryIndexChanges',
  'summaryCompareSuggestions',
  'summaryMeta',
]

const defaultLeft: CompareLeftStackId[] = ['worsenedImproved', 'findingsDiff', 'unmatchedNodes']

export function defaultCompareWorkspaceLayout(): CompareWorkspaceLayoutState {
  return {
    v: COMPARE_WORKSPACE_LAYOUT_VERSION,
    preset: 'balanced',
    visibility: allVis(),
    summarySectionOrder: [...defaultSummaryOrder],
    leftStackOrder: [...defaultLeft],
    mainColumnOrder: ['navigator', 'pair'],
  }
}

export const compareWorkspacePresets: Record<
  CompareWorkspacePresetId,
  Pick<
    CompareWorkspaceLayoutState,
    'visibility' | 'summarySectionOrder' | 'leftStackOrder' | 'mainColumnOrder'
  >
> = {
  balanced: {
    visibility: allVis(),
    summarySectionOrder: [...defaultSummaryOrder],
    leftStackOrder: [...defaultLeft],
    mainColumnOrder: ['navigator', 'pair'],
  },
  review: {
    visibility: { ...allVis(), intro: false, summaryCompareSuggestions: false },
    summarySectionOrder: [...defaultSummaryOrder],
    leftStackOrder: [...defaultLeft],
    mainColumnOrder: ['pair', 'navigator'],
  },
  diffHeavy: {
    visibility: allVis(),
    summarySectionOrder: [...defaultSummaryOrder],
    leftStackOrder: ['findingsDiff', 'worsenedImproved', 'unmatchedNodes'],
    mainColumnOrder: ['navigator', 'pair'],
  },
  compact: {
    visibility: {
      ...allVis(),
      intro: false,
      summaryCaptureContext: false,
      unmatchedNodes: false,
      summaryMeta: false,
    },
    summarySectionOrder: [...defaultSummaryOrder],
    /** Keep full permutation so merge/persist round-trips (unmatched hidden via visibility). */
    leftStackOrder: ['worsenedImproved', 'findingsDiff', 'unmatchedNodes'],
    mainColumnOrder: ['navigator', 'pair'],
  },
  wideGraph: {
    visibility: { ...allVis(), intro: false },
    summarySectionOrder: [...defaultSummaryOrder],
    leftStackOrder: [...defaultLeft],
    mainColumnOrder: ['pair', 'navigator'],
  },
}

export function applyCompareWorkspacePreset(preset: CompareWorkspacePresetId): CompareWorkspaceLayoutState {
  const p = compareWorkspacePresets[preset]
  return {
    v: COMPARE_WORKSPACE_LAYOUT_VERSION,
    preset,
    visibility: { ...p.visibility },
    summarySectionOrder: [...p.summarySectionOrder],
    leftStackOrder: [...p.leftStackOrder],
    mainColumnOrder: [...p.mainColumnOrder] as [CompareMainColumnId, CompareMainColumnId],
  }
}

function isSummarySection(x: unknown): x is CompareSummarySectionId {
  return (
    x === 'summaryCards' ||
    x === 'summaryCaptureContext' ||
    x === 'summaryIndexChanges' ||
    x === 'summaryCompareSuggestions' ||
    x === 'summaryMeta'
  )
}

function isLeftStack(x: unknown): x is CompareLeftStackId {
  return x === 'worsenedImproved' || x === 'findingsDiff' || x === 'unmatchedNodes'
}

function isMainCol(x: unknown): x is CompareMainColumnId {
  return x === 'navigator' || x === 'pair'
}

export function coerceCompareSummarySectionOrder(candidate: readonly string[]): CompareSummarySectionId[] | null {
  const parsed = candidate.filter(isSummarySection)
  if (parsed.length !== defaultSummaryOrder.length || new Set(parsed).size !== defaultSummaryOrder.length) return null
  return parsed as CompareSummarySectionId[]
}

export function coerceCompareLeftStackOrder(candidate: readonly string[]): CompareLeftStackId[] | null {
  const parsed = candidate.filter(isLeftStack)
  if (parsed.length !== defaultLeft.length || new Set(parsed).size !== defaultLeft.length) return null
  return parsed as CompareLeftStackId[]
}

function isComparePresetId(x: unknown): x is CompareWorkspacePresetId {
  return x === 'balanced' || x === 'review' || x === 'diffHeavy' || x === 'compact' || x === 'wideGraph'
}

export function mergeCompareWorkspaceLayout(raw: unknown): CompareWorkspaceLayoutState {
  const base = defaultCompareWorkspaceLayout()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  const presetRaw = o.preset
  const preset: CompareWorkspacePresetId | null = isComparePresetId(presetRaw) ? presetRaw : null

  const visibility = { ...base.visibility }
  const visIn = o.visibility
  if (visIn && typeof visIn === 'object') {
    for (const k of Object.keys(visibility) as CompareWorkspaceRegionId[]) {
      const val = (visIn as Record<string, unknown>)[k]
      if (typeof val === 'boolean') visibility[k] = val
    }
  }

  let summarySectionOrder = [...base.summarySectionOrder]
  if (Array.isArray(o.summarySectionOrder)) {
    const coerced = coerceCompareSummarySectionOrder(o.summarySectionOrder as string[])
    if (coerced) summarySectionOrder = coerced
  }

  let leftStackOrder = [...base.leftStackOrder]
  if (Array.isArray(o.leftStackOrder)) {
    const coerced = coerceCompareLeftStackOrder(o.leftStackOrder as string[])
    if (coerced) leftStackOrder = coerced
  }

  let mainColumnOrder: [CompareMainColumnId, CompareMainColumnId] = [...base.mainColumnOrder]
  if (Array.isArray(o.mainColumnOrder) && o.mainColumnOrder.length === 2) {
    const a = o.mainColumnOrder[0]
    const b = o.mainColumnOrder[1]
    if (isMainCol(a) && isMainCol(b) && a !== b) {
      mainColumnOrder = [a, b]
    }
  }

  return {
    v: COMPARE_WORKSPACE_LAYOUT_VERSION,
    preset,
    visibility,
    summarySectionOrder,
    leftStackOrder,
    mainColumnOrder,
  }
}
