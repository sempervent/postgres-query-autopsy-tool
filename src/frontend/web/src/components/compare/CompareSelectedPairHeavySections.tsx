import type { AnalyzedPlanNode, NodePairDetail, PlanComparisonResult } from '../../api/types'
import { accessPathChangeCue } from '../../presentation/indexInsightPresentation'
import { joinSideSummaryLinesForPair } from '../../presentation/joinPainHints'

export type CompareSelectedPairHeavySectionsProps = {
  comparison: PlanComparisonResult
  selectedDetail: NodePairDetail
  byIdA: Map<string, AnalyzedPlanNode>
  byIdB: Map<string, AnalyzedPlanNode>
}

/** Dense pair detail — lazy-loaded after header/actions (Phase 46). */
export function CompareSelectedPairHeavySections(props: CompareSelectedPairHeavySectionsProps) {
  const { comparison, selectedDetail, byIdA, byIdB } = props

  return (
    <>
      {(() => {
        const cues = selectedDetail.indexDeltaCues?.filter(Boolean) ?? []
        const fallback = accessPathChangeCue(
          selectedDetail.identity.accessPathFamilyA,
          selectedDetail.identity.accessPathFamilyB,
        )
        if (!cues.length && !fallback) return null
        return (
          <div style={{ marginTop: 10 }} aria-label="Access path and index delta">
            <h4 style={{ marginTop: 0, marginBottom: 6 }}>Access path / index delta</h4>
            {cues.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, opacity: 0.92 }}>
                {cues.map((c) => (
                  <li key={c} style={{ marginBottom: 4 }}>
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.9 }}>{fallback}</div>
            )}
          </div>
        )
      })()}
      {selectedDetail.corroborationCues?.length ? (
        <div style={{ marginTop: 10 }} aria-label="Finding and index delta corroboration">
          <h4 style={{ marginTop: 0, marginBottom: 6 }}>Finding ↔ index corroboration</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, opacity: 0.9 }}>
            {selectedDetail.corroborationCues.map((c) => (
              <li key={c} style={{ marginBottom: 4 }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {(() => {
        const lines = joinSideSummaryLinesForPair(selectedDetail, byIdA, byIdB)
        if (!lines.length) return null
        return (
          <>
            <h3 style={{ marginTop: 12 }}>Join side change summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lines.map((l) => (
                <div key={l} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ marginTop: 0, fontSize: 13 }}>{l}</div>
                </div>
              ))}
            </div>
          </>
        )
      })()}
      {selectedDetail.contextDiff?.highlights?.length ? (
        <>
          <h3 style={{ marginTop: 12 }}>Context change summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedDetail.contextDiff.highlights.map((h) => (
              <div key={h} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
                  {selectedDetail.contextDiff?.overallDirection}
                </div>
                <div style={{ marginTop: 4, fontSize: 13 }}>{h}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer' }}>Debug ids</summary>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9, marginTop: 6 }}>
          {selectedDetail.identity.nodeIdA} ↔ {selectedDetail.identity.nodeIdB}
        </div>
      </details>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
        <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
          <b>Plan A</b>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginTop: 6 }}>
            {selectedDetail.identity.nodeTypeA}{' '}
            {selectedDetail.identity.relationNameA ? `(${selectedDetail.identity.relationNameA})` : ''}
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
          <b>Plan B</b>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginTop: 6 }}>
            {selectedDetail.identity.nodeTypeB}{' '}
            {selectedDetail.identity.relationNameB ? `(${selectedDetail.identity.relationNameB})` : ''}
          </div>
        </div>
      </div>

      {(() => {
        const ctxA = selectedDetail.contextEvidenceA
        const ctxB = selectedDetail.contextEvidenceB
        const hashA = ctxA?.hashJoin?.childHash
        const hashB = ctxB?.hashJoin?.childHash
        const hasHashCtx = !!(
          hashA?.hashBatches ||
          hashB?.hashBatches ||
          hashA?.diskUsageKb ||
          hashB?.diskUsageKb ||
          hashA?.peakMemoryUsageKb ||
          hashB?.peakMemoryUsageKb
        )
        if (!hasHashCtx) return null
        return (
          <>
            <h4 style={{ marginTop: 12 }}>Context evidence: hash build</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  batches: {String(hashA?.hashBatches ?? '—')} (orig {String(hashA?.originalHashBatches ?? '—')})
                  {'\n'}disk: {String(hashA?.diskUsageKb ?? '—')} kB
                  {'\n'}peakMem: {String(hashA?.peakMemoryUsageKb ?? '—')} kB
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  batches: {String(hashB?.hashBatches ?? '—')} (orig {String(hashB?.originalHashBatches ?? '—')})
                  {'\n'}disk: {String(hashB?.diskUsageKb ?? '—')} kB
                  {'\n'}peakMem: {String(hashB?.peakMemoryUsageKb ?? '—')} kB
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {(() => {
        const wasteA = selectedDetail.contextEvidenceA?.scanWaste
        const wasteB = selectedDetail.contextEvidenceB?.scanWaste
        const hasWasteCtx = !!(
          wasteA?.rowsRemovedByFilter ||
          wasteB?.rowsRemovedByFilter ||
          wasteA?.rowsRemovedByIndexRecheck ||
          wasteB?.rowsRemovedByIndexRecheck
        )
        if (!hasWasteCtx) return null
        return (
          <>
            <h4 style={{ marginTop: 12 }}>Context evidence: scan waste</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  node: {String(wasteA?.primaryScanNodeId ?? '—')} {String(wasteA?.primaryScanNodeType ?? '')}
                  {'\n'}rel: {String(wasteA?.relationName ?? '—')}
                  {'\n'}removedByFilter: {String(wasteA?.rowsRemovedByFilter ?? '—')} (share{' '}
                  {String(wasteA?.removedRowsShareApprox ?? '—')})
                  {'\n'}removedByRecheck: {String(wasteA?.rowsRemovedByIndexRecheck ?? '—')}
                  {'\n'}heapFetches: {String(wasteA?.heapFetches ?? '—')}
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  node: {String(wasteB?.primaryScanNodeId ?? '—')} {String(wasteB?.primaryScanNodeType ?? '')}
                  {'\n'}rel: {String(wasteB?.relationName ?? '—')}
                  {'\n'}removedByFilter: {String(wasteB?.rowsRemovedByFilter ?? '—')} (share{' '}
                  {String(wasteB?.removedRowsShareApprox ?? '—')})
                  {'\n'}removedByRecheck: {String(wasteB?.rowsRemovedByIndexRecheck ?? '—')}
                  {'\n'}heapFetches: {String(wasteB?.heapFetches ?? '—')}
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {(() => {
        const r = selectedDetail.rawFields
        const hasSort = !!(
          r.sortMethodA ||
          r.sortMethodB ||
          r.sortSpaceUsedKbA ||
          r.sortSpaceUsedKbB ||
          r.diskUsageKbA ||
          r.diskUsageKbB ||
          r.presortedKeyA ||
          r.presortedKeyB
        )
        if (!hasSort) return null
        return (
          <>
            <h4 style={{ marginTop: 12 }}>Sort details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  method: {String(r.sortMethodA ?? '—')}
                  {'\n'}space: {String(r.sortSpaceUsedKbA ?? '—')} kB ({String(r.sortSpaceTypeA ?? '—')})
                  {'\n'}disk: {String(r.diskUsageKbA ?? '—')} kB
                  {'\n'}presorted: {String(r.presortedKeyA ?? '—')}
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  method: {String(r.sortMethodB ?? '—')}
                  {'\n'}space: {String(r.sortSpaceUsedKbB ?? '—')} kB ({String(r.sortSpaceTypeB ?? '—')})
                  {'\n'}disk: {String(r.diskUsageKbB ?? '—')} kB
                  {'\n'}presorted: {String(r.presortedKeyB ?? '—')}
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {(() => {
        const r = selectedDetail.rawFields
        const hasHash = !!(
          r.hashBatchesA ||
          r.hashBatchesB ||
          r.diskUsageKbA ||
          r.diskUsageKbB ||
          r.hashBucketsA ||
          r.hashBucketsB ||
          r.peakMemoryUsageKbA ||
          r.peakMemoryUsageKbB
        )
        if (!hasHash) return null
        return (
          <>
            <h4 style={{ marginTop: 12 }}>Hash details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  buckets: {String(r.hashBucketsA ?? '—')} (orig {String(r.originalHashBucketsA ?? '—')})
                  {'\n'}batches: {String(r.hashBatchesA ?? '—')} (orig {String(r.originalHashBatchesA ?? '—')})
                  {'\n'}peakMem: {String(r.peakMemoryUsageKbA ?? '—')} kB
                  {'\n'}disk: {String(r.diskUsageKbA ?? '—')} kB
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  buckets: {String(r.hashBucketsB ?? '—')} (orig {String(r.originalHashBucketsB ?? '—')})
                  {'\n'}batches: {String(r.hashBatchesB ?? '—')} (orig {String(r.originalHashBatchesB ?? '—')})
                  {'\n'}peakMem: {String(r.peakMemoryUsageKbB ?? '—')} kB
                  {'\n'}disk: {String(r.diskUsageKbB ?? '—')} kB
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {(() => {
        const r = selectedDetail.rawFields
        const hasParallel =
          r.workersPlannedA != null ||
          r.workersPlannedB != null ||
          r.workersLaunchedA != null ||
          r.workersLaunchedB != null
        if (!hasParallel) return null
        return (
          <>
            <h4 style={{ marginTop: 12 }}>Parallel details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  aware: {String(r.parallelAwareA ?? '—')}
                  {'\n'}workers: {String(r.workersLaunchedA ?? '—')} launched / {String(r.workersPlannedA ?? '—')} planned
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  aware: {String(r.parallelAwareB ?? '—')}
                  {'\n'}workers: {String(r.workersLaunchedB ?? '—')} launched / {String(r.workersPlannedB ?? '—')} planned
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {(() => {
        const r = selectedDetail.rawFields
        const hasWaste =
          r.rowsRemovedByFilterA != null ||
          r.rowsRemovedByFilterB != null ||
          r.rowsRemovedByJoinFilterA != null ||
          r.rowsRemovedByJoinFilterB != null ||
          r.rowsRemovedByIndexRecheckA != null ||
          r.rowsRemovedByIndexRecheckB != null ||
          r.heapFetchesA != null ||
          r.heapFetchesB != null
        if (!hasWaste) return null
        return (
          <>
            <h4 style={{ marginTop: 12 }}>Filter / recheck waste</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  removedByFilter: {String(r.rowsRemovedByFilterA ?? '—')}
                  {'\n'}removedByJoinFilter: {String(r.rowsRemovedByJoinFilterA ?? '—')}
                  {'\n'}removedByRecheck: {String(r.rowsRemovedByIndexRecheckA ?? '—')}
                  {'\n'}heapFetches: {String(r.heapFetchesA ?? '—')}
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  removedByFilter: {String(r.rowsRemovedByFilterB ?? '—')}
                  {'\n'}removedByJoinFilter: {String(r.rowsRemovedByJoinFilterB ?? '—')}
                  {'\n'}removedByRecheck: {String(r.rowsRemovedByIndexRecheckB ?? '—')}
                  {'\n'}heapFetches: {String(r.heapFetchesB ?? '—')}
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {(() => {
        const r = selectedDetail.rawFields
        const hasCache =
          r.cacheHitsA != null ||
          r.cacheHitsB != null ||
          r.cacheMissesA != null ||
          r.cacheMissesB != null ||
          r.cacheKeyA ||
          r.cacheKeyB
        if (!hasCache) return null
        return (
          <>
            <h4 style={{ marginTop: 12 }}>Cache / memoize details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  key: {String(r.cacheKeyA ?? '—')}
                  {'\n'}hits: {String(r.cacheHitsA ?? '—')} misses: {String(r.cacheMissesA ?? '—')}
                  {'\n'}evictions: {String(r.cacheEvictionsA ?? '—')} overflows: {String(r.cacheOverflowsA ?? '—')}
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  key: {String(r.cacheKeyB ?? '—')}
                  {'\n'}hits: {String(r.cacheHitsB ?? '—')} misses: {String(r.cacheMissesB ?? '—')}
                  {'\n'}evictions: {String(r.cacheEvictionsB ?? '—')} overflows: {String(r.cacheOverflowsB ?? '—')}
                </div>
              </div>
            </div>
          </>
        )
      })()}

      <h4 style={{ marginTop: 12 }}>Key metric deltas</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {selectedDetail.metrics.slice(0, 12).map((m) => (
          <div key={m.key} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
              {m.key} · {m.direction}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginTop: 6 }}>
              A: {String(m.a)} → B: {String(m.b)} · Δ {String(m.delta)} ({String(m.deltaPct)})
            </div>
          </div>
        ))}
      </div>

      <h4 style={{ marginTop: 12 }}>Findings for this pair</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <b>A findings ({selectedDetail.findings.findingsA.length})</b>
          <ul style={{ marginTop: 6 }}>
            {selectedDetail.findings.findingsA.slice(0, 10).map((f) => (
              <li key={f.findingId} style={{ fontSize: 13 }}>
                [{f.severity}] {f.ruleId}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <b>B findings ({selectedDetail.findings.findingsB.length})</b>
          <ul style={{ marginTop: 6 }}>
            {selectedDetail.findings.findingsB.slice(0, 10).map((f) => (
              <li key={f.findingId} style={{ fontSize: 13 }}>
                [{f.severity}] {f.ruleId}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <b>Related diff items ({selectedDetail.findings.relatedDiffItems.length})</b>
        <ul style={{ marginTop: 6 }}>
          {selectedDetail.findings.relatedDiffItems.slice(0, 12).map((i, idx) => (
            <li key={`${i.ruleId}-${idx}`} style={{ fontSize: 13 }}>
              {i.changeType} · {i.ruleId} · {String(i.severityA)} → {String(i.severityB)}
            </li>
          ))}
        </ul>
      </div>

      {comparison.diagnostics ? (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer' }}>Matcher diagnostics (A-side candidates)</summary>
          <pre style={{ marginTop: 8, fontSize: 12, overflow: 'auto' }}>{JSON.stringify(comparison.diagnostics, null, 2)}</pre>
        </details>
      ) : null}
    </>
  )
}
