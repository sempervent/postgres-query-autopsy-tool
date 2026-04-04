import { useMemo } from 'react'
import type { AnalyzedPlanNode, OptimizationSuggestion } from '../../api/types'
import {
  flattenGroupedSuggestionsForVirtualList,
  groupOptimizationSuggestionsForUi,
  normalizeOptimizationSuggestionsForDisplay,
  optimizationCategoryLabel,
  suggestionConfidenceShort,
  suggestionFamilyLabel,
  suggestionPriorityShort,
  suggestionVirtualRowEstimateSize,
} from '../../presentation/optimizationSuggestionsPresentation'
import { VirtualizedListColumn, VIRTUAL_LIST_THRESHOLD } from '../VirtualizedListColumn'

const SUGGEST_VIRTUAL_THRESHOLD = Math.max(12, VIRTUAL_LIST_THRESHOLD - 24)

function SuggestionCardBody(props: {
  s: OptimizationSuggestion
  expanded: boolean
  setExpandedOptimizationId: (id: string | null) => void
  jumpToNodeId: (id: string) => void
  byId: Map<string, AnalyzedPlanNode>
  nodeLabel: (n: AnalyzedPlanNode) => string
}) {
  const { s, expanded, setExpandedOptimizationId, jumpToNodeId, byId, nodeLabel } = props
  const target = (s.targetNodeIds ?? [])[0]
  const derivedTargetLabel = target && byId.get(target) ? nodeLabel(byId.get(target)!) : target
  const focusLabel = (s.targetDisplayLabel ?? derivedTargetLabel ?? target)?.trim() || 'node'
  const nextAction = s.recommendedNextAction ?? s.summary
  const why = s.whyItMatters ?? s.rationale

  return (
    <div className="pqat-listRow pqat-listRow--suggestion pqat-workspaceReveal" style={{ padding: 14 }}>
      {s.isGroupedCluster ? (
        <div className="pqat-suggestionGroupedBadge" title="Merged from multiple overlapping findings">
          Combined suggestion
        </div>
      ) : null}
      <div className="pqat-guidedSuggestion">
        <div style={{ fontWeight: 750, fontSize: '0.9375rem', lineHeight: 1.35, color: 'var(--text-h)' }}>{s.title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <span className="pqat-chip pqat-chip--suggestionMeta" title="Suggestion family">
            {suggestionFamilyLabel(s.suggestionFamily)}
          </span>
          <span className="pqat-chip pqat-chip--suggestionMeta">{suggestionConfidenceShort(s.confidence)}</span>
          <span className="pqat-chip pqat-chip--suggestionMeta">{suggestionPriorityShort(s.priority)}</span>
          <span className="pqat-chip" title="Technical category from engine">
            {optimizationCategoryLabel(s.category)}
          </span>
        </div>
        <div style={{ marginTop: 10, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>{s.summary}</div>
        <div className="pqat-signalLine">
          <span className="pqat-signalLine__label">Try next</span>
          <div className="pqat-signalLine__text" style={{ color: 'var(--text-secondary)' }}>
            {nextAction}
          </div>
        </div>
        <div className="pqat-signalLine">
          <span className="pqat-signalLine__label">Why it matters</span>
          <div className="pqat-signalLine__text" style={{ color: 'var(--text-secondary)' }}>
            {why}
          </div>
        </div>
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
}) {
  const {
    sortedOptimizationSuggestions,
    expandedOptimizationId,
    setExpandedOptimizationId,
    jumpToNodeId,
    byId,
    nodeLabel,
  } = props

  const normalized = useMemo(
    () => normalizeOptimizationSuggestionsForDisplay(sortedOptimizationSuggestions),
    [sortedOptimizationSuggestions],
  )
  const groups = useMemo(() => groupOptimizationSuggestionsForUi(normalized), [normalized])
  const virtualRows = useMemo(() => flattenGroupedSuggestionsForVirtualList(groups), [groups])
  const useVirtual = virtualRows.length >= SUGGEST_VIRTUAL_THRESHOLD

  if (!sortedOptimizationSuggestions.length) {
    return (
      <section className="pqat-panel pqat-panel--detail" style={{ marginBottom: 16, padding: '16px 18px' }} aria-label="Optimization suggestions">
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
    return (
      <SuggestionCardBody
        key={s.suggestionId}
        s={s}
        expanded={expanded}
        setExpandedOptimizationId={setExpandedOptimizationId}
        jumpToNodeId={jumpToNodeId}
        byId={byId}
        nodeLabel={nodeLabel}
      />
    )
  }

  return (
    <section className="pqat-panel pqat-panel--detail" style={{ marginBottom: 16, padding: '16px 18px' }} aria-label="Optimization suggestions">
      <div className="pqat-eyebrow">Next steps</div>
      <h2 style={{ marginTop: 0 }}>Optimization suggestions</h2>
      <p className="pqat-hint" style={{ marginBottom: 12 }}>
        Plain-language next steps backed by findings and operator evidence—not guaranteed fixes. Expand a card for raw rationale and
        technical detail.
      </p>
      {useVirtual ? (
        <VirtualizedListColumn
          count={virtualRows.length}
          estimateSize={suggestionVirtualRowEstimateSize(virtualRows[0]!)}
          getItemSize={(i) => suggestionVirtualRowEstimateSize(virtualRows[i]!)}
          maxHeight="min(520px, 55vh)"
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
