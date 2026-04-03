import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { NodePairDetail, PlanAnalysisResult, PlanComparisonResult } from '../api/types'
import {
  compareWithPlanTexts,
  ComparePlanParseError,
  ComparisonNotFoundError,
  getComparison,
} from '../api/client'
import { buildCompareBranchViewModel, resolveFindingDiffPair } from '../presentation/compareBranchContext'
import { findingAnchorLabel, joinLabelAndSubtitle, nodeShortLabel, pairShortLabel } from '../presentation/nodeLabels'
import { joinSideBadgesForPair, joinSideSummaryLinesForPair } from '../presentation/joinPainHints'
import { findingReferenceText, pairReferenceText } from '../presentation/nodeReferences'
import { relatedIndexDeltaCue, relatedFindingChangesCue } from '../presentation/compareIndexLinks'
import {
  buildCompareIndexSectionModel,
  buildCompareSummaryCards,
  compareCoverageLine,
  compareEmptyStateCopy,
  compareIntroCopy,
  compareWhatChangedMostCopy,
} from '../presentation/comparePresentation'
import { accessPathChangeCue } from '../presentation/indexInsightPresentation'
import {
  compareSuggestionsByPriority,
  optimizationCategoryLabel,
  suggestionConfidenceLabel,
  suggestionPriorityLabel,
} from '../presentation/optimizationSuggestionsPresentation'
import {
  ArtifactDomKind,
  buildCompareDeepLinkSearchParams,
  compareDeepLinkPath,
  CompareDeepLinkParam,
  scrollArtifactIntoView,
} from '../presentation/artifactLinks'
import { buildSuggestedExplainSql } from '../presentation/explainCommandBuilder'
import { formatDeclaredExplainOptionsLine, plannerCostsLabel } from '../presentation/explainMetadataPresentation'
import { useCopyFeedback } from '../presentation/useCopyFeedback'
import { CompareBranchStrip } from '../components/CompareBranchStrip'
import { ClickableRow } from '../components/ClickableRow'
import { ReferenceCopyButton } from '../components/ReferenceCopyButton'

function CaptureContextColumn({ title, plan }: { title: string; plan: PlanAnalysisResult }) {
  const optLine = formatDeclaredExplainOptionsLine(plan.explainMetadata ?? null)
  const norm = plan.planInputNormalization
  return (
    <div style={{ padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
        <li>Source query: {plan.queryText?.trim() ? 'provided' : 'not provided'}</li>
        <li>{plannerCostsLabel(plan.summary.plannerCosts)}</li>
        <li>
          Input normalization:{' '}
          {!norm
            ? 'not recorded'
            : norm.kind === 'rawJson'
              ? 'Parsed raw JSON directly'
              : norm.kind === 'queryPlanTable'
                ? 'Normalized QUERY PLAN output'
                : norm.kind}
        </li>
        {optLine ? <li>Declared options (client): {optLine}</li> : <li>No declared EXPLAIN options in payload.</li>}
        {plan.explainMetadata?.sourceExplainCommand?.trim() ? (
          <li style={{ marginTop: 6 }}>
            <span style={{ opacity: 0.85 }}>Recorded command</span>
            <pre style={{ margin: '4px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)' }}>
              {plan.explainMetadata.sourceExplainCommand.trim()}
            </pre>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

export default function ComparePage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [planA, setPlanA] = useState('')
  const [planB, setPlanB] = useState('')
  const [comparison, setComparison] = useState<PlanComparisonResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)
  const [filterNodeType, setFilterNodeType] = useState('')
  const [filterFindingChange, setFilterFindingChange] = useState('')
  const [queryTextA, setQueryTextA] = useState('')
  const [queryTextB, setQueryTextB] = useState('')
  const [sendCompareExplainMetadata, setSendCompareExplainMetadata] = useState(true)
  const [compareExplainToggles, setCompareExplainToggles] = useState({
    analyze: true,
    verbose: true,
    buffers: true,
    costs: true,
  })
  const [recordedCommandA, setRecordedCommandA] = useState('')
  const [recordedCommandB, setRecordedCommandB] = useState('')
  const [loadingPersistedComparison, setLoadingPersistedComparison] = useState(false)

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

  const urlResolvedPair = useMemo(() => {
    if (!comparison) return null
    const q = new URLSearchParams(location.search).get('pair')
    if (!q) return null
    const pd = pairDetails.find((p) => p.pairArtifactId === q)
    return pd ? { a: pd.identity.nodeIdA, b: pd.identity.nodeIdB } : null
  }, [comparison, pairDetails, location.search])

  const [selectedPair, setSelectedPair] = useState<{ a: string; b: string } | null>(null)
  const [highlightFindingDiffId, setHighlightFindingDiffId] = useState<string | null>(null)
  const [highlightIndexInsightDiffId, setHighlightIndexInsightDiffId] = useState<string | null>(null)
  const [highlightSuggestionId, setHighlightSuggestionId] = useState<string | null>(null)
  const copyPair = useCopyFeedback()
  const copyFinding = useCopyFeedback()
  const copyNav = useCopyFeedback()
  const copyDeepLink = useCopyFeedback()
  const copyShareCompare = useCopyFeedback()
  const lastSyncedCompareQs = useRef<string | null>(null)
  const hydratedCompareHighlightFor = useRef<string | null>(null)
  const loadPersistedCompareSeqRef = useRef(0)
  const urlComparisonId = searchParams.get(CompareDeepLinkParam.comparison)?.trim() ?? ''

  const suggestedExplainA = useMemo(
    () => buildSuggestedExplainSql(queryTextA, compareExplainToggles),
    [queryTextA, compareExplainToggles.analyze, compareExplainToggles.verbose, compareExplainToggles.buffers, compareExplainToggles.costs],
  )
  const suggestedExplainB = useMemo(
    () => buildSuggestedExplainSql(queryTextB, compareExplainToggles),
    [queryTextB, compareExplainToggles.analyze, compareExplainToggles.verbose, compareExplainToggles.buffers, compareExplainToggles.costs],
  )

  useEffect(() => {
    if (!urlComparisonId) return
    if (comparison?.comparisonId === urlComparisonId) return
    let cancelled = false
    const seq = ++loadPersistedCompareSeqRef.current
    setLoadingPersistedComparison(true)
    setError(null)
    ;(async () => {
      try {
        const data = await getComparison(urlComparisonId)
        if (cancelled || loadPersistedCompareSeqRef.current !== seq) return
        setComparison(data)
        setPlanA('')
        setPlanB('')
      } catch (e) {
        if (cancelled || loadPersistedCompareSeqRef.current !== seq) return
        setComparison(null)
        setError(
          e instanceof ComparisonNotFoundError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e),
        )
      } finally {
        if (!cancelled && loadPersistedCompareSeqRef.current === seq) setLoadingPersistedComparison(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [urlComparisonId, comparison?.comparisonId])

  const effectivePair = selectedPair ?? urlResolvedPair ?? selectedDefault
  const pairSelected = (nodeIdA: string, nodeIdB: string) =>
    effectivePair != null && effectivePair.a === nodeIdA && effectivePair.b === nodeIdB

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

  const branchViewModel = useMemo(() => {
    if (!comparison || !effectivePair) return null
    return buildCompareBranchViewModel(comparison, effectivePair, selectedDetail)
  }, [comparison, effectivePair, selectedDetail])

  const branchPairHeading = useMemo(() => {
    if (!effectivePair) return null
    if (selectedDetail) return pairShortLabel(selectedDetail, byIdA, byIdB)
    const aN = byIdA.get(effectivePair.a)
    const bN = byIdB.get(effectivePair.b)
    if (aN && bN) return `${nodeShortLabel(aN, byIdA)} → ${nodeShortLabel(bN, byIdB)}`
    return null
  }, [effectivePair, selectedDetail, byIdA, byIdB])

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
  const indexSection = comparison ? buildCompareIndexSectionModel(comparison) : null
  const findingsNewCount = diffItems.filter((i) => String(i.changeType) === 'New').length
  const findingsResolvedCount = diffItems.filter((i) => String(i.changeType) === 'Resolved').length

  const compareOptimizationTop = useMemo(() => {
    const raw = comparison?.compareOptimizationSuggestions ?? []
    return [...raw].sort(compareSuggestionsByPriority).slice(0, 5)
  }, [comparison])

  const compareOptForPair = useMemo(() => {
    if (!comparison?.compareOptimizationSuggestions?.length || !effectivePair) return null
    const b = effectivePair.b
    const hit = comparison.compareOptimizationSuggestions.filter((s) => (s.targetNodeIds ?? []).includes(b))
    return hit.sort(compareSuggestionsByPriority)[0] ?? null
  }, [comparison, effectivePair])

  useLayoutEffect(() => {
    if (!comparison) {
      hydratedCompareHighlightFor.current = null
      return
    }
    if (hydratedCompareHighlightFor.current === comparison.comparisonId) return
    hydratedCompareHighlightFor.current = comparison.comparisonId

    const finding = new URLSearchParams(location.search).get('finding')
    const indexDiff = new URLSearchParams(location.search).get('indexDiff')
    const suggestion = new URLSearchParams(location.search).get('suggestion')
    if (finding && comparison.findingsDiff.items.some((x) => x.diffId === finding)) setHighlightFindingDiffId(finding)
    else setHighlightFindingDiffId(null)
    const insightDiffs = comparison.indexComparison?.insightDiffs ?? []
    if (indexDiff && insightDiffs.some((x) => x.insightDiffId === indexDiff)) {
      setHighlightIndexInsightDiffId(indexDiff)
    } else setHighlightIndexInsightDiffId(null)
    if (
      suggestion &&
      (comparison.compareOptimizationSuggestions ?? []).some((x) => x.suggestionId === suggestion)
    ) {
      setHighlightSuggestionId(suggestion)
    } else setHighlightSuggestionId(null)
  }, [comparison, location.search])

  useEffect(() => {
    lastSyncedCompareQs.current = null
  }, [comparison?.comparisonId])

  useEffect(() => {
    if (!comparison) return
    const urlPair = new URLSearchParams(location.search).get('pair')
    const urlPairValid = Boolean(urlPair && pairDetails.some((p) => p.pairArtifactId === urlPair))

    const pdExplicit =
      selectedPair != null
        ? pairDetails.find((p) => p.identity.nodeIdA === selectedPair.a && p.identity.nodeIdB === selectedPair.b)
        : null
    const pdEffective =
      effectivePair != null
        ? pairDetails.find((p) => p.identity.nodeIdA === effectivePair.a && p.identity.nodeIdB === effectivePair.b)
        : null

    const pairArtifactId =
      selectedPair != null
        ? pdExplicit?.pairArtifactId ?? null
        : urlPairValid
          ? urlPair!
          : pdEffective?.pairArtifactId ?? null

    const insightDiffs = comparison.indexComparison?.insightDiffs ?? []
    const findingParam = new URLSearchParams(location.search).get('finding')
    const findingDiffId =
      highlightFindingDiffId ??
      (findingParam && comparison.findingsDiff.items.some((x) => x.diffId === findingParam) ? findingParam : null)

    const indexParam = new URLSearchParams(location.search).get('indexDiff')
    const indexInsightDiffId =
      highlightIndexInsightDiffId ??
      (indexParam && insightDiffs.some((x) => x.insightDiffId === indexParam) ? indexParam : null)

    const sugParam = new URLSearchParams(location.search).get('suggestion')
    const suggestionId =
      highlightSuggestionId ??
      (sugParam && (comparison.compareOptimizationSuggestions ?? []).some((s) => s.suggestionId === sugParam)
        ? sugParam
        : null)

    const next = buildCompareDeepLinkSearchParams({
      comparisonId: comparison.comparisonId,
      pairArtifactId,
      findingDiffId,
      indexInsightDiffId,
      suggestionId,
    })
    const nextQs = next.toString()
    const curNorm = location.search.startsWith('?') ? location.search.slice(1) : location.search
    if (nextQs === curNorm) {
      lastSyncedCompareQs.current = nextQs
      return
    }
    if (nextQs === lastSyncedCompareQs.current) return
    lastSyncedCompareQs.current = nextQs
    setSearchParams(next, { replace: true })
  }, [
    comparison,
    comparison?.comparisonId,
    effectivePair?.a,
    effectivePair?.b,
    selectedPair?.a,
    selectedPair?.b,
    pairDetails,
    highlightFindingDiffId,
    highlightIndexInsightDiffId,
    highlightSuggestionId,
    location.search,
    setSearchParams,
  ])

  useEffect(() => {
    if (!highlightFindingDiffId) return
    const t = window.setTimeout(
      () => scrollArtifactIntoView(ArtifactDomKind.findingDiff, highlightFindingDiffId),
      60,
    )
    return () => window.clearTimeout(t)
  }, [highlightFindingDiffId, comparison?.comparisonId])

  useEffect(() => {
    if (!highlightIndexInsightDiffId) return
    const t = window.setTimeout(
      () => scrollArtifactIntoView(ArtifactDomKind.indexInsightDiff, highlightIndexInsightDiffId),
      60,
    )
    return () => window.clearTimeout(t)
  }, [highlightIndexInsightDiffId, comparison?.comparisonId])

  useEffect(() => {
    if (!highlightSuggestionId) return
    const t = window.setTimeout(
      () => scrollArtifactIntoView(ArtifactDomKind.compareSuggestion, highlightSuggestionId),
      60,
    )
    return () => window.clearTimeout(t)
  }, [highlightSuggestionId, comparison?.comparisonId])

  async function onCompare() {
    setError(null)
    setLoading(true)
    const p = new URLSearchParams(location.search)
    p.delete(CompareDeepLinkParam.comparison)
    lastSyncedCompareQs.current = null
    setSearchParams(p, { replace: true })
    loadPersistedCompareSeqRef.current += 1
    setComparison(null)
    try {
      const result = await compareWithPlanTexts({
        planAText: planA,
        planBText: planB,
        queryTextA,
        queryTextB,
        diagnostics: includeDiagnostics,
        explainMetadataA: sendCompareExplainMetadata
          ? {
              options: {
                format: 'json',
                analyze: compareExplainToggles.analyze,
                verbose: compareExplainToggles.verbose,
                buffers: compareExplainToggles.buffers,
                costs: compareExplainToggles.costs,
              },
              sourceExplainCommand: recordedCommandA.trim() || null,
            }
          : undefined,
        explainMetadataB: sendCompareExplainMetadata
          ? {
              options: {
                format: 'json',
                analyze: compareExplainToggles.analyze,
                verbose: compareExplainToggles.verbose,
                buffers: compareExplainToggles.buffers,
                costs: compareExplainToggles.costs,
              },
              sourceExplainCommand: recordedCommandB.trim() || null,
            }
          : undefined,
      })
      setComparison(result)
      setSelectedPair(null)
      setHighlightFindingDiffId(null)
      setHighlightIndexInsightDiffId(null)
      setHighlightSuggestionId(null)
    } catch (e) {
      if (e instanceof ComparePlanParseError) {
        const parts = [`[${e.side}]`, e.message, e.hint].filter((x) => x && String(x).trim().length)
        setError(parts.join(' '))
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
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
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: -6, marginBottom: 8 }}>
            “Before” (baseline). Paste JSON or <code>psql</code> <code>QUERY PLAN</code> cell text (same normalization as Analyze).
          </div>
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
            placeholder="Plan A: JSON or QUERY PLAN output"
          />
        </section>

        <section>
          <h3 style={{ marginBottom: 6 }}>Plan B</h3>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: -6, marginBottom: 8 }}>
            “After” (changed plan). Same input shapes as Plan A.
          </div>
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
            placeholder="Plan B: JSON or QUERY PLAN output"
          />
        </section>
      </div>

      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', opacity: 0.9 }}>Optional: source SQL + EXPLAIN metadata (per side)</summary>
        <p style={{ fontSize: 12, opacity: 0.82, marginTop: 8 }}>
          Stored with the comparison on the server (SQLite). Toggle options apply to <b>both</b> sides; recorded commands are separate.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={sendCompareExplainMetadata}
            onChange={(e) => setSendCompareExplainMetadata(e.target.checked)}
          />
          Send EXPLAIN options with compare request
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 13 }}>
          {(
            [
              ['analyze', 'ANALYZE'],
              ['verbose', 'VERBOSE'],
              ['buffers', 'BUFFERS'],
              ['costs', 'COSTS'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={compareExplainToggles[k]}
                onChange={(e) => setCompareExplainToggles((prev) => ({ ...prev, [k]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <label style={{ fontSize: 12, opacity: 0.85 }}>
            Source SQL — Plan A
            <textarea
              value={queryTextA}
              onChange={(e) => setQueryTextA(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 72,
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-h)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
              }}
              placeholder="SELECT ... (plan A)"
            />
          </label>
          <label style={{ fontSize: 12, opacity: 0.85 }}>
            Source SQL — Plan B
            <textarea
              value={queryTextB}
              onChange={(e) => setQueryTextB(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 72,
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-h)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
              }}
              placeholder="SELECT ... (plan B)"
            />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
          <label style={{ fontSize: 11, opacity: 0.85 }}>
            Recorded EXPLAIN — A
            <textarea
              value={recordedCommandA}
              onChange={(e) => setRecordedCommandA(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 48,
                marginTop: 4,
                padding: 8,
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontFamily: 'var(--mono)',
                fontSize: 11,
              }}
            />
          </label>
          <label style={{ fontSize: 11, opacity: 0.85 }}>
            Recorded EXPLAIN — B
            <textarea
              value={recordedCommandB}
              onChange={(e) => setRecordedCommandB(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 48,
                marginTop: 4,
                padding: 8,
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontFamily: 'var(--mono)',
                fontSize: 11,
              }}
            />
          </label>
        </div>
        {suggestedExplainA || suggestedExplainB ? (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {suggestedExplainA ? (
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {suggestedExplainA}
              </pre>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Add SQL for A to suggest EXPLAIN.</div>
            )}
            {suggestedExplainB ? (
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {suggestedExplainB}
              </pre>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Add SQL for B to suggest EXPLAIN.</div>
            )}
          </div>
        ) : null}
      </details>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onCompare}
          disabled={loading || loadingPersistedComparison || planA.trim().length === 0 || planB.trim().length === 0}
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
            loadPersistedCompareSeqRef.current += 1
            const p = new URLSearchParams(location.search)
            p.delete(CompareDeepLinkParam.comparison)
            p.delete(CompareDeepLinkParam.pair)
            p.delete(CompareDeepLinkParam.finding)
            p.delete(CompareDeepLinkParam.indexDiff)
            p.delete(CompareDeepLinkParam.suggestion)
            lastSyncedCompareQs.current = null
            setSearchParams(p, { replace: true })
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

      {loadingPersistedComparison ? (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', opacity: 0.9 }}>
          Opening shared comparison…
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid #f59e0b', color: 'var(--text-h)' }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      {!comparison && !loading && !loadingPersistedComparison && !error ? (
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>Summary</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {coverage ? <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.8 }}>{coverage}</div> : null}
                  <button
                    type="button"
                    onClick={() => void copyShareCompare.copy(window.location.href, 'Copied share link')}
                    style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 12 }}
                  >
                    Copy share link
                  </button>
                  {copyShareCompare.status ? (
                    <span style={{ fontSize: 12, opacity: 0.85 }}>{copyShareCompare.status}</span>
                  ) : null}
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.78, marginBottom: 8, fontFamily: 'var(--mono)' }}>
                ComparisonId {comparison.comparisonId} · stored in server SQLite (survives restart if the DB file is kept)
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
              <details style={{ marginTop: 12 }} aria-label="Plan capture and EXPLAIN context">
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Plan capture / EXPLAIN context (A vs B)</summary>
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                  <CaptureContextColumn title="Plan A (baseline)" plan={comparison.planA} />
                  <CaptureContextColumn title="Plan B (changed)" plan={comparison.planB} />
                </div>
              </details>
              {indexSection && (indexSection.overviewLines.length > 0 || indexSection.topInsightDiffs.length > 0) ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'color-mix(in srgb, var(--accent-bg) 10%, transparent)',
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Index changes</div>
                  {indexSection.headlineResolved ? (
                    <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.92 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.8 }}>Resolved highlight · </span>
                      {indexSection.headlineResolved}
                    </div>
                  ) : null}
                  {indexSection.headlineNew ? (
                    <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.92 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.8 }}>New highlight · </span>
                      {indexSection.headlineNew}
                    </div>
                  ) : null}
                  {indexSection.overviewLines.length ? (
                    <ul style={{ margin: '0 0 8px 0', paddingLeft: 18, fontSize: 13, opacity: 0.9 }}>
                      {indexSection.overviewLines.slice(0, 5).map((line) => (
                        <li key={line} style={{ marginBottom: 4 }}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {indexSection.topInsightDiffs.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                      {indexSection.topInsightDiffs.map((row) => {
                        const rowHighlighted =
                          Boolean(row.insightDiffId) && highlightIndexInsightDiffId === row.insightDiffId
                        return (
                          <li
                            key={`${row.diffIndex}-${row.kindLabel}-${row.summary.slice(0, 40)}`}
                            data-artifact={row.insightDiffId ? ArtifactDomKind.indexInsightDiff : undefined}
                            data-artifact-id={row.insightDiffId || undefined}
                            style={{
                              marginBottom: 6,
                              padding: '4px 0',
                              borderRadius: 8,
                              outline: rowHighlighted ? '2px solid var(--accent-border)' : 'none',
                              outlineOffset: 2,
                            }}
                          >
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.85 }}>{row.kindLabel} · </span>
                            {row.summary}
                            {row.relatedFindingHints.length ? (
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 11,
                                  opacity: 0.88,
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 6,
                                  alignItems: 'center',
                                }}
                              >
                                <span>{relatedFindingChangesCue(row.relatedFindingIndexes.length)}</span>
                                <span style={{ opacity: 0.85 }}>({row.relatedFindingHints.join(' · ')})</span>
                                {row.relatedFindingDiffIds[0] ? (
                                  <button
                                    type="button"
                                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, cursor: 'pointer' }}
                                    onClick={() => {
                                      setHighlightFindingDiffId(row.relatedFindingDiffIds[0]!)
                                      setHighlightIndexInsightDiffId(null)
                                    }}
                                  >
                                    Highlight finding
                                  </button>
                                ) : row.relatedFindingIndexes[0] != null && comparison ? (
                                  <button
                                    type="button"
                                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, cursor: 'pointer' }}
                                    onClick={() => {
                                      const item = comparison.findingsDiff.items[row.relatedFindingIndexes[0]!]
                                      if (item?.diffId) setHighlightFindingDiffId(item.diffId)
                                      setHighlightIndexInsightDiffId(null)
                                    }}
                                  >
                                    Highlight finding
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  {indexSection.chunkedNuance ? (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                      Timescale-style chunked bitmap plans: indexes may already be in play; heavy I/O can still be a pruning/selectivity/shape
                      problem—not only “add an index.”
                    </div>
                  ) : null}
                </div>
              ) : null}
              {compareOptimizationTop.length > 0 ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'color-mix(in srgb, #6366f1 8%, transparent)',
                  }}
                  aria-label="Compare optimization suggestions"
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Next steps after this change</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                    Compact cues from the compare engine (plan B + diff)—not the full analyze suggestion list.
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {compareOptimizationTop.map((s) => (
                      <li
                        key={s.suggestionId}
                        data-artifact={ArtifactDomKind.compareSuggestion}
                        data-artifact-id={s.suggestionId}
                        style={{
                          marginBottom: 8,
                          padding: '4px 0',
                          borderRadius: 8,
                          outline:
                            highlightSuggestionId === s.suggestionId ? '2px solid var(--accent-border)' : 'none',
                          outlineOffset: 2,
                        }}
                      >
                        <div
                          style={{ fontWeight: 800, cursor: 'pointer' }}
                          onClick={() => setHighlightSuggestionId(s.suggestionId)}
                          title="Pin this suggestion for the shared link"
                        >
                          {s.title}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, fontSize: 11, opacity: 0.88 }}>
                          <span style={{ fontFamily: 'var(--mono)' }}>{optimizationCategoryLabel(s.category)}</span>
                          <span>{suggestionPriorityLabel(s.priority)}</span>
                          <span>{suggestionConfidenceLabel(s.confidence)}</span>
                        </div>
                        <div style={{ marginTop: 4, opacity: 0.9 }}>{s.summary}</div>
                        {(s.targetNodeIds ?? [])[0] && comparison ? (
                          <button
                            type="button"
                            style={{ marginTop: 6, fontSize: 12, padding: '4px 8px', borderRadius: 8, cursor: 'pointer' }}
                            onClick={() => {
                              const targetB = (s.targetNodeIds ?? [])[0]
                              const m = comparison.matches.find((x) => x.nodeIdB === targetB)
                              if (m) setSelectedPair({ a: m.nodeIdA, b: m.nodeIdB })
                              setHighlightSuggestionId(s.suggestionId)
                            }}
                          >
                            Focus pair on node B {(s.targetNodeIds ?? [])[0]}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
                  (() => {
                    const w0 = worsened[0]
                    const p0 = pairForDelta(w0.nodeIdA, w0.nodeIdB)
                    const lab = p0 ? pairShortLabel(p0, byIdA, byIdB) : `${w0.nodeTypeA} → ${w0.nodeTypeB}`
                    return (
                      <ClickableRow
                        selectedEmphasis="accent-bar"
                        selected={pairSelected(w0.nodeIdA, w0.nodeIdB)}
                        aria-label={`Top worsened: ${lab}`}
                        onActivate={() => setSelectedPair({ a: w0.nodeIdA, b: w0.nodeIdB })}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'color-mix(in srgb, #ef4444 10%, transparent)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>Top worsened</div>
                            <div style={{ fontWeight: 900, marginTop: 4 }}>{lab}</div>
                          </div>
                          {p0 ? (
                            <ReferenceCopyButton
                              aria-label="Copy pair reference for top worsened"
                              onCopy={() => copyNav.copy(pairReferenceText(p0, byIdA, byIdB), 'Copied pair reference')}
                            />
                          ) : null}
                        </div>
                      </ClickableRow>
                    )
                  })()
                ) : null}
                {improved[0] ? (
                  (() => {
                    const i0 = improved[0]
                    const p0 = pairForDelta(i0.nodeIdA, i0.nodeIdB)
                    const lab = p0 ? pairShortLabel(p0, byIdA, byIdB) : `${i0.nodeTypeA} → ${i0.nodeTypeB}`
                    return (
                      <ClickableRow
                        selectedEmphasis="accent-bar"
                        selected={pairSelected(i0.nodeIdA, i0.nodeIdB)}
                        aria-label={`Top improved: ${lab}`}
                        onActivate={() => setSelectedPair({ a: i0.nodeIdA, b: i0.nodeIdB })}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'color-mix(in srgb, #22c55e 10%, transparent)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>Top improved</div>
                            <div style={{ fontWeight: 900, marginTop: 4 }}>{lab}</div>
                          </div>
                          {p0 ? (
                            <ReferenceCopyButton
                              aria-label="Copy pair reference for top improved"
                              onCopy={() => copyNav.copy(pairReferenceText(p0, byIdA, byIdB), 'Copied pair reference')}
                            />
                          ) : null}
                        </div>
                      </ClickableRow>
                    )
                  })()
                ) : null}
              </div>
              {!worsened.length && !improved.length ? (
                <div style={{ marginTop: 10, opacity: 0.85 }}>No top-changes were emitted. This usually means missing timing/buffer evidence or very small plans.</div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
              {copyNav.status ? (
                <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>{copyNav.status}</div>
              ) : null}
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
                        const indexCue = pair?.indexDeltaCues?.length
                        const label = pair ? pairShortLabel(pair, byIdA, byIdB) : `${d.nodeTypeA} → ${d.nodeTypeB}`
                        const subtitle = pair ? pairSubtitle(pair) : null
                        return (
                          <ClickableRow
                            key={`${d.nodeIdA}-${d.nodeIdB}`}
                            selected={pairSelected(d.nodeIdA, d.nodeIdB)}
                            aria-label={`Worsened pair: ${label}`}
                            onActivate={() => setSelectedPair({ a: d.nodeIdA, b: d.nodeIdB })}
                            style={{ padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <div style={{ fontWeight: 900 }}>{label}</div>
                                  {indexCue ? (
                                    <span
                                      style={{
                                        fontFamily: 'var(--mono)',
                                        fontSize: 10,
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        border: '1px solid var(--border)',
                                        opacity: 0.9,
                                      }}
                                    >
                                      index Δ
                                    </span>
                                  ) : null}
                                </div>
                                {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{subtitle}</div> : null}
                              </div>
                              {pair ? (
                                <ReferenceCopyButton
                                  aria-label="Copy pair reference"
                                  onCopy={() => copyNav.copy(pairReferenceText(pair, byIdA, byIdB), 'Copied pair reference')}
                                />
                              ) : null}
                            </div>
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
                          </ClickableRow>
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
                        const indexCue = pair?.indexDeltaCues?.length
                        const label = pair ? pairShortLabel(pair, byIdA, byIdB) : `${d.nodeTypeA} → ${d.nodeTypeB}`
                        const subtitle = pair ? pairSubtitle(pair) : null
                        return (
                          <ClickableRow
                            key={`${d.nodeIdA}-${d.nodeIdB}`}
                            selected={pairSelected(d.nodeIdA, d.nodeIdB)}
                            aria-label={`Improved pair: ${label}`}
                            onActivate={() => setSelectedPair({ a: d.nodeIdA, b: d.nodeIdB })}
                            style={{ padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <div style={{ fontWeight: 900 }}>{label}</div>
                                  {indexCue ? (
                                    <span
                                      style={{
                                        fontFamily: 'var(--mono)',
                                        fontSize: 10,
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        border: '1px solid var(--border)',
                                        opacity: 0.9,
                                      }}
                                    >
                                      index Δ
                                    </span>
                                  ) : null}
                                </div>
                                {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{subtitle}</div> : null}
                              </div>
                              {pair ? (
                                <ReferenceCopyButton
                                  aria-label="Copy pair reference"
                                  onCopy={() => copyNav.copy(pairReferenceText(pair, byIdA, byIdB), 'Copied pair reference')}
                                />
                              ) : null}
                            </div>
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
                          </ClickableRow>
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
                    {filteredDiffItems.slice(0, 30).map((i, idx) => {
                      const relIdx = i.relatedIndexDiffIndexes ?? []
                      const relIds = i.relatedIndexDiffIds ?? []
                      const rowHighlighted = Boolean(i.diffId) && highlightFindingDiffId === i.diffId
                      return (
                      <div
                        key={i.diffId || `${i.ruleId}-${idx}`}
                        data-artifact={i.diffId ? ArtifactDomKind.findingDiff : undefined}
                        data-artifact-id={i.diffId || undefined}
                        style={{
                          borderRadius: 12,
                          outline: rowHighlighted ? '2px solid var(--accent-border)' : 'none',
                          outlineOffset: 2,
                        }}
                      >
                      <ClickableRow
                        selected={(() => {
                          const r = resolveFindingDiffPair(i, comparison.matches)
                          return r ? pairSelected(r.a, r.b) : false
                        })()}
                        aria-label={`Finding diff: ${i.ruleId}`}
                        onActivate={() => {
                          const r = resolveFindingDiffPair(i, comparison.matches)
                          if (r) setSelectedPair(r)
                          if (i.diffId) setHighlightFindingDiffId(i.diffId)
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'transparent',
                        }}
                      >
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
                          {i.changeType} · {i.ruleId} · {String(i.severityA)} → {String(i.severityB)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 4 }}>
                          <div style={{ fontSize: 13, opacity: 0.85 }}>
                            {findingAnchorLabel(i.nodeIdB ?? i.nodeIdA, i.nodeIdB ? byIdB : byIdA)}
                          </div>
                          <ReferenceCopyButton
                            aria-label="Copy finding reference"
                            onCopy={() => {
                              const nid = i.nodeIdB ?? i.nodeIdA
                              if (!nid) return
                              copyFinding.copy(
                                findingReferenceText(nid, i.nodeIdB ? byIdB : byIdA, `${i.changeType} finding: ${i.ruleId}`),
                                'Copied finding reference',
                              )
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 13 }}>{i.summary}</div>
                        {relIds.length || relIdx.length ? (
                          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.85 }}>Related index change</span>
                            <span style={{ fontSize: 11, opacity: 0.85 }}>
                              {relatedIndexDeltaCue(relIds.length || relIdx.length)}
                            </span>
                            {relIds.map((id) => (
                              <button
                                key={id}
                                type="button"
                                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setHighlightIndexInsightDiffId(id)
                                  setHighlightFindingDiffId(null)
                                }}
                              >
                                {id.length > 14 ? `${id.slice(0, 12)}…` : id}
                              </button>
                            ))}
                            {relIdx.map((ix) => (
                              <button
                                key={`ix-${ix}`}
                                type="button"
                                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const id = comparison.indexComparison?.insightDiffs[ix]?.insightDiffId
                                  if (id) setHighlightIndexInsightDiffId(id)
                                  setHighlightFindingDiffId(null)
                                }}
                              >
                                Index Δ #{ix}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </ClickableRow>
                      </div>
                      )
                    })}
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
            {branchViewModel ? (
              <CompareBranchStrip model={branchViewModel} onSelectPair={setSelectedPair} pairHeading={branchPairHeading} />
            ) : null}
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
                  <button
                    type="button"
                    onClick={async () => {
                      const params = buildCompareDeepLinkSearchParams({
                        comparisonId: comparison.comparisonId,
                        pairArtifactId: selectedDetail.pairArtifactId ?? null,
                        findingDiffId: highlightFindingDiffId,
                        indexInsightDiffId: highlightIndexInsightDiffId,
                        suggestionId: highlightSuggestionId,
                      })
                      const path = compareDeepLinkPath(location.pathname, params)
                      await copyDeepLink.copy(`${window.location.origin}${path}`, 'Copied deep link')
                    }}
                    style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
                  >
                    Copy link
                  </button>
                  {copyPair.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyPair.status}</div> : null}
                  {copyDeepLink.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyDeepLink.status}</div> : null}
                </div>
                {pairSubtitle(selectedDetail) ? (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{pairSubtitle(selectedDetail)}</div>
                ) : null}
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
                {compareOptForPair ? (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.92 }} aria-label="Compare suggestion for this pair">
                    <b>Related compare next step</b>
                    <div style={{ marginTop: 4, fontWeight: 700 }}>{compareOptForPair.title}</div>
                    <div style={{ marginTop: 4 }}>{compareOptForPair.summary}</div>
                  </div>
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

