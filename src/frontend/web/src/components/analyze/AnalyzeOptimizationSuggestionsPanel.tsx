import type { AnalyzedPlanNode, OptimizationSuggestion } from '../../api/types'
import {
  optimizationCategoryLabel,
  suggestionConfidenceLabel,
  suggestionPriorityLabel,
} from '../../presentation/optimizationSuggestionsPresentation'

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

  if (!sortedOptimizationSuggestions.length) return null

  return (
    <section style={{ marginBottom: 16 }} aria-label="Optimization suggestions">
      <h2 style={{ marginTop: 0 }}>Optimization suggestions</h2>
      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
        Evidence-linked next steps—not guaranteed fixes. Expand for rationale, cautions, and validation.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedOptimizationSuggestions.slice(0, 8).map((s) => {
          const expanded = expandedOptimizationId === s.suggestionId
          const target = (s.targetNodeIds ?? [])[0]
          const targetLabel = target && byId.get(target) ? nodeLabel(byId.get(target)!) : target
          return (
            <div
              key={s.suggestionId}
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'color-mix(in srgb, var(--accent-bg) 12%, transparent)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.35 }}>{s.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {optimizationCategoryLabel(s.category)}
                </span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{suggestionConfidenceLabel(s.confidence)}</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{suggestionPriorityLabel(s.priority)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.92 }}>{s.summary}</div>
              {s.validationSteps?.length ? (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.88 }}>
                  <b>Validate by:</b> {s.validationSteps[0]}
                  {s.validationSteps.length > 1 ? ` (+${s.validationSteps.length - 1} more)` : ''}
                </div>
              ) : null}
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {target ? (
                  <button
                    type="button"
                    onClick={() => jumpToNodeId(target)}
                    style={{ fontSize: 12, padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
                  >
                    Focus {targetLabel ?? target}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setExpandedOptimizationId(expanded ? null : s.suggestionId)}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
                >
                  {expanded ? 'Hide detail' : 'Why + cautions'}
                </button>
              </div>
              {expanded ? (
                <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
                  <div style={{ marginBottom: 8 }}>
                    <b>Rationale:</b> {s.rationale}
                  </div>
                  {s.details ? (
                    <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                      <b>Details:</b> {s.details}
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
        })}
      </div>
    </section>
  )
}
