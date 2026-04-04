import type { AnalysisFinding, AnalyzedPlanNode } from '../../api/types'
import { findingAnchorLabel } from '../../presentation/nodeLabels'
import { joinSideContextLineForNode } from '../../presentation/joinPainHints'
import { findingReferenceText } from '../../presentation/nodeReferences'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'
import { ClickableRow } from '../ClickableRow'
import { ReferenceCopyButton } from '../ReferenceCopyButton'

function severityLabel(sev: number) {
  return ['Info', 'Low', 'Medium', 'High', 'Critical'][sev] ?? String(sev)
}
function confidenceLabel(conf: number) {
  return ['Low', 'Medium', 'High'][conf] ?? String(conf)
}

export function AnalyzeFindingsPanel(props: {
  findingSearch: string
  setFindingSearch: (v: string) => void
  minSeverity: number
  setMinSeverity: (v: number) => void
  filteredFindings: AnalysisFinding[]
  selectedNodeId: string | null
  jumpToNodeId: (id: string) => void
  byId: Map<string, AnalyzedPlanNode>
  copyFinding: ReturnType<typeof useCopyFeedback>
}) {
  const {
    findingSearch,
    setFindingSearch,
    minSeverity,
    setMinSeverity,
    filteredFindings,
    selectedNodeId,
    jumpToNodeId,
    byId,
    copyFinding,
  } = props

  return (
    <div style={{ minWidth: 0 }} aria-label="Findings list">
      <h2>Findings</h2>
      <div style={{ marginBottom: 10, fontSize: 11, opacity: 0.8 }}>
        Index-related rules include seq-scan / indexing opportunities (J, F), heavy index paths (R), bitmap recheck (S), chunk+bitmap plans (P), nested-loop inner support (Q), hash join pressure (L), materialize loops (M), and sort cost (K).
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
        <input
          value={findingSearch}
          onChange={(e) => setFindingSearch(e.target.value)}
          placeholder="Search findings (title/summary/rule)"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-h)',
          }}
        />
        <select value={minSeverity} onChange={(e) => setMinSeverity(Number(e.target.value))} style={{ padding: '10px 12px', borderRadius: 12 }}>
          <option value={0}>Info+</option>
          <option value={1}>Low+</option>
          <option value={2}>Medium+</option>
          <option value={3}>High+</option>
          <option value={4}>Critical only</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredFindings.slice(0, 60).map((f: AnalysisFinding) => {
          const anchorId = (f.nodeIds ?? [])[0]
          return (
            <ClickableRow
              key={f.findingId}
              selected={!!anchorId && anchorId === selectedNodeId}
              aria-label={`Finding: ${f.title}`}
              onActivate={() => {
                const target = anchorId
                if (target) jumpToNodeId(target)
              }}
              style={{
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'color-mix(in srgb, var(--accent-bg) 18%, transparent)',
                color: 'var(--text-h)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  <span style={{ fontFamily: 'var(--mono)' }}>{findingAnchorLabel(anchorId, byId as any)}</span>
                </div>
                <ReferenceCopyButton
                  aria-label="Copy finding reference"
                  onCopy={() => {
                    if (!anchorId) return
                    copyFinding.copy(findingReferenceText(anchorId, byId, f.title), 'Copied finding reference')
                  }}
                />
              </div>
              {(() => {
                if (!anchorId) return null
                const n = byId.get(anchorId) ?? null
                const side = joinSideContextLineForNode(n)
                if (!side) return null
                return <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{side}</div>
              })()}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 800 }}>
                  [{severityLabel(f.severity)}] {f.title}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{confidenceLabel(f.confidence)}</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                rule: <span style={{ fontFamily: 'var(--mono)' }}>{f.ruleId}</span> · category: {String(f.category)}
              </div>
              <div style={{ marginTop: 6 }}>{f.summary}</div>
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', opacity: 0.9 }}>Evidence + explanation</summary>
                <div style={{ marginTop: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>{f.explanation}</div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                  <b>Suggestion:</b> {f.suggestion}
                </div>
              </details>
            </ClickableRow>
          )
        })}
      </div>
      {copyFinding.status ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>{copyFinding.status}</div> : null}
    </div>
  )
}
