import { useMemo, useState } from 'react'
import type { NodePairDetail, PlanComparisonResult } from '../api/types'
import { comparePlansWithDiagnostics } from '../api/client'
import { findingAnchorLabel, joinLabelAndSubtitle, pairShortLabel } from '../presentation/nodeLabels'
import { joinSideBadgesForPair, joinSideSummaryLinesForPair } from '../presentation/joinPainHints'
import { findingReferenceText, pairReferenceText } from '../presentation/nodeReferences'
import { buildCompareSummaryCards, compareCoverageLine, compareEmptyStateCopy, compareIntroCopy, compareWhatChangedMostCopy } from '../presentation/comparePresentation'
import { useCopyFeedback } from '../presentation/useCopyFeedback'

export default function ComparePage() {
  const [planA, setPlanA] = useState('')
  const [planB, setPlanB] = useState('')
  const [comparison, setComparison] = useState<PlanComparisonResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)
  const [filterNodeType, setFilterNodeType] = useState('')
  const [filterFindingChange, setFilterFindingChange] = useState('')

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
  const copyPair = useCopyFeedback()
  const copyFinding = useCopyFeedback()

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

  const intro = compareIntroCopy()
  const empty = compareEmptyStateCopy()
  const whatChangedMost = compareWhatChangedMostCopy()
  const coverage = compareCoverageLine(comparison)
  const summaryCards = buildCompareSummaryCards(comparison)
  const findingsNewCount = diffItems.filter((i) => String(i.changeType) === 'New').length
  const findingsResolvedCount = diffItems.filter((i) => String(i.changeType) === 'Resolved').length

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
      <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
        <h2 style={{ marginTop: 0 }}>{intro.title}</h2>
        <div style={{ opacity: 0.88, marginTop: -6 }}>{intro.subtitle}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <div style={{ padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'color-mix(in srgb, var(--accent-bg) 16%, transparent)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>What you’ll get</div>
            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
              {intro.bullets.map((b) => (
                <li key={b} style={{ marginBottom: 4 }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>Input tips</div>
            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
              {intro.inputHints.map((h) => (
                <li key={h} style={{ marginBottom: 4 }}>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <section>
          <h3 style={{ marginBottom: 6 }}>Plan A</h3>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: -6, marginBottom: 8 }}>“Before” (baseline), if you have one.</div>
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
            placeholder="Paste JSON for Plan A (EXPLAIN ... FORMAT JSON)"
          />
        </section>

        <section>
          <h3 style={{ marginBottom: 6 }}>Plan B</h3>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: -6, marginBottom: 8 }}>“After” (changed plan) — index/rewrite/config change.</div>
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
            placeholder="Paste JSON for Plan B (EXPLAIN ... FORMAT JSON)"
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
        <details style={{ marginLeft: 6, opacity: 0.9 }}>
          <summary style={{ cursor: 'pointer' }}>Advanced</summary>
          <label style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
            include matcher diagnostics
          </label>
        </details>
      </div>

      {error ? (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid #f59e0b', color: 'var(--text-h)' }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      {!comparison && !loading && !error ? (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', opacity: 0.9 }}>
          <div style={{ fontWeight: 900 }}>{empty.title}</div>
          <div style={{ marginTop: 6 }}>{empty.body}</div>
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 900 }}>Comparing…</div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>Mapping nodes and computing deltas. This usually takes a moment for large plans.</div>
        </div>
      ) : null}

      {comparison ? (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>Summary</h3>
                {coverage ? <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.8 }}>{coverage}</div> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
                {summaryCards.map((c) => (
                  <div
                    key={c.key}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background:
                        c.tone === 'good'
                          ? 'color-mix(in srgb, #22c55e 12%, transparent)'
                          : c.tone === 'bad'
                            ? 'color-mix(in srgb, #ef4444 12%, transparent)'
                            : 'transparent',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.8 }}>{c.label}</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{c.value}</div>
                    {c.deltaLabel ? <div style={{ marginTop: 2, fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>{c.deltaLabel}</div> : null}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
                  findings: +{findingsNewCount} new · -{findingsResolvedCount} resolved
                </div>
                <details style={{ opacity: 0.9 }}>
                  <summary style={{ cursor: 'pointer' }}>Narrative</summary>
                  <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{comparison.narrative}</div>
                </details>
                <details style={{ opacity: 0.9 }}>
                  <summary style={{ cursor: 'pointer' }}>Debug ids</summary>
                  <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12, wordBreak: 'break-all' }}>{comparison.comparisonId}</div>
                </details>
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ marginTop: 0 }}>{whatChangedMost.title}</h3>
              <div style={{ marginTop: -6, opacity: 0.85 }}>{whatChangedMost.subtitle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 10 }}>
                {worsened[0] ? (
                  <button
                    onClick={() => setSelectedPair({ a: worsened[0].nodeIdA, b: worsened[0].nodeIdB })}
                    style={{ textAlign: 'left', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'color-mix(in srgb, #ef4444 10%, transparent)', cursor: 'pointer' }}
                  >
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>Top worsened</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>
                      {pairForDelta(worsened[0].nodeIdA, worsened[0].nodeIdB)
                        ? pairShortLabel(pairForDelta(worsened[0].nodeIdA, worsened[0].nodeIdB)!, byIdA, byIdB)
                        : `${worsened[0].nodeTypeA} → ${worsened[0].nodeTypeB}`}
                    </div>
                  </button>
                ) : null}
                {improved[0] ? (
                  <button
                    onClick={() => setSelectedPair({ a: improved[0].nodeIdA, b: improved[0].nodeIdB })}
                    style={{ textAlign: 'left', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'color-mix(in srgb, #22c55e 10%, transparent)', cursor: 'pointer' }}
                  >
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>Top improved</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>
                      {pairForDelta(improved[0].nodeIdA, improved[0].nodeIdB)
                        ? pairShortLabel(pairForDelta(improved[0].nodeIdA, improved[0].nodeIdB)!, byIdA, byIdB)
                        : `${improved[0].nodeTypeA} → ${improved[0].nodeTypeB}`}
                    </div>
                  </button>
                ) : null}
              </div>
              {!worsened.length && !improved.length ? (
                <div style={{ marginTop: 10, opacity: 0.85 }}>No top-changes were emitted. This usually means missing timing/buffer evidence or very small plans.</div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <input
                  value={filterNodeType}
                  onChange={(e) => setFilterNodeType(e.target.value)}
                  placeholder="Filter by node type"
                  style={{ flex: 1, minWidth: 220, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-h)' }}
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

              <h3 style={{ marginTop: 0 }}>Navigator</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                    <div style={{ fontWeight: 900 }}>Worsened</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.8 }}>{filteredWorsened.length} shown</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
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
                            style={{ textAlign: 'left', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                          >
                            <div style={{ fontWeight: 900 }}>{label}</div>
                            {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{subtitle}</div> : null}
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>
                                conf {d.matchConfidence} · score {Number(d.matchScore).toFixed(2)}
                              </div>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>
                                inclusiveΔ {String(d.inclusiveTimeMs?.delta)}ms · readsΔ {String(d.sharedReadBlocks?.delta)}
                              </div>
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

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                    <div style={{ fontWeight: 900 }}>Improved</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.8 }}>{filteredImproved.length} shown</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
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
                            style={{ textAlign: 'left', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                          >
                            <div style={{ fontWeight: 900 }}>{label}</div>
                            {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{subtitle}</div> : null}
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>
                                conf {d.matchConfidence} · score {Number(d.matchScore).toFixed(2)}
                              </div>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>
                                inclusiveΔ {String(d.inclusiveTimeMs?.delta)}ms · readsΔ {String(d.sharedReadBlocks?.delta)}
                              </div>
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

                <div>
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
                      <div
                        key={`${i.ruleId}-${idx}`}
                        onClick={() => {
                          if (i.nodeIdA && i.nodeIdB) setSelectedPair({ a: i.nodeIdA, b: i.nodeIdB })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (i.nodeIdA && i.nodeIdB) setSelectedPair({ a: i.nodeIdA, b: i.nodeIdB })
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        style={{ textAlign: 'left', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                      >
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
                          {i.changeType} · {i.ruleId} · {String(i.severityA)} → {String(i.severityB)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 4 }}>
                          <div style={{ fontSize: 13, opacity: 0.85 }}>
                            {findingAnchorLabel(i.nodeIdB ?? i.nodeIdA, i.nodeIdB ? byIdB : byIdA)}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const nid = i.nodeIdB ?? i.nodeIdA
                              if (!nid) return
                              copyFinding.copy(
                                findingReferenceText(nid, i.nodeIdB ? byIdB : byIdA, `${i.changeType} finding: ${i.ruleId}`),
                                'Copied finding reference',
                              )
                            }}
                            style={{ padding: '4px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 12, opacity: 0.9 }}
                            title="Copy finding reference"
                          >
                            Copy
                          </button>
                        </div>
                        <div style={{ fontSize: 13 }}>{i.summary}</div>
                      </div>
                    ))}
                  </div>
                  {copyFinding.status ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>{copyFinding.status}</div> : null}
                </div>

                <details style={{ opacity: 0.9 }}>
                  <summary style={{ cursor: 'pointer' }}>Unmatched nodes</summary>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9, marginTop: 6 }}>
                    A-only: {unmatchedA.length} · B-only: {unmatchedB.length}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <div>
                      <b>A-only</b>
                      <ul style={{ marginTop: 6 }}>
                        {unmatchedA.slice(0, 60).map((id) => (
                          <li key={id} style={{ fontSize: 13 }}>
                            {findingAnchorLabel(id, byIdA)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <b>B-only</b>
                      <ul style={{ marginTop: 6 }}>
                        {unmatchedB.slice(0, 60).map((id) => (
                          <li key={id} style={{ fontSize: 13 }}>
                            {findingAnchorLabel(id, byIdB)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
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
                      await copyPair.copy(text, 'Copied pair reference')
                    }}
                    style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
                  >
                    Copy reference
                  </button>
                  {copyPair.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyPair.status}</div> : null}
                </div>
                {pairSubtitle(selectedDetail) ? (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{pairSubtitle(selectedDetail)}</div>
                ) : null}
                <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
                    confidence: {selectedDetail.identity.matchConfidence} · score {Number(selectedDetail.identity.matchScore).toFixed(2)}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
                    depth {selectedDetail.identity.depthA} → {selectedDetail.identity.depthB}
                  </div>
                </div>
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
          </div>
        </section>
      ) : null}
    </div>
  )
}

