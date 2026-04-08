import type { OptimizationSuggestion } from '../api/types'

/** Virtual row height hints for grouped optimization lists (Phase 48). */
export const SUGGESTION_LIST_HEADER_ESTIMATE_PX = 36
export const SUGGESTION_LIST_CARD_ESTIMATE_PX = 280

export type SuggestionListVirtualRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'card'; key: string; suggestion: OptimizationSuggestion }

/** Aligns with backend `FamilyFor(category)` snake_case tokens. */
export function inferSuggestionFamilyFromCategory(category: string | undefined): string {
  const c = category ?? ''
  if (c === 'index_experiment') return 'index_experiments'
  if (c === 'statistics_maintenance') return 'statistics_planner_accuracy'
  if (c === 'timescaledb_workload' || c === 'partitioning_chunking') return 'schema_workload_shape'
  if (c === 'observe_before_change') return 'operational_tuning_validation'
  return 'query_shape_ordering'
}

/**
 * Backfill Phase 47 fields when the API omitted them (e.g. live responses or edge cases).
 * Persisted SQLite rows are normalized server-side (Phase 49); this stays as a defensive UI layer.
 */
export function normalizeOptimizationSuggestionForDisplay(s: OptimizationSuggestion): OptimizationSuggestion {
  const suggestionFamily = (s.suggestionFamily?.trim() || inferSuggestionFamilyFromCategory(s.category)) as string
  const v0 = s.validationSteps?.find((x) => x && String(x).trim().length > 0)?.trim()
  const recommendedNextAction =
    s.recommendedNextAction?.trim() || v0 || s.summary?.trim() || 'Review the summary and validation steps for this snapshot.'
  const whyItMatters =
    s.whyItMatters?.trim() ||
    (s.rationale?.trim()
      ? s.rationale.trim()
      : 'This snapshot uses an older suggestion shape; rely on summary, rationale, and validation steps for evidence.')
  const trimmedTargetLabel = s.targetDisplayLabel?.trim()
  const targetDisplayLabelFromApi =
    trimmedTargetLabel && trimmedTargetLabel.length > 0 ? trimmedTargetLabel : undefined
  const firstTargetId = (s.targetNodeIds ?? []).map((x) => String(x).trim()).find((x) => x.length > 0)
  const targetDisplayLabel = targetDisplayLabelFromApi ?? firstTargetId ?? s.targetDisplayLabel ?? null
  return {
    ...s,
    suggestionFamily,
    recommendedNextAction,
    whyItMatters,
    targetDisplayLabel,
    isGroupedCluster: s.isGroupedCluster ?? false,
  }
}

export function normalizeOptimizationSuggestionsForDisplay(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
  return suggestions.map(normalizeOptimizationSuggestionForDisplay)
}

/**
 * Map a URL `suggestion=` query value to the canonical `suggestionId` on a suggestion row.
 *
 * **Phase 49:** matches `suggestionId` or any entry in `alsoKnownAs` from server normalization (carried
 * “After this change:” suggestions may expose a legacy title-derived id; `alsoKnownAs` links it to the
 * stable `suggestionId`).
 *
 * **URL bar vs E2E seed ids:** After hydrate, the Compare page syncs **`suggestion=`** to the
 * **canonical** `suggestionId` whenever the param resolves. The **settled** `sg_*` in the address bar is
 * the durable handle — it may differ from a **seed response’s** `canonicalSuggestionId` field if that
 * field was sampled from a pre-persist object while the loaded artifact’s primary id is the same
 * logical row (alias resolution still highlights the correct row). Prefer asserting **row highlight**
 * + **URL stability on reopen**, not equality to a pre-save id from fixtures.
 */
export function resolveCompareSuggestionParamToCanonicalId(
  suggestions: OptimizationSuggestion[] | null | undefined,
  param: string | null | undefined,
): string | null {
  const p = param?.trim()
  if (!p) return null
  for (const s of suggestions ?? []) {
    if (s.suggestionId === p) return s.suggestionId
    if (s.alsoKnownAs?.some((a) => a === p)) return s.suggestionId
  }
  return null
}

/** Flatten grouped sections into virtual rows (headers + cards) for windowed lists. */
export function flattenGroupedSuggestionsForVirtualList(groups: OptimizationSuggestionGroup[]): SuggestionListVirtualRow[] {
  const out: SuggestionListVirtualRow[] = []
  for (const g of groups) {
    if (g.familyLabel) {
      out.push({ kind: 'header', key: `h-${g.familyKey}`, label: g.familyLabel })
    }
    for (const s of g.items) {
      out.push({ kind: 'card', key: `c-${s.suggestionId}`, suggestion: s })
    }
  }
  return out
}

export function suggestionVirtualRowEstimateSize(row: SuggestionListVirtualRow): number {
  return row.kind === 'header' ? SUGGESTION_LIST_HEADER_ESTIMATE_PX : SUGGESTION_LIST_CARD_ESTIMATE_PX
}

/** Human label for API `suggestionFamily` (Phase 47). */
export function suggestionFamilyLabel(f: string | undefined): string {
  const m: Record<string, string> = {
    index_experiments: 'Index experiments',
    query_shape_ordering: 'Query shape & ordering',
    statistics_planner_accuracy: 'Statistics & planner accuracy',
    schema_workload_shape: 'Schema & workload shape',
    operational_tuning_validation: 'Operational tuning & validation',
  }
  return m[f ?? ''] ?? 'Next steps'
}

export function optimizationCategoryLabel(c: string): string {
  const m: Record<string, string> = {
    index_experiment: 'Index experiment',
    query_rewrite: 'Query rewrite',
    schema_change: 'Schema',
    statistics_maintenance: 'Statistics',
    partitioning_chunking: 'Partition / chunk',
    sort_ordering: 'Sort / order',
    join_strategy: 'Join strategy',
    parallelism: 'Parallelism',
    timescaledb_workload: 'Timescale / chunks',
    observe_before_change: 'Observe / validate',
  }
  return m[c] ?? c.replace(/_/g, ' ')
}

/** Short, human metadata fragment (no "Confidence: high" machine prefix). */
export function suggestionConfidenceShort(c: string): string {
  if (c === 'high') return 'High confidence'
  if (c === 'low') return 'Low confidence'
  return 'Medium confidence'
}

export function suggestionPriorityShort(p: string): string {
  if (p === 'critical') return 'Critical priority'
  if (p === 'high') return 'High priority'
  if (p === 'low') return 'Low priority'
  return 'Medium priority'
}

/** @deprecated Prefer suggestionConfidenceShort + pills; kept for narrow test compatibility. */
export function suggestionConfidenceLabel(c: string): string {
  return suggestionConfidenceShort(c)
}

/** @deprecated Prefer suggestionPriorityShort + pills. */
export function suggestionPriorityLabel(p: string): string {
  return suggestionPriorityShort(p)
}

/** Readable single-line metadata (middle dot separated). */
export function suggestionMetadataSentence(s: OptimizationSuggestion): string {
  const fam = suggestionFamilyLabel(s.suggestionFamily)
  return [fam, suggestionConfidenceShort(s.confidence), suggestionPriorityShort(s.priority)].join(' · ')
}

export type OptimizationSuggestionGroup = {
  familyKey: string
  familyLabel: string
  items: OptimizationSuggestion[]
}

/** Group by `suggestionFamily` when the list is long enough that sections help scanability. */
export function groupOptimizationSuggestionsForUi(
  suggestions: OptimizationSuggestion[],
  opts?: { minItems?: number; minDistinctFamilies?: number },
): OptimizationSuggestionGroup[] {
  const minItems = opts?.minItems ?? 5
  const minDistinct = opts?.minDistinctFamilies ?? 2
  if (suggestions.length < minItems) {
    return [{ familyKey: '_all', familyLabel: '', items: suggestions }]
  }
  const keys = new Set(suggestions.map((s) => s.suggestionFamily ?? 'query_shape_ordering'))
  if (keys.size < minDistinct) {
    return [{ familyKey: '_all', familyLabel: '', items: suggestions }]
  }
  const order = [
    'statistics_planner_accuracy',
    'schema_workload_shape',
    'index_experiments',
    'query_shape_ordering',
    'operational_tuning_validation',
  ]
  const rank = (k: string) => {
    const i = order.indexOf(k)
    return i < 0 ? 99 : i
  }
  const grouped = new Map<string, OptimizationSuggestion[]>()
  for (const s of suggestions) {
    const k = s.suggestionFamily ?? inferSuggestionFamilyFromCategory(s.category)
    const g = grouped.get(k)
    if (g) g.push(s)
    else grouped.set(k, [s])
  }
  return [...grouped.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([familyKey, items]) => ({
      familyKey,
      familyLabel: suggestionFamilyLabel(familyKey),
      items,
    }))
}

const priorityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export function compareSuggestionsByPriority(a: { priority?: string }, b: { priority?: string }): number {
  return (priorityRank[b.priority ?? ''] ?? 0) - (priorityRank[a.priority ?? ''] ?? 0)
}

const confidenceRank: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

/** Sort by leverage: priority, then confidence, then stable title (Phase 82). */
export function sortSuggestionsForLeverage(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
  return [...suggestions].sort((a, b) => {
    const pr = compareSuggestionsByPriority(a, b)
    if (pr !== 0) return pr
    const cr = (confidenceRank[b.confidence ?? ''] ?? 0) - (confidenceRank[a.confidence ?? ''] ?? 0)
    if (cr !== 0) return cr
    return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' })
  })
}

/** High-level lane for scanning cards without raw enum noise (Phase 82). */
export function suggestionActionLaneLabel(category: string | undefined): string {
  const c = category ?? ''
  if (c === 'index_experiment' || c === 'schema_change' || c === 'partitioning_chunking') return 'Experiment'
  if (c === 'statistics_maintenance' || c === 'observe_before_change' || c === 'timescaledb_workload') return 'Validate / observe'
  if (c === 'query_rewrite' || c === 'sort_ordering' || c === 'join_strategy') return 'Shape / rewrite'
  if (c === 'parallelism') return 'Tune parallelism'
  return 'Next step'
}

/** True when the suggestion's first target id is the selected Plan B node (compare sidebar pair). */
export function compareSuggestionAnchorsSelectedPlanB(
  s: OptimizationSuggestion,
  selectedPlanBNodeId: string | null | undefined,
): boolean {
  const id = selectedPlanBNodeId?.trim()
  if (!id) return false
  return (s.targetNodeIds ?? []).some((t) => String(t).trim() === id)
}

export function sortAndGroupSuggestionsForUi(suggestions: OptimizationSuggestion[]): OptimizationSuggestionGroup[] {
  const sorted = sortSuggestionsForLeverage(suggestions)
  const groups = groupOptimizationSuggestionsForUi(sorted)
  return groups.map((g) => ({ ...g, items: sortSuggestionsForLeverage(g.items) }))
}

/** Phase 86: optional scope for copy-for-ticket (Analyze vs Compare vs pinned pair). */
export type SuggestionCopyContext = {
  analysisId?: string | null
  comparisonId?: string | null
  /** When user pinned a mapped pair, include stable pair artifact id in the paste block. */
  pairArtifactId?: string | null
  /** Phase 88: suggestion's Plan B focus matches sidebar selected pair. */
  anchorsSelectedPlanBPair?: boolean
}

function normalizeSuggestionCopyContext(
  ctx?: string | SuggestionCopyContext | null,
): SuggestionCopyContext | null {
  if (ctx == null) return null
  if (typeof ctx === 'string') {
    const aid = ctx.trim()
    return aid ? { analysisId: aid } : null
  }
  return ctx
}

/** Compact multi-line text for tickets/chat (copy button). Pass legacy analysis id string or a {@link SuggestionCopyContext}. */
export function suggestionReferenceText(
  s: OptimizationSuggestion,
  ctx?: string | SuggestionCopyContext | null,
): string {
  const scope = normalizeSuggestionCopyContext(ctx)
  const lines: string[] = []
  const aid = scope?.analysisId?.trim()
  const cid = scope?.comparisonId?.trim()
  if (aid) lines.push(`PQAT analysis: ${aid}`)
  else if (cid) lines.push(`PQAT compare: ${cid}`)
  if (scope?.anchorsSelectedPlanBPair) {
    const tid = (s.targetNodeIds ?? []).map((x) => String(x).trim()).find((x) => x.length > 0)
    if (tid) lines.push(`Pair scope: aligns with selected pair (Plan B node ${tid})`)
  }
  lines.push(`${s.title} [${s.suggestionId}]`)
  lines.push(
    `Family: ${s.suggestionFamily?.trim() || inferSuggestionFamilyFromCategory(s.category)} · Priority: ${s.priority} · Confidence: ${s.confidence}`,
  )
  const next = s.recommendedNextAction?.trim() || s.summary?.trim()
  if (next) lines.push(`Try next: ${next}`)
  const why = s.whyItMatters?.trim() || s.rationale?.trim()
  if (why && why !== next) {
    const clipped = why.length > 400 ? `${why.slice(0, 397)}…` : why
    lines.push(`Why: ${clipped}`)
  }
  const tid = (s.targetNodeIds ?? []).map((x) => String(x).trim()).find((x) => x.length > 0)
  if (tid) lines.push(`Focus node id: ${tid}`)
  const bn = s.relatedBottleneckInsightIds?.[0]?.trim()
  if (bn) lines.push(`Linked bottleneck insight: ${bn}`)
  const pr = scope?.pairArtifactId?.trim()
  if (pr) lines.push(`Pinned pair ref: ${pr}`)
  const fd = (s.relatedFindingDiffIds ?? []).map((x) => String(x).trim()).find((x) => x.length > 0)
  if (fd) lines.push(`Related finding diff: ${fd}`)
  return lines.join('\n')
}

/** True when “Try next” would repeat the summary line verbatim (Phase 82 dedup). */
export function suggestionTryNextDuplicatesSummary(summary: string | undefined, tryNext: string | undefined): boolean {
  const a = summary?.trim().toLowerCase() ?? ''
  const b = tryNext?.trim().toLowerCase() ?? ''
  return a.length > 0 && a === b
}

/** Primary meta chips first so leverage scans before family noise (Phase 82). */
export function suggestionLeverageTier(priority: string | undefined): 'lead' | 'normal' {
  const p = priority ?? ''
  return p === 'critical' || p === 'high' ? 'lead' : 'normal'
}
