/**
 * Phase 40: typed Analyze workspace layout (visibility, section order) — serializable for localStorage + optional server sync.
 */

export const ANALYZE_WORKSPACE_LAYOUT_VERSION = 1 as const

/** Major chrome regions (hide/show). */
export type AnalyzeWorkspaceRegionId = 'capture' | 'summary' | 'workspace' | 'guide' | 'findings' | 'suggestions' | 'selectedNode'

/** Sub-sections inside the Plan guide rail (reorderable). */
export type AnalyzeGuideSectionId =
  | 'selection'
  | 'whatHappened'
  | 'hotspots'
  | 'topFindings'
  | 'nextSteps'
  | 'sourceQuery'

/** Columns in the lower band (reorderable on desktop). */
export type AnalyzeLowerBandColumnId = 'findings' | 'suggestions' | 'selectedNode'

export type AnalyzeWorkspacePresetId = 'balanced' | 'focus' | 'detail'

/** Distinct from page headings / `aria-label`s so tests and assistive tech do not conflate toggles with sections. */
export const analyzeWorkspaceRegionLabels: Record<AnalyzeWorkspaceRegionId, string> = {
  capture: 'Show panel: plan capture',
  summary: 'Show panel: summary & metadata',
  workspace: 'Show panel: plan workspace',
  guide: 'Show panel: plan guide',
  findings: 'Show panel: findings list',
  suggestions: 'Show panel: optimization suggestions',
  selectedNode: 'Show panel: selected node detail',
}

export const analyzeGuideSectionLabels: Record<AnalyzeGuideSectionId, string> = {
  selection: 'Selection snapshot',
  whatHappened: 'What happened',
  hotspots: 'Where to inspect next',
  topFindings: 'Top findings (preview)',
  nextSteps: 'Next steps (preview)',
  sourceQuery: 'Source query',
}

export const analyzeLowerBandLabels: Record<AnalyzeLowerBandColumnId, string> = {
  findings: 'Findings column',
  suggestions: 'Suggestions column',
  selectedNode: 'Selected node column',
}

export type AnalyzeWorkspaceLayoutState = {
  v: typeof ANALYZE_WORKSPACE_LAYOUT_VERSION
  /** When user picks a named preset we store it; custom edits clear this to null. */
  preset: AnalyzeWorkspacePresetId | null
  visibility: Record<AnalyzeWorkspaceRegionId, boolean>
  guideSectionOrder: AnalyzeGuideSectionId[]
  lowerBandOrder: AnalyzeLowerBandColumnId[]
}

const allRegionsTrue = (): Record<AnalyzeWorkspaceRegionId, boolean> => ({
  capture: true,
  summary: true,
  workspace: true,
  guide: true,
  findings: true,
  suggestions: true,
  selectedNode: true,
})

const defaultGuideOrder: AnalyzeGuideSectionId[] = [
  'selection',
  'whatHappened',
  'hotspots',
  'topFindings',
  'nextSteps',
  'sourceQuery',
]

const defaultLower: AnalyzeLowerBandColumnId[] = ['findings', 'suggestions', 'selectedNode']

export function defaultAnalyzeWorkspaceLayout(): AnalyzeWorkspaceLayoutState {
  return {
    v: ANALYZE_WORKSPACE_LAYOUT_VERSION,
    preset: 'balanced',
    visibility: allRegionsTrue(),
    guideSectionOrder: [...defaultGuideOrder],
    lowerBandOrder: [...defaultLower],
  }
}

export const analyzeWorkspacePresets: Record<
  AnalyzeWorkspacePresetId,
  Pick<AnalyzeWorkspaceLayoutState, 'visibility' | 'guideSectionOrder' | 'lowerBandOrder'>
> = {
  balanced: {
    visibility: allRegionsTrue(),
    guideSectionOrder: [...defaultGuideOrder],
    lowerBandOrder: [...defaultLower],
  },
  focus: {
    visibility: {
      ...allRegionsTrue(),
      suggestions: false,
    },
    guideSectionOrder: [...defaultGuideOrder],
    lowerBandOrder: ['findings', 'selectedNode', 'suggestions'],
  },
  detail: {
    visibility: allRegionsTrue(),
    guideSectionOrder: [...defaultGuideOrder],
    lowerBandOrder: ['suggestions', 'findings', 'selectedNode'],
  },
}

export function applyAnalyzeWorkspacePreset(preset: AnalyzeWorkspacePresetId): AnalyzeWorkspaceLayoutState {
  const p = analyzeWorkspacePresets[preset]
  return {
    v: ANALYZE_WORKSPACE_LAYOUT_VERSION,
    preset,
    visibility: { ...p.visibility },
    guideSectionOrder: [...p.guideSectionOrder],
    lowerBandOrder: [...p.lowerBandOrder],
  }
}

function isGuideSectionId(x: unknown): x is AnalyzeGuideSectionId {
  return (
    x === 'selection' ||
    x === 'whatHappened' ||
    x === 'hotspots' ||
    x === 'topFindings' ||
    x === 'nextSteps' ||
    x === 'sourceQuery'
  )
}

function isLowerColumnId(x: unknown): x is AnalyzeLowerBandColumnId {
  return x === 'findings' || x === 'suggestions' || x === 'selectedNode'
}

/** Merge partial / legacy stored JSON with current defaults (new panels default visible). */
export function mergeAnalyzeWorkspaceLayout(raw: unknown): AnalyzeWorkspaceLayoutState {
  const base = defaultAnalyzeWorkspaceLayout()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  const presetRaw = o.preset
  const preset: AnalyzeWorkspacePresetId | null =
    presetRaw === 'balanced' || presetRaw === 'focus' || presetRaw === 'detail' ? presetRaw : null

  const visIn = o.visibility
  const visibility = { ...base.visibility }
  if (visIn && typeof visIn === 'object') {
    for (const k of Object.keys(visibility) as AnalyzeWorkspaceRegionId[]) {
      const val = (visIn as Record<string, unknown>)[k]
      if (typeof val === 'boolean') visibility[k] = val
    }
  }

  let guideSectionOrder = [...base.guideSectionOrder]
  if (Array.isArray(o.guideSectionOrder)) {
    const parsed = o.guideSectionOrder.filter(isGuideSectionId)
    if (parsed.length === defaultGuideOrder.length && new Set(parsed).size === defaultGuideOrder.length) {
      guideSectionOrder = parsed as AnalyzeGuideSectionId[]
    }
  }

  let lowerBandOrder = [...base.lowerBandOrder]
  if (Array.isArray(o.lowerBandOrder)) {
    const parsed = o.lowerBandOrder.filter(isLowerColumnId)
    if (parsed.length === 3 && new Set(parsed).size === 3) {
      lowerBandOrder = parsed as AnalyzeLowerBandColumnId[]
    }
  }

  return {
    v: ANALYZE_WORKSPACE_LAYOUT_VERSION,
    preset,
    visibility,
    guideSectionOrder,
    lowerBandOrder,
  }
}
