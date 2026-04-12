import { useEffect, useMemo, useRef } from 'react'
import type { AnalyzedPlanNode, OptimizationSuggestion, PlanBottleneckInsight } from '../../api/types'
import {
  firstVirtualRowIndexAlignedWithAnalyzeTriage,
  suggestionAlignsWithAnalyzeTriage,
} from '../../presentation/analyzeOutputGuidance'
import { bottleneckClassShortLabel } from '../../presentation/bottleneckPresentation'
import {
  flattenGroupedSuggestionsForVirtualList,
  normalizeOptimizationSuggestionsForDisplay,
  optimizationCategoryLabel,
  sortAndGroupSuggestionsForUi,
  suggestionActionLaneLabel,
  suggestionConfidenceShort,
  suggestionFamilyLabel,
  suggestionLeverageTier,
  suggestionPriorityShort,
  suggestionReferenceText,
  suggestionTryNextDuplicatesSummary,
  suggestionVirtualRowEstimateSize,
} from '../../presentation/optimizationSuggestionsPresentation'
import { useCopyFeedback } from '../../presentation/useCopyFeedback'
import { VirtualizedListColumn, VIRTUAL_LIST_THRESHOLD, type VirtualizedListColumnHandle } from '../VirtualizedListColumn'

const SUGGEST_VIRTUAL_THRESHOLD = Math.max(12, VIRTUAL_LIST_THRESHOLD - 24)

function SuggestionCardBody(props: {
  s: OptimizationSuggestion
  expanded: boolean
  setExpandedOptimizationId: (id: string | null) => void
  jumpToNodeId: (id: string) => void
  byId: Map<string, AnalyzedPlanNode>
  nodeLabel: (n: AnalyzedPlanNode) => string
  bottleneckByInsightId: Map<string, PlanBottleneckInsight>
  isTopLeverageCard: boolean
  /** Evidence-aligned with summary “Start here” (finding link, focus node, or shared target nodes). */
  alignsWithStartHere: boolean
  /** Single card: first list row that matches triage for scroll-into-view / browser tests. */
  isTriageScrollTarget?: boolean
  analysisId?: string | null
  copySuggestion: ReturnType<typeof useCopyFeedback>
}) {
  const {
    s,
    expanded,
    setExpandedOptimizationId,
    jumpToNodeId,
    byId,
    nodeLabel,
    bottleneckByInsightId,
    isTopLeverageCard,
    alignsWithStartHere,
    isTriageScrollTarget = false,
    analysisId,
    copySuggestion,
  } = props
  const linkedBottleneckId = (s.relatedBottleneckInsightIds ?? [])[0]
  const linkedBottleneck = linkedBottleneckId ? bottleneckByInsightId.get(linkedBottleneckId) : undefined
  const bottleneckFocusNodeId = linkedBottleneck?.nodeIds?.[0]
  const target = (s.targetNodeIds ?? [])[0]
  const derivedTargetLabel = target && byId.get(target) ? nodeLabel(byId.get(target)!) : target
  const focusLabel = (s.targetDisplayLabel ?? derivedTargetLabel ?? target)?.trim() || 'node'
  const nextAction = s.recommendedNextAction ?? s.summary
  const why = s.whyItMatters ?? s.rationale
  const tryDup = suggestionTryNextDuplicatesSummary(s.summary, nextAction)
  const priChipClass =
    suggestionLeverageTier(s.priority) === 'lead' ? 'pqat-chip pqat-chip--suggestionMeta pqat-chip--leverageLead' : 'pqat-chip pqat-chip--suggestionMeta'

  return (
    <div
      className={`pqat-listRow pqat-listRow--suggestion pqat-workspaceReveal${isTopLeverageCard ? ' pqat-suggestionCard--topLead' : ''}`}
      style={{ padding: 14 }}
      data-testid={isTriageScrollTarget ? 'analyze-suggestion-card-triage-aligned' : undefined}
    >
      {s.isGroupedCluster ? (
        <div className="pqat-suggestionGroupedBadge" title="Merged from multiple overlapping findings">
          Combined suggestion
        </div>
      ) : null}
      {isTopLeverageCard ? (
        <div className="pqat-hint" style={{ fontSize: 11, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Strongest next experiment
        </div>
      ) : null}
      {alignsWithStartHere ? (
        <div
          className="pqat-triageSuggestionCue"
          data-testid="analyze-suggestion-triage-match"
          title="Targets the same evidence thread as Start here"
        >
          Aligned with Start here
        </div>
      ) : null}
      <div className="pqat-guidedSuggestion">
        <div style={{ fontWeight: 750, fontSize: '0.9375rem', lineHeight: 1.35, color: 'var(--text-h)' }}>{s.title}</div>
        <div className="pqat-suggestionFamilyHint" title="Grouped with similar suggestions when the list is long">
          {suggestionFamilyLabel(s.suggestionFamily)} · {suggestionActionLaneLabel(s.category)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <span className={priChipClass} title="Leverage vs other cards in this snapshot">
            {suggestionPriorityShort(s.priority)}
          </span>
          <span className="pqat-chip pqat-chip--suggestionMeta" title="Evidence strength">
            {suggestionConfidenceShort(s.confidence)}
          </span>
          <span className="pqat-chip pqat-chip--suggestionMeta" title="Engine category (technical)">
            {optimizationCategoryLabel(s.category)}
          </span>
          {bottleneckFocusNodeId && linkedBottleneck ? (
            <button
              type="button"
              className="pqat-chip pqat-chip--suggestionMeta"
              title="Open the ranked bottleneck anchor in the plan graph"
              aria-label={`Jump to bottleneck rank ${linkedBottleneck.rank} in plan`}
              onClick={() => jumpToNodeId(bottleneckFocusNodeId)}
              style={{ cursor: 'pointer' }}
            >
              Bottleneck #{linkedBottleneck.rank} · {bottleneckClassShortLabel(linkedBottleneck.bottleneckClass)}
            </button>
          ) : null}
        </div>
        {!tryDup ? (
          <div className="pqat-signalLine pqat-signalLine--tryFirst" style={{ marginTop: 12 }}>
            <span className="pqat-signalLine__label">Try next</span>
            <div className="pqat-signalLine__text">{nextAction}</div>
          </div>
        ) : null}
        <div style={{ marginTop: tryDup ? 12 : 10, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>{s.summary}</div>
        {tryDup ? (
          <div className="pqat-hint" style={{ marginTop: 6, fontSize: 12 }}>
            Concrete action matches the summary—expand for validation steps and cautions.
          </div>
        ) : null}
        <div className="pqat-signalLine">
          <span className="pqat-signalLine__label">Why it matters</span>
          <div className="pqat-signalLine__text" style={{ color: 'var(--text-secondary)' }}>
            {why}
          </div>
        </div>
        {linkedBottleneck ? (
          <div className="pqat-signalLine" aria-label="Linked bottleneck">
            <span className="pqat-signalLine__label">Because of bottleneck</span>
            <div className="pqat-signalLine__text" style={{ color: 'var(--text-secondary)' }}>
              #{linkedBottleneck.rank} · {bottleneckClassShortLabel(linkedBottleneck.bottleneckClass)} —{' '}
              {linkedBottleneck.headline}
            </div>
          </div>
        ) : null}
      </div>
      {s.validationSteps?.length ? (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
          <b style={{ color: 'var(--text-h)' }}>Validate · </b>
          {s.validationSteps[0]}
          {s.validationSteps.length > 1 ? ` (+${s.validationSteps.length - 1} more in detail)` : ''}
        </div>
      ) : null}
      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {target ? (
          <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--primary" onClick={() => jumpToNodeId(target)}>
            Focus {focusLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="pqat-btn pqat-btn--sm pqat-btn--ghost"
          onClick={() => setExpandedOptimizationId(expanded ? null : s.suggestionId)}
        >
          {expanded ? 'Hide evidence detail' : 'Evidence, cautions, all validation steps'}
        </button>
        <button
          type="button"
          className="pqat-btn pqat-btn--sm pqat-btn--ghost"
          data-testid="analyze-suggestion-copy-ticket"
          aria-label={`Copy suggestion summary for ${s.title}`}
          onClick={() => void copySuggestion.copy(suggestionReferenceText(s, analysisId), 'Copied suggestion')}
        >
          Copy for ticket
        </button>
      </div>
      {expanded ? (
        <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          <div style={{ marginBottom: 8 }}>
            <b>Rationale (evidence link):</b> {s.rationale}
          </div>
          {s.details ? (
            <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
              <b>Technical details:</b> {s.details}
            </div>
          ) : null}
          {s.cautions?.length ? (
            <div style={{ marginBottom: 8 }}>
              <b>Cautions:</b>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                {s.cautions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {s.validationSteps?.length ? (
            <div>
              <b>Validation steps:</b>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                {s.validationSteps.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function AnalyzeOptimizationSuggestionsPanel(props: {
  sortedOptimizationSuggestions: OptimizationSuggestion[]
  expandedOptimizationId: string | null
  setExpandedOptimizationId: (id: string | null) => void
  jumpToNodeId: (id: string) => void
  byId: Map<string, AnalyzedPlanNode>
  nodeLabel: (n: AnalyzedPlanNode) => string
  bottlenecks?: PlanBottleneckInsight[] | null
  /** Phase 84: included in “Copy for ticket” payload when present. */
  analysisId?: string | null
  /** Finding id from triage when takeaway is finding-driven (Phase 110). */
  primaryTriageFindingId?: string | null
  /** Start-here focus node (inspect-step or top finding anchor). */
  triageFocusNodeId?: string | null
  /** Node ids on the primary ranked finding (overlap with suggestion targets). */
  primaryFindingNodeIds?: readonly string[] | null
}) {
  const {
    sortedOptimizationSuggestions,
    expandedOptimizationId,
    setExpandedOptimizationId,
    jumpToNodeId,
    byId,
    nodeLabel,
    bottlenecks,
    analysisId,
    primaryTriageFindingId,
    triageFocusNodeId,
    primaryFindingNodeIds,
  } = props

  const copySuggestion = useCopyFeedback()

  const bottleneckByInsightId = useMemo(() => {
    const m = new Map<string, PlanBottleneckInsight>()
    for (const b of bottlenecks ?? []) m.set(b.insightId, b)
    return m
  }, [bottlenecks])

  const normalized = useMemo(
    () => normalizeOptimizationSuggestionsForDisplay(sortedOptimizationSuggestions),
    [sortedOptimizationSuggestions],
  )
  const groups = useMemo(() => sortAndGroupSuggestionsForUi(normalized), [normalized])
  const virtualRows = useMemo(() => flattenGroupedSuggestionsForVirtualList(groups), [groups])
  const topLeverageId = useMemo(() => {
    for (const g of groups) {
      for (const s of g.items) {
        if (suggestionLeverageTier(s.priority) === 'lead') return s.suggestionId
      }
    }
    return normalized[0]?.suggestionId ?? null
  }, [groups, normalized])
  const useVirtual = virtualRows.length >= SUGGEST_VIRTUAL_THRESHOLD

  const triageSuggestionCtx = useMemo(
    () => ({
      primaryFindingId: primaryTriageFindingId,
      triageFocusNodeId,
      primaryFindingNodeIds,
    }),
    [primaryTriageFindingId, triageFocusNodeId, primaryFindingNodeIds],
  )

  const triageAlignedRowIndex = useMemo(
    () => firstVirtualRowIndexAlignedWithAnalyzeTriage(virtualRows, triageSuggestionCtx),
    [virtualRows, triageSuggestionCtx],
  )

  const triageScrollTargetSuggestionId = useMemo(() => {
    if (triageAlignedRowIndex < 0) return null
    const row = virtualRows[triageAlignedRowIndex]
    return row?.kind === 'card' ? row.suggestion.suggestionId : null
  }, [virtualRows, triageAlignedRowIndex])

  const alignedVirtualIndex = useMemo(() => {
    if (!useVirtual) return -1
    return triageAlignedRowIndex
  }, [useVirtual, triageAlignedRowIndex])

  const alignedSuggestionIdKey = triageScrollTargetSuggestionId ?? ''

  const suggestionListRef = useRef<VirtualizedListColumnHandle>(null)

  useEffect(() => {
    if (alignedVirtualIndex < 0) return
    const id = window.requestAnimationFrame(() => {
      suggestionListRef.current?.scrollToIndex(alignedVirtualIndex, { align: 'center' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [alignedVirtualIndex, alignedSuggestionIdKey, sortedOptimizationSuggestions.length])

  if (!sortedOptimizationSuggestions.length) {
    return (
      <section
        className="pqat-panel pqat-panel--detail"
        style={{ marginBottom: 16, padding: '16px 18px' }}
        aria-label="Optimization suggestions"
        data-testid="analyze-optimization-suggestions-panel"
      >
        <div className="pqat-eyebrow">Next steps</div>
        <h2 style={{ marginTop: 0 }}>Optimization suggestions</h2>
        <p className="pqat-hint" style={{ marginBottom: 0 }}>
          No suggestions for this snapshot—often means the plan looks unremarkable under current thresholds, or required timing/buffer
          fields were missing. Try EXPLAIN (ANALYZE, BUFFERS) and re-run if the plan was text-only.
        </p>
      </section>
    )
  }

  function renderSuggestionCard(s: OptimizationSuggestion) {
    const expanded = expandedOptimizationId === s.suggestionId
    const alignsWithStartHere = suggestionAlignsWithAnalyzeTriage(s, triageSuggestionCtx)
    const isTriageScrollTarget = Boolean(triageScrollTargetSuggestionId && s.suggestionId === triageScrollTargetSuggestionId)
    return (
      <SuggestionCardBody
        key={s.suggestionId}
        s={s}
        expanded={expanded}
        setExpandedOptimizationId={setExpandedOptimizationId}
        jumpToNodeId={jumpToNodeId}
        byId={byId}
        nodeLabel={nodeLabel}
        bottleneckByInsightId={bottleneckByInsightId}
        isTopLeverageCard={topLeverageId !== null && s.suggestionId === topLeverageId}
        alignsWithStartHere={alignsWithStartHere}
        isTriageScrollTarget={isTriageScrollTarget}
        analysisId={analysisId}
        copySuggestion={copySuggestion}
      />
    )
  }

  return (
    <section
      className="pqat-panel pqat-panel--detail"
      style={{ marginBottom: 16, padding: '16px 18px' }}
      aria-label="Optimization suggestions"
      data-testid="analyze-optimization-suggestions-panel"
    >
      <div className="pqat-eyebrow">Next steps</div>
      <h2 style={{ marginTop: 0 }}>Optimization suggestions</h2>
      {copySuggestion.status ? (
        <div className="pqat-hint" role="status" aria-live="polite" aria-atomic="true" style={{ marginBottom: 8 }}>
          {copySuggestion.status}
        </div>
      ) : null}
      <p className="pqat-hint" style={{ marginBottom: 12 }}>
        Ordered by priority and evidence. Each card’s highlighted action line is the first concrete move; expand for cautions and
        validation—not guaranteed fixes.
      </p>
      {useVirtual ? (
        <VirtualizedListColumn
          ref={suggestionListRef}
          count={virtualRows.length}
          estimateSize={suggestionVirtualRowEstimateSize(virtualRows[0]!)}
          getItemSize={(i) => suggestionVirtualRowEstimateSize(virtualRows[i]!)}
          maxHeight="min(520px, 55vh)"
          scrollContainerTestId="analyze-suggestions-virtual-scroller"
          aria-label="Optimization suggestions (scroll for more)"
        >
          {(i) => {
            const row = virtualRows[i]!
            if (row.kind === 'header') {
              return (
                <div
                  key={row.key}
                  className="pqat-suggestionVirtualHeader"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 750,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    padding: '6px 2px 4px',
                  }}
                >
                  {row.label}
                </div>
              )
            }
            return renderSuggestionCard(row.suggestion)
          }}
        </VirtualizedListColumn>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((g) => (
            <div key={g.familyKey}>
              {g.familyLabel ? (
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 750,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  {g.familyLabel}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {g.items.map((s) => renderSuggestionCard(s))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
