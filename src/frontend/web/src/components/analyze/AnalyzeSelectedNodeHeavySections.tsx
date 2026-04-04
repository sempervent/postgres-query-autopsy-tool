import type { CSSProperties } from 'react'
import type { AnalysisFinding, AnalyzedPlanNode, PlanAnalysisResult } from '../../api/types'
import { joinSideContextLineForNode } from '../../presentation/joinPainHints'
import { bufferCounterRowsForApiNode, planNodeApiHasAnyBufferCounter } from '../../presentation/bufferFieldsPresentation'
import { getWorkersFromPlanNode, workerTableRows } from '../../presentation/workerPresentation'

function severityLabel(sev: number) {
  return ['Info', 'Low', 'Medium', 'High', 'Critical'][sev] ?? String(sev)
}

export function AnalyzeSelectedNodeHeavySections(props: {
  analysis: PlanAnalysisResult
  selectedNode: AnalyzedPlanNode
  findingsForSelectedNode: AnalysisFinding[]
}) {
  const { analysis, selectedNode, findingsForSelectedNode } = props

  return (
    <>
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', opacity: 0.88 }}>Operator context signals</summary>
        {(() => {
          const ctx = (selectedNode as { contextEvidence?: Record<string, unknown> }).contextEvidence as
            | Record<string, any>
            | undefined
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
    </>
  )
}
