import { useMemo, useState } from 'react'
import type { NodePairDetail, PlanComparisonResult } from '../api/types'
import { comparePlansWithDiagnostics } from '../api/client'
import { findingAnchorLabel, joinLabelAndSubtitle, pairShortLabel } from '../presentation/nodeLabels'
import { joinSideBadgesForPair, joinSideSummaryLinesForPair } from '../presentation/joinPainHints'
import { pairReferenceText } from '../presentation/nodeReferences'

export default function ComparePage() {
  const [planA, setPlanA] = useState('')
  const [planB, setPlanB] = useState('')
  const [comparison, setComparison] = useState<PlanComparisonResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)
  const [filterNodeType, setFilterNodeType] = useState('')
  const [filterFindingChange, setFilterFindingChange] = useState('')

  const summary = comparison?.summary ?? null
  const improved = comparison?.topImprovedNodes ?? []
  const worsened = comparison?.topWorsenedNodes ?? []
  const diffItems = comparison?.findingsDiff?.items ?? []
  const pairDetails = comparison?.pairDetails ?? []
  const unmatchedA = comparison?.unmatchedNodeIdsA ?? []
  const unmatchedB = comparison?.unmatchedNodeIdsB ?? []

  const byIdA = useMemo(() => new Map((comparison?.planA?.nodes ?? []).map((n) => [n.nodeId, n])), [comparison])
  const byIdB = useMemo(() => new Map((comparison?.planB?.nodes ?? []).map((n) => [n.nodeId, n])), [comparison])

  const selectedDefault = useMemo(() => {
    const first = worsened[0] ?? improved[0]
    return first ? { a: first.nodeIdA, b: first.nodeIdB } : null
  }, [improved, worsened])

  const [selectedPair, setSelectedPair] = useState<{ a: string; b: string } | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const effectivePair = selectedPair ?? selectedDefault
  const selectedDetail: NodePairDetail | null = useMemo(() => {
    if (!effectivePair) return null
    return (
      pairDetails.find(
        (p) =>
          p?.identity?.nodeIdA === effectivePair.a &&
          p?.identity?.nodeIdB === effectivePair.b,
      ) ?? null
    )
  }, [effectivePair, pairDetails])

  function pairForDelta(nodeIdA: string, nodeIdB: string) {
    return pairDetails.find((p) => p.identity.nodeIdA === nodeIdA && p.identity.nodeIdB === nodeIdB) ?? null
  }

  function pairSubtitle(pair: NodePairDetail): string | null {
    const aNode = byIdA.get(pair.identity.nodeIdA)
    const bNode = byIdB.get(pair.identity.nodeIdB)
    const aJoin = aNode ? joinLabelAndSubtitle(aNode, byIdA) : null
    const bJoin = bNode ? joinLabelAndSubtitle(bNode, byIdB) : null

    // Prefer the "after" (B) role summary if available.
    const sub = bJoin?.subtitle ?? aJoin?.subtitle ?? null
    return sub
  }

  const filteredWorsened = useMemo(() => {
    const q = filterNodeType.trim().toLowerCase()
    if (!q) return worsened
    return worsened.filter((d) => d.nodeTypeB.toLowerCase().includes(q) || d.nodeTypeA.toLowerCase().includes(q))
  }, [worsened, filterNodeType])

  const filteredImproved = useMemo(() => {
    const q = filterNodeType.trim().toLowerCase()
    if (!q) return improved
    return improved.filter((d) => d.nodeTypeB.toLowerCase().includes(q) || d.nodeTypeA.toLowerCase().includes(q))
  }, [improved, filterNodeType])

  const filteredDiffItems = useMemo(() => {
    const q = filterFindingChange.trim()
    if (!q) return diffItems
    return diffItems.filter((i) => String(i.changeType) === q)
  }, [diffItems, filterFindingChange])

  async function onCompare() {
    setError(null)
    setLoading(true)
    setComparison(null)
    try {
      const a = JSON.parse(planA) as unknown
      const b = JSON.parse(planB) as unknown
      const result = await comparePlansWithDiagnostics(a, b, includeDiagnostics)
      setComparison(result)
      setSelectedPair(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
      <h2>Compare plans</h2>
      <p style={{ opacity: 0.85, marginTop: -8 }}>
        Paste two PostgreSQL JSON plans. This MVP shows a placeholder diff summary until the real node-mapping + delta engine is implemented.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <section>
          <h3>Plan A</h3>
          <textarea
            value={planA}
            onChange={(e) => setPlanA(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 260,
              padding: 12,
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
              fontFamily: 'var(--mono)',
            }}
            placeholder='Paste JSON for Plan A'
          />
        </section>

        <section>
          <h3>Plan B</h3>
          <textarea
            value={planB}
            onChange={(e) => setPlanB(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 260,
              padding: 12,
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
              fontFamily: 'var(--mono)',
            }}
            placeholder='Paste JSON for Plan B'
          />
        </section>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onCompare}
          disabled={loading || planA.trim().length === 0 || planB.trim().length === 0}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--accent-border)',
            background: 'var(--accent-bg)',
            color: 'var(--text-h)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Comparing…' : 'Compare'}
        </button>
        <button
          onClick={() => {
            setPlanA('')
            setPlanB('')
            setComparison(null)
            setError(null)
          }}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-h)',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <label style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}>
          <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
          include matcher diagnostics
        </label>
      </div>

      {error ? (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid #f59e0b', color: 'var(--text-h)' }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      {comparison ? (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>ComparisonId</div>
            <div style={{ fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{comparison.comparisonId}</div>

            <h3 style={{ marginTop: 12 }}>Summary</h3>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'pre-wrap' }}>
              runtimeΔ%: {String(summary?.runtimeDeltaPct)}
              {'\n'}sharedReadΔ%: {String(summary?.sharedReadDeltaPct)}
              {'\n'}nodeCountΔ: {String(summary?.nodeCountDelta)}
              {'\n'}maxDepthΔ: {String(summary?.maxDepthDelta)}
              {'\n'}severeFindingsΔ: {String(summary?.severeFindingsDelta)}
            </div>

            <h3 style={{ marginTop: 12 }}>Narrative</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{comparison.narrative}</p>

            <h3 style={{ marginTop: 12 }}>Unmatched nodes</h3>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
              A-only: {unmatchedA.length} · B-only: {unmatchedB.length}
            </div>
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>Show unmatched</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                <div>
                  <b>A-only</b>
                  <ul style={{ marginTop: 6 }}>
                    {unmatchedA.slice(0, 60).map((id) => (
                      <li key={id} style={{ fontSize: 13 }}>{findingAnchorLabel(id, byIdA)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <b>B-only</b>
                  <ul style={{ marginTop: 6 }}>
                    {unmatchedB.slice(0, 60).map((id) => (
                      <li key={id} style={{ fontSize: 13 }}>{findingAnchorLabel(id, byIdB)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          </div>

          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <input
                value={filterNodeType}
                onChange={(e) => setFilterNodeType(e.target.value)}
                placeholder="Filter by node type"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-h)' }}
              />
              <button
                onClick={() => {
                  const first = filteredWorsened[0] ?? filteredImproved[0]
                  if (first) setSelectedPair({ a: first.nodeIdA, b: first.nodeIdB })
                }}
                style={{ padding: '10px 12px', borderRadius: 12 }}
              >
                jump to hottest
              </button>
            </div>
            <h3 style={{ marginTop: 0 }}>Top worsened</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredWorsened.slice(0, 8).map((d) => (
                (() => {
                  const pair = pairForDelta(d.nodeIdA, d.nodeIdB)
                  const badges = pair ? joinSideBadgesForPair(pair, byIdA, byIdB, 3) : []
                  const label = pair ? pairShortLabel(pair, byIdA, byIdB) : `${d.nodeTypeA} → ${d.nodeTypeB}`
                  const subtitle = pair ? pairSubtitle(pair) : null
                  return (
                <button
                  key={`${d.nodeIdA}-${d.nodeIdB}`}
                  onClick={() => setSelectedPair({ a: d.nodeIdA, b: d.nodeIdB })}
                  style={{ textAlign: 'left', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 800 }}>{label}</div>
                  {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{subtitle}</div> : null}
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                    conf {d.matchConfidence} · score {Number(d.matchScore).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    inclusiveΔ: {String(d.inclusiveTimeMs?.delta)}ms, readsΔ: {String(d.sharedReadBlocks?.delta)}
                  </div>
                  {badges.length ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {badges.map((b) => (
                        <span
                          key={b.text}
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            padding: '4px 8px',
                            borderRadius: 999,
                            border: '1px solid var(--border)',
                            background:
                              b.tone === 'good'
                                ? 'color-mix(in srgb, #22c55e 18%, transparent)'
                                : b.tone === 'bad'
                                  ? 'color-mix(in srgb, #ef4444 18%, transparent)'
                                  : b.tone === 'mixed'
                                    ? 'color-mix(in srgb, #f59e0b 18%, transparent)'
                                    : 'transparent',
                          }}
                        >
                          {b.text}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
                  )
                })()
              ))}
            </div>

            <h3 style={{ marginTop: 12 }}>Top improved</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredImproved.slice(0, 8).map((d) => (
                (() => {
                  const pair = pairForDelta(d.nodeIdA, d.nodeIdB)
                  const badges = pair ? joinSideBadgesForPair(pair, byIdA, byIdB, 3) : []
                  const label = pair ? pairShortLabel(pair, byIdA, byIdB) : `${d.nodeTypeA} → ${d.nodeTypeB}`
                  const subtitle = pair ? pairSubtitle(pair) : null
                  return (
                <button
                  key={`${d.nodeIdA}-${d.nodeIdB}`}
                  onClick={() => setSelectedPair({ a: d.nodeIdA, b: d.nodeIdB })}
                  style={{ textAlign: 'left', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 800 }}>{label}</div>
                  {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{subtitle}</div> : null}
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                    conf {d.matchConfidence} · score {Number(d.matchScore).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    inclusiveΔ: {String(d.inclusiveTimeMs?.delta)}ms, readsΔ: {String(d.sharedReadBlocks?.delta)}
                  </div>
                  {badges.length ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {badges.map((b) => (
                        <span
                          key={b.text}
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            padding: '4px 8px',
                            borderRadius: 999,
                            border: '1px solid var(--border)',
                            background:
                              b.tone === 'good'
                                ? 'color-mix(in srgb, #22c55e 18%, transparent)'
                                : b.tone === 'bad'
                                  ? 'color-mix(in srgb, #ef4444 18%, transparent)'
                                  : b.tone === 'mixed'
                                    ? 'color-mix(in srgb, #f59e0b 18%, transparent)'
                                    : 'transparent',
                          }}
                        >
                          {b.text}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
                  )
                })()
              ))}
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ marginTop: 0 }}>Findings diff</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <select value={filterFindingChange} onChange={(e) => setFilterFindingChange(e.target.value)} style={{ padding: '10px 12px', borderRadius: 12 }}>
                <option value="">all</option>
                <option value="New">New</option>
                <option value="Resolved">Resolved</option>
                <option value="Worsened">Worsened</option>
                <option value="Improved">Improved</option>
                <option value="Unchanged">Unchanged</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredDiffItems.slice(0, 30).map((i, idx) => (
                <button
                  key={`${i.ruleId}-${idx}`}
                  onClick={() => {
                    if (i.nodeIdA && i.nodeIdB) setSelectedPair({ a: i.nodeIdA, b: i.nodeIdB })
                  }}
                  style={{ textAlign: 'left', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
                    {i.changeType} · {i.ruleId} · {String(i.severityA)} → {String(i.severityB)}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                    {findingAnchorLabel(i.nodeIdB ?? i.nodeIdA, i.nodeIdB ? byIdB : byIdA)}
                  </div>
                  <div style={{ fontSize: 13 }}>{i.summary}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ marginTop: 0 }}>Selected node pair</h3>
            {selectedDetail ? (
              <div style={{ fontWeight: 800 }}>{pairShortLabel(selectedDetail, byIdA, byIdB)}</div>
            ) : (
              <div style={{ opacity: 0.85 }}>Select an improved/worsened row or a diff finding to inspect.</div>
            )}
            {selectedDetail ? (
              <>
                <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={async () => {
                      const text = pairReferenceText(selectedDetail, byIdA, byIdB)
                      await navigator.clipboard.writeText(text)
                      setCopyStatus('Copied pair reference')
                      setTimeout(() => setCopyStatus(null), 1200)
                    }}
                    style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
                  >
                    Copy reference
                  </button>
                  {copyStatus ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyStatus}</div> : null}
                </div>
                {pairSubtitle(selectedDetail) ? (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{pairSubtitle(selectedDetail)}</div>
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
                <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
                  confidence: {selectedDetail.identity.matchConfidence} · score {Number(selectedDetail.identity.matchScore).toFixed(2)}
                </div>
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
                      {selectedDetail.identity.nodeTypeA} {selectedDetail.identity.relationNameA ? `(${selectedDetail.identity.relationNameA})` : ''}
                    </div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                    <b>Plan B</b>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginTop: 6 }}>
                      {selectedDetail.identity.nodeTypeB} {selectedDetail.identity.relationNameB ? `(${selectedDetail.identity.relationNameB})` : ''}
                    </div>
                  </div>
                </div>

                {(() => {
                  const ctxA = selectedDetail.contextEvidenceA
                  const ctxB = selectedDetail.contextEvidenceB
                  const hashA = ctxA?.hashJoin?.childHash
                  const hashB = ctxB?.hashJoin?.childHash
                  const hasHashCtx = !!(hashA?.hashBatches || hashB?.hashBatches || hashA?.diskUsageKb || hashB?.diskUsageKb || hashA?.peakMemoryUsageKb || hashB?.peakMemoryUsageKb)
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
                  const hasWasteCtx = !!(wasteA?.rowsRemovedByFilter || wasteB?.rowsRemovedByFilter || wasteA?.rowsRemovedByIndexRecheck || wasteB?.rowsRemovedByIndexRecheck)
                  if (!hasWasteCtx) return null
                  return (
                    <>
                      <h4 style={{ marginTop: 12 }}>Context evidence: scan waste</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                            node: {String(wasteA?.primaryScanNodeId ?? '—')} {String(wasteA?.primaryScanNodeType ?? '')}
                            {'\n'}rel: {String(wasteA?.relationName ?? '—')}
                            {'\n'}removedByFilter: {String(wasteA?.rowsRemovedByFilter ?? '—')} (share {String(wasteA?.removedRowsShareApprox ?? '—')})
                            {'\n'}removedByRecheck: {String(wasteA?.rowsRemovedByIndexRecheck ?? '—')}
                            {'\n'}heapFetches: {String(wasteA?.heapFetches ?? '—')}
                          </div>
                        </div>
                        <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                            node: {String(wasteB?.primaryScanNodeId ?? '—')} {String(wasteB?.primaryScanNodeType ?? '')}
                            {'\n'}rel: {String(wasteB?.relationName ?? '—')}
                            {'\n'}removedByFilter: {String(wasteB?.rowsRemovedByFilter ?? '—')} (share {String(wasteB?.removedRowsShareApprox ?? '—')})
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
                  const hasSort =
                    !!(r.sortMethodA || r.sortMethodB || r.sortSpaceUsedKbA || r.sortSpaceUsedKbB || r.diskUsageKbA || r.diskUsageKbB || r.presortedKeyA || r.presortedKeyB)
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
                  const hasHash =
                    !!(r.hashBatchesA || r.hashBatchesB || r.diskUsageKbA || r.diskUsageKbB || r.hashBucketsA || r.hashBucketsB || r.peakMemoryUsageKbA || r.peakMemoryUsageKbB)
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
                  const hasParallel = r.workersPlannedA != null || r.workersPlannedB != null || r.workersLaunchedA != null || r.workersLaunchedB != null
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
                    r.cacheHitsA != null || r.cacheHitsB != null || r.cacheMissesA != null || r.cacheMissesB != null || r.cacheKeyA || r.cacheKeyB
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
            ) : (
              <p style={{ opacity: 0.85, marginTop: 8 }}>
                Select an improved/worsened node or diff finding to inspect a matched pair.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}

