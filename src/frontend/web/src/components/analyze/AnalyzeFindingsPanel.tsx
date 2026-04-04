import type { AnalysisFinding, AnalyzedPlanNode } from '../../api/types'
import { findingAnchorLabel } from '../../presentation/nodeLabels'
import { joinSideContextLineForNode } from '../../presentation/joinPainHints'
import { findingReferenceText } from '../../presentation/nodeReferences'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'
import { ClickableRow } from '../ClickableRow'
import { ReferenceCopyButton } from '../ReferenceCopyButton'
import { VirtualizedListColumn, VIRTUAL_LIST_THRESHOLD } from '../VirtualizedListColumn'

function severityLabel(sev: number) {
  return ['Info', 'Low', 'Medium', 'High', 'Critical'][sev] ?? String(sev)
}

function severityChipClass(sev: number) {
  const n = Math.min(4, Math.max(0, sev))
  return `pqat-chip pqat-chip--sev${n}`
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

  const useVirtual = filteredFindings.length >= VIRTUAL_LIST_THRESHOLD

  function renderFindingRow(f: AnalysisFinding) {
    const anchorId = (f.nodeIds ?? [])[0]
    return (
      <ClickableRow
        key={f.findingId}
        className="pqat-listRow"
        selectedEmphasis="accent-bar"
        selected={!!anchorId && anchorId === selectedNodeId}
        aria-label={`Finding: ${f.title}`}
        onActivate={() => {
          const target = anchorId
          if (target) jumpToNodeId(target)
        }}
        style={{
          padding: 12,
          color: 'var(--text-h)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
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
          return <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{side}</div>
        })()}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span className={severityChipClass(f.severity)}>{severityLabel(f.severity)}</span>
            <span style={{ fontWeight: 750, fontSize: '0.9375rem', lineHeight: 1.35 }}>{f.title}</span>
          </div>
          <span className="pqat-chip">{confidenceLabel(f.confidence)}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
          rule: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>{f.ruleId}</span> · category:{' '}
          {String(f.category)}
        </div>
        <div style={{ marginTop: 8, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>{f.summary}</div>
        <details className="pqat-details" style={{ marginTop: 10 }}>
          <summary>Evidence + explanation</summary>
          <div style={{ marginTop: 8, fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{f.explanation}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--text-h)' }}>Suggestion:</b> {f.suggestion}
          </div>
        </details>
      </ClickableRow>
    )
  }

  return (
    <div className="pqat-panel pqat-panel--detail" style={{ minWidth: 0, padding: '16px 18px' }} aria-label="Findings list">
      <div className="pqat-eyebrow">Ranked</div>
      <h2>Findings</h2>
      <p className="pqat-hint" style={{ marginBottom: 12 }}>
        Index-related rules include seq-scan / indexing opportunities (J, F), heavy index paths (R), bitmap recheck (S), chunk+bitmap plans (P), nested-loop inner support (Q), hash join pressure (L), materialize loops (M), and sort cost (K).
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <input
          className="pqat-input"
          value={findingSearch}
          onChange={(e) => setFindingSearch(e.target.value)}
          placeholder="Search findings (title/summary/rule)"
          style={{ flex: 1 }}
        />
        <select
          className="pqat-select"
          value={minSeverity}
          onChange={(e) => setMinSeverity(Number(e.target.value))}
          style={{ width: 'auto', minWidth: 120 }}
        >
          <option value={0}>Info+</option>
          <option value={1}>Low+</option>
          <option value={2}>Medium+</option>
          <option value={3}>High+</option>
          <option value={4}>Critical only</option>
        </select>
      </div>

      {useVirtual ? (
        <VirtualizedListColumn
          count={filteredFindings.length}
          estimateSize={200}
          aria-label="Findings list (scroll for more)"
        >
          {(i) => renderFindingRow(filteredFindings[i]!)}
        </VirtualizedListColumn>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{filteredFindings.map((f) => renderFindingRow(f))}</div>
      )}
      {useVirtual ? (
        <p className="pqat-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Showing {filteredFindings.length} findings in a scrollable window for responsiveness.
        </p>
      ) : null}
      {copyFinding.status ? <div className="pqat-hint" style={{ marginTop: 10 }}>{copyFinding.status}</div> : null}
    </div>
  )
}
