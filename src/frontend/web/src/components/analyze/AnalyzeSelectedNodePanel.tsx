import type { CSSProperties } from 'react'
import type { AnalysisFinding, AnalyzedPlanNode, OptimizationSuggestion, PlanAnalysisResult } from '../../api/types'
import { joinLabelAndSubtitle } from '../../presentation/nodeLabels'
import { joinSideContextLineForNode } from '../../presentation/joinPainHints'
import { bufferCounterRowsForApiNode, planNodeApiHasAnyBufferCounter } from '../../presentation/bufferFieldsPresentation'
import { getWorkersFromPlanNode, workerSummaryCue, workerTableRows } from '../../presentation/workerPresentation'
import { formatAccessPathSummaryLine, indexInsightsForNodeId } from '../../presentation/indexInsightPresentation'
import { nodeReferenceText } from '../../presentation/nodeReferences'
import {
  analyzeDeepLinkPath,
  buildAnalyzeDeepLinkSearchParams,
  copyArtifactShareToast,
  shareArtifactLinkLabel,
} from '../../presentation/artifactLinks'
import type { AppConfig } from '../../api/types'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'

function severityLabel(sev: number) {
  return ['Info', 'Low', 'Medium', 'High', 'Critical'][sev] ?? String(sev)
}

export function AnalyzeSelectedNodePanel(props: {
  analysis: PlanAnalysisResult
  selectedNode: AnalyzedPlanNode | null
  selectedNodeId: string | null
  byId: Map<string, AnalyzedPlanNode>
  findingsForSelectedNode: AnalysisFinding[]
  relatedOptimizationForSelectedNode: OptimizationSuggestion | null
  appConfig: AppConfig | null
  locationPathname: string
  copyNode: ReturnType<typeof useCopyFeedback>
  copyShareLink: ReturnType<typeof useCopyFeedback>
  nodeLabel: (n: AnalyzedPlanNode) => string
}) {
  const {
    analysis,
    selectedNode,
    selectedNodeId,
    byId,
    findingsForSelectedNode,
    relatedOptimizationForSelectedNode,
    appConfig,
    locationPathname,
    copyNode,
    copyShareLink,
    nodeLabel,
  } = props

  const shareLinkUi = {
    label: shareArtifactLinkLabel(appConfig?.authEnabled ?? false, analysis?.artifactAccess),
    toast: copyArtifactShareToast(appConfig?.authEnabled ?? false, analysis?.artifactAccess),
  }

  return (
    <div style={{ minWidth: 0 }} aria-label="Selected node detail">
      <h2>Selected node</h2>
      {selectedNode ? (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 900 }}>{nodeLabel(selectedNode)}</div>
          {(() => {
            const js = joinLabelAndSubtitle(selectedNode, byId)
            if (!js?.subtitle) return null
            return <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{js.subtitle}</div>
          })()}
          {(() => {
            const ws = getWorkersFromPlanNode(selectedNode.node)
            const cue = workerSummaryCue(ws)
            if (!cue) return null
            return (
              <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--mono)', opacity: 0.9 }} aria-label="Worker summary">
                {cue}
              </div>
            )
          })()}
          {relatedOptimizationForSelectedNode ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }} aria-label="Related optimization suggestion">
              <b>Related optimization suggestion</b>
              <div style={{ marginTop: 4, fontWeight: 700 }}>{relatedOptimizationForSelectedNode.title}</div>
              <div style={{ marginTop: 4, opacity: 0.9 }}>{relatedOptimizationForSelectedNode.summary}</div>
            </div>
          ) : null}
          {(() => {
            const insights = indexInsightsForNodeId(analysis, selectedNode.nodeId)
            if (!insights.length) return null
            return (
              <div style={{ marginTop: 10 }} aria-label="Access path index insight">
                <b>Access path / index insight</b>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insights.map((ins) => (
                    <div
                      key={`${ins.nodeId}-${ins.headline}-${ins.signalKinds.join(',')}`}
                      style={{ fontSize: 12, lineHeight: 1.45, padding: 8, borderRadius: 10, border: '1px solid var(--border)' }}
                    >
                      <div style={{ fontFamily: 'var(--mono)', opacity: 0.9, marginBottom: 4 }}>{formatAccessPathSummaryLine(ins)}</div>
                      <div>{ins.headline}</div>
                      <div style={{ marginTop: 4, fontSize: 11, opacity: 0.75 }}>Signals: {ins.signalKinds.join(', ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                if (!selectedNodeId) return
                const text = nodeReferenceText(selectedNodeId, byId)
                await copyNode.copy(text, 'Copied node reference')
              }}
              style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              Copy reference
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!selectedNodeId) return
                const path = analyzeDeepLinkPath(
                  locationPathname,
                  buildAnalyzeDeepLinkSearchParams({
                    analysisId: analysis.analysisId,
                    nodeId: selectedNodeId,
                  }),
                )
                await copyShareLink.copy(`${window.location.origin}${path}`, shareLinkUi.toast)
              }}
              style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              {shareLinkUi.label}
            </button>
            {copyNode.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyNode.status}</div> : null}
            {copyShareLink.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyShareLink.status}</div> : null}
          </div>
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', opacity: 0.88 }}>Operator context signals</summary>
            {(() => {
              const ctx = (selectedNode as any).contextEvidence as any
              const lines: string[] = []
              const side = joinSideContextLineForNode(selectedNode)
              if (side) lines.push(side)
              const hash = ctx?.hashJoin?.childHash
              if (hash?.hashBatches || hash?.diskUsageKb) {
                lines.push(`hash build: batches=${String(hash?.hashBatches ?? '—')} disk=${String(hash?.diskUsageKb ?? '—')}kB`)
              }
              const sort = ctx?.sort
              if (sort?.diskUsageKb || (sort?.sortMethod ?? '').toLowerCase().includes('external')) {
                lines.push(`sort: method=${String(sort?.sortMethod ?? '—')} disk=${String(sort?.diskUsageKb ?? '—')}kB`)
              }
              const waste = ctx?.scanWaste
              if (waste?.rowsRemovedByFilter || waste?.rowsRemovedByIndexRecheck || waste?.heapFetches) {
                lines.push(
                  `scan waste: removedByFilter=${String(waste?.rowsRemovedByFilter ?? '—')} recheck=${String(waste?.rowsRemovedByIndexRecheck ?? '—')} heapFetches=${String(waste?.heapFetches ?? '—')}`,
                )
              }
              const memo = ctx?.memoize
              if (memo?.hitRate != null) {
                lines.push(
                  `memoize: hitRate=${String(memo.hitRate)} hits=${String(memo.cacheHits ?? '—')} misses=${String(memo.cacheMisses ?? '—')}`,
                )
              }
              if (lines.length === 0)
                return <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>No contextual evidence for this node.</div>
              return (
                <ul style={{ marginTop: 8 }}>
                  {lines.map((l) => (
                    <li key={l} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                      {l}
                    </li>
                  ))}
                </ul>
              )
            })()}
          </details>
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer', opacity: 0.85 }}>Debug node id</summary>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9, marginTop: 6 }}>{selectedNode.nodeId}</div>
          </details>
          {planNodeApiHasAnyBufferCounter(selectedNode.node) ? (
            <div style={{ marginTop: 10 }}>
              <b>Buffer I/O</b>
              <div style={{ marginTop: 6, fontSize: 12, fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
                {bufferCounterRowsForApiNode(selectedNode.node).map((r) => (
                  <div key={r.label}>
                    {r.label}: {r.value}
                  </div>
                ))}
              </div>
            </div>
          ) : analysis.summary.hasBuffers ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              This operator has no buffer counters in the payload (often normal for parents); check hotter children or a worker-merged parent.
            </div>
          ) : null}
          {(() => {
            const ws = getWorkersFromPlanNode(selectedNode.node)
            if (!ws.length) return null
            const rows = workerTableRows(ws)
            const cols =
              'minmax(0,0.5fr) minmax(0,1fr) minmax(0,0.8fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1fr)'
            const cell: CSSProperties = { fontSize: 11, fontFamily: 'var(--mono)' }
            return (
              <details style={{ marginTop: 12 }} open={false}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Parallel workers</summary>
                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85 }}>
                  Per-worker stats from EXPLAIN JSON (parent row above is the leader aggregate when present).
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="Parallel workers">
                  <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px 10px', ...cell, fontWeight: 800, opacity: 0.85 }}>
                    <div>#</div>
                    <div>Total time</div>
                    <div>Rows</div>
                    <div>Shared hit</div>
                    <div>Shared read</div>
                    <div>Temp read / write</div>
                  </div>
                  {rows.map((r) => (
                    <div key={r.workerNumber} style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px 10px', ...cell }}>
                      <div>{r.workerNumber}</div>
                      <div>{r.totalTime}</div>
                      <div>{r.rows}</div>
                      <div>{r.sharedHit}</div>
                      <div>{r.sharedRead}</div>
                      <div>{r.temp}</div>
                    </div>
                  ))}
                </div>
              </details>
            )
          })()}
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Raw plan node JSON</summary>
            <pre style={{ marginTop: 6, overflow: 'auto', fontSize: 11 }}>{JSON.stringify(selectedNode.node, null, 2)}</pre>
          </details>
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Derived metrics (JSON)</summary>
            <pre style={{ marginTop: 6, overflow: 'auto', fontSize: 11 }}>{JSON.stringify(selectedNode.metrics, null, 2)}</pre>
          </details>

          <div style={{ marginTop: 10 }}>
            <b>Findings for this node ({findingsForSelectedNode.length})</b>
            <ul style={{ marginTop: 6 }}>
              {findingsForSelectedNode.slice(0, 12).map((f) => (
                <li key={f.findingId}>
                  [{severityLabel(f.severity)}] {f.title} <span style={{ opacity: 0.8 }}>({f.ruleId})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', opacity: 0.9 }}>
          Click a node in the tree or a finding to select a node.
        </div>
      )}
    </div>
  )
}
