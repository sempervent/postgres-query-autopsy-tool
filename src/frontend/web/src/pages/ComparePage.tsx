import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { AppConfig, NodePairDetail, PlanComparisonResult } from '../api/types'
import {
  AccessDeniedError,
  ArtifactCorruptError,
  ArtifactIncompatibleSchemaError,
  compareWithPlanTexts,
  ComparePlanParseError,
  ComparisonNotFoundError,
  fetchAppConfig,
  getComparison,
} from '../api/client'
import { buildCompareBranchViewModel } from '../presentation/compareBranchContext'
import { joinLabelAndSubtitle, nodeShortLabel, pairShortLabel } from '../presentation/nodeLabels'
import {
  buildCompareIndexSectionModel,
  buildCompareSummaryCards,
  compareCoverageLine,
  compareEmptyStateCopy,
} from '../presentation/comparePresentation'
import { resolveCompareContinuitySummaryCue } from '../presentation/compareContinuityPresentation'
import {
  compareSuggestionsByPriority,
  normalizeOptimizationSuggestionsForDisplay,
  resolveCompareSuggestionParamToCanonicalId,
} from '../presentation/optimizationSuggestionsPresentation'
import { prefetchCompareSelectedPairHeavySections } from '../components/compare/prefetchCompareSelectedPairHeavySections'
import {
  ArtifactDomKind,
  buildCompareDeepLinkSearchParams,
  CompareDeepLinkParam,
  copyArtifactShareToast,
  scrollArtifactIntoView,
  shareArtifactLinkLabel,
} from '../presentation/artifactLinks'
import { buildSuggestedExplainSql } from '../presentation/explainCommandBuilder'
import { useCopyFeedback } from '../presentation/useCopyFeedback'
import { useWorkspaceLayoutTier } from '../hooks/useWorkspaceLayoutTier'
import { useCompareWorkspaceLayout } from '../compareWorkspace/useCompareWorkspaceLayout'
import { CompareCapturePanel } from '../components/compare/CompareCapturePanel'
import { ArtifactErrorBanner } from '../components/ArtifactErrorBanner'
import { CompareIntroPanel } from '../components/compare/CompareIntroPanel'
import { CompareNavigatorPanel } from '../components/compare/CompareNavigatorPanel'
import { ComparePairColumn } from '../components/compare/ComparePairColumn'
import { CompareSummaryColumn } from '../components/compare/CompareSummaryColumn'
import { CompareTopChangesPanel } from '../components/compare/CompareTopChangesPanel'

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
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null)

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
  const copyCompareSuggestion = useCopyFeedback()
  const lastSyncedCompareQs = useRef<string | null>(null)
  const hydratedCompareHighlightFor = useRef<string | null>(null)
  const loadPersistedCompareSeqRef = useRef(0)
  const urlComparisonId = searchParams.get(CompareDeepLinkParam.comparison)?.trim() ?? ''
  const layoutTier = useWorkspaceLayoutTier()
  const workspaceLayout = useCompareWorkspaceLayout(appConfig?.authEnabled ?? false)
  const { layout, setVisibility } = workspaceLayout

  const suggestedExplainA = useMemo(
    () => buildSuggestedExplainSql(queryTextA, compareExplainToggles),
    [queryTextA, compareExplainToggles.analyze, compareExplainToggles.verbose, compareExplainToggles.buffers, compareExplainToggles.costs],
  )
  const suggestedExplainB = useMemo(
    () => buildSuggestedExplainSql(queryTextB, compareExplainToggles),
    [queryTextB, compareExplainToggles.analyze, compareExplainToggles.verbose, compareExplainToggles.buffers, compareExplainToggles.costs],
  )

  const shareCompareUi = useMemo(
    () => ({
      label: shareArtifactLinkLabel(appConfig?.authEnabled ?? false, comparison?.artifactAccess),
      toast: copyArtifactShareToast(appConfig?.authEnabled ?? false, comparison?.artifactAccess),
    }),
    [appConfig?.authEnabled, comparison?.artifactAccess],
  )

  useEffect(() => {
    let cancelled = false
    fetchAppConfig()
      .then((c) => {
        if (!cancelled) setAppConfig(c)
      })
      .catch(() => {
        /* non-fatal */
      })
    return () => {
      cancelled = true
    }
  }, [])

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
            : e instanceof AccessDeniedError
              ? e.message
              : e instanceof ArtifactCorruptError || e instanceof ArtifactIncompatibleSchemaError
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

  const continuitySummaryCue = useMemo(
    () => (comparison ? resolveCompareContinuitySummaryCue(comparison, selectedDetail) : null),
    [comparison, selectedDetail],
  )

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

  const pairSubtitle = useCallback((pair: NodePairDetail): string | null => {
    const aNode = byIdA.get(pair.identity.nodeIdA)
    const bNode = byIdB.get(pair.identity.nodeIdB)
    const aJoin = aNode ? joinLabelAndSubtitle(aNode, byIdA) : null
    const bJoin = bNode ? joinLabelAndSubtitle(bNode, byIdB) : null
    return bJoin?.subtitle ?? aJoin?.subtitle ?? null
  }, [byIdA, byIdB])

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

  const empty = compareEmptyStateCopy()
  const coverage = compareCoverageLine(comparison)
  const summaryCards = buildCompareSummaryCards(comparison)
  const indexSection = comparison ? buildCompareIndexSectionModel(comparison) : null
  const findingsNewCount = diffItems.filter((i) => String(i.changeType) === 'New').length
  const findingsResolvedCount = diffItems.filter((i) => String(i.changeType) === 'Resolved').length

  const normalizedCompareOptimizationSuggestions = useMemo(
    () => normalizeOptimizationSuggestionsForDisplay(comparison?.compareOptimizationSuggestions ?? []),
    [comparison],
  )

  const compareOptimizationTop = useMemo(() => {
    return [...normalizedCompareOptimizationSuggestions].sort(compareSuggestionsByPriority).slice(0, 5)
  }, [normalizedCompareOptimizationSuggestions])

  const compareOptForPair = useMemo(() => {
    if (!normalizedCompareOptimizationSuggestions.length || !effectivePair) return null
    const b = effectivePair.b
    const hit = normalizedCompareOptimizationSuggestions.filter((s) => (s.targetNodeIds ?? []).includes(b))
    return [...hit].sort(compareSuggestionsByPriority)[0] ?? null
  }, [normalizedCompareOptimizationSuggestions, effectivePair])

  useEffect(() => {
    if (!comparison) return
    const hasRic = typeof window.requestIdleCallback === 'function'
    const handle = hasRic
      ? window.requestIdleCallback(() => prefetchCompareSelectedPairHeavySections(), { timeout: 4500 })
      : window.setTimeout(() => prefetchCompareSelectedPairHeavySections(), 2200)
    return () => {
      if (hasRic && typeof handle === 'number') window.cancelIdleCallback(handle)
      else window.clearTimeout(handle as number)
    }
  }, [comparison?.comparisonId])

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
    const sugList = comparison.compareOptimizationSuggestions ?? []
    const canonicalSug = resolveCompareSuggestionParamToCanonicalId(sugList, suggestion)
    if (canonicalSug) setHighlightSuggestionId(canonicalSug)
    else setHighlightSuggestionId(null)
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
      resolveCompareSuggestionParamToCanonicalId(comparison.compareOptimizationSuggestions ?? [], sugParam)

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

  function handleClear() {
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
  }

  const hasSummaryColumn = layout.summarySectionOrder.some((sid) => layout.visibility[sid])
  const showTopChanges = layout.visibility.topChanges

  const summaryTopSplitClassName = useMemo(() => {
    if (!hasSummaryColumn || !showTopChanges || layoutTier === 'narrow') {
      return 'pqat-summaryTopSplit pqat-summaryTopSplit--stack'
    }
    if (layoutTier === 'wide') return 'pqat-summaryTopSplit pqat-summaryTopSplit--wide'
    return 'pqat-summaryTopSplit pqat-summaryTopSplit--medium'
  }, [hasSummaryColumn, showTopChanges, layoutTier])

  const mainSplitClassName = useMemo(() => {
    if (layoutTier === 'narrow') return 'pqat-mainSplit pqat-mainSplit--narrow'
    if (layoutTier === 'wide') return 'pqat-mainSplit pqat-mainSplit--wide'
    return 'pqat-mainSplit pqat-mainSplit--medium'
  }, [layoutTier])

  function renderNavigatorColumn() {
    if (!comparison) return null
    return (
      <CompareNavigatorPanel
        layout={layout}
        comparison={comparison}
        byIdA={byIdA}
        byIdB={byIdB}
        filterNodeType={filterNodeType}
        setFilterNodeType={setFilterNodeType}
        filterFindingChange={filterFindingChange}
        setFilterFindingChange={setFilterFindingChange}
        filteredWorsened={filteredWorsened}
        filteredImproved={filteredImproved}
        filteredDiffItems={filteredDiffItems}
        unmatchedA={unmatchedA}
        unmatchedB={unmatchedB}
        pairForDelta={pairForDelta}
        pairSubtitle={pairSubtitle}
        pairSelected={pairSelected}
        setSelectedPair={setSelectedPair}
        highlightFindingDiffId={highlightFindingDiffId}
        setHighlightFindingDiffId={setHighlightFindingDiffId}
        setHighlightIndexInsightDiffId={setHighlightIndexInsightDiffId}
        copyNav={copyNav}
        copyFinding={copyFinding}
      />
    )
  }

  function renderPairColumn() {
    if (!comparison) return null
    return (
      <ComparePairColumn
        showBranchStrip={layout.visibility.branchStrip}
        showSelectedPair={layout.visibility.selectedPair}
        branchViewModel={branchViewModel}
        branchPairHeading={branchPairHeading}
        setSelectedPair={setSelectedPair}
        selectedPairProps={{
          comparison,
          pathname: location.pathname,
          selectedDetail,
          byIdA,
          byIdB,
          copyPair,
          copyDeepLink,
          highlightFindingDiffId,
          highlightIndexInsightDiffId,
          highlightSuggestionId,
          compareOptForPair,
          pairSubtitle,
        }}
      />
    )
  }

  return (
    <div className="pqat-page pqat-pageGrid">
      {layout.visibility.intro ? <CompareIntroPanel /> : null}

      {!layout.visibility.input ? (
        <div className="pqat-panel pqat-panel--tool pqat-panelDashedHint">
          <span className="pqat-hint pqat-panelHintDense">Plan inputs are hidden.</span>
          <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--primary" onClick={() => setVisibility('input', true)}>
            Show plan inputs
          </button>
        </div>
      ) : null}

      {layout.visibility.input ? (
        <div className="pqat-panel pqat-panel--capture pqat-panelPad--lg">
          <CompareCapturePanel
            workspaceApi={workspaceLayout}
            planA={planA}
            planB={planB}
            setPlanA={setPlanA}
            setPlanB={setPlanB}
            queryTextA={queryTextA}
            queryTextB={queryTextB}
            setQueryTextA={setQueryTextA}
            setQueryTextB={setQueryTextB}
            sendCompareExplainMetadata={sendCompareExplainMetadata}
            setSendCompareExplainMetadata={setSendCompareExplainMetadata}
            compareExplainToggles={compareExplainToggles}
            setCompareExplainToggles={setCompareExplainToggles}
            recordedCommandA={recordedCommandA}
            recordedCommandB={recordedCommandB}
            setRecordedCommandA={setRecordedCommandA}
            setRecordedCommandB={setRecordedCommandB}
            suggestedExplainA={suggestedExplainA ?? ''}
            suggestedExplainB={suggestedExplainB ?? ''}
            includeDiagnostics={includeDiagnostics}
            setIncludeDiagnostics={setIncludeDiagnostics}
            loading={loading}
            loadingPersistedComparison={loadingPersistedComparison}
            onCompare={() => void onCompare()}
            onClear={handleClear}
          />
        </div>
      ) : null}

      {loadingPersistedComparison ? (
        <div className="pqat-stateBanner pqat-stateBanner--loading" data-testid="compare-persisted-loading">
          <span className="pqat-stateBanner__title">Restoring snapshot</span>
          <div className="pqat-stateBanner__body">Opening shared comparison…</div>
        </div>
      ) : null}

      {error ? <ArtifactErrorBanner message={error} testId="compare-page-error" /> : null}

      {!comparison && !loading && !loadingPersistedComparison && !error ? (
        <div className="pqat-emptyHint pqat-hint" style={{ padding: '18px 20px' }}>
          <span className="pqat-emptyHint__lead">{empty.title}</span>
          <div style={{ margin: 0 }}>{empty.body}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="pqat-stateBanner pqat-stateBanner--info pqat-workspaceReveal">
          <span className="pqat-stateBanner__title">Comparing plans</span>
          <div className="pqat-stateBanner__body">
            Mapping nodes and computing deltas. Large plans may take a few seconds—sections below fill in as data arrives.
          </div>
        </div>
      ) : null}

      {comparison ? (
        <section className="pqat-sectionStack">
          {hasSummaryColumn || showTopChanges ? (
            <div className={summaryTopSplitClassName}>
              {hasSummaryColumn ? (
                <CompareSummaryColumn
                  layout={layout}
                  comparison={comparison}
                  continuitySummaryCue={continuitySummaryCue}
                  appConfig={appConfig}
                  coverage={coverage}
                  summaryCards={summaryCards}
                  indexSection={indexSection}
                  compareOptimizationTop={compareOptimizationTop}
                  findingsNewCount={findingsNewCount}
                  findingsResolvedCount={findingsResolvedCount}
                  highlightIndexInsightDiffId={highlightIndexInsightDiffId}
                  highlightSuggestionId={highlightSuggestionId}
                  selectedPairArtifactId={selectedDetail?.pairArtifactId ?? null}
                  selectedPlanBNodeId={effectivePair?.b ?? null}
                  setHighlightFindingDiffId={setHighlightFindingDiffId}
                  setHighlightIndexInsightDiffId={setHighlightIndexInsightDiffId}
                  setHighlightSuggestionId={setHighlightSuggestionId}
                  setSelectedPair={setSelectedPair}
                  copyShareCompare={copyShareCompare}
                  copyCompareSuggestion={copyCompareSuggestion}
                  shareCompareUi={shareCompareUi}
                  onSharingSaved={async () => {
                    try {
                      const data = await getComparison(comparison.comparisonId)
                      setComparison(data)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e))
                    }
                  }}
                />
              ) : null}
              {showTopChanges ? (
                <CompareTopChangesPanel
                  worsened={worsened}
                  improved={improved}
                  byIdA={byIdA}
                  byIdB={byIdB}
                  pairForDelta={pairForDelta}
                  pairSelected={pairSelected}
                  setSelectedPair={setSelectedPair}
                  copyNav={copyNav}
                  comparisonId={comparison.comparisonId}
                />
              ) : null}
            </div>
          ) : null}

          <div className={mainSplitClassName}>
            {layoutTier !== 'narrow' ? (
              <>
                {layout.mainColumnOrder[0] === 'navigator' ? renderNavigatorColumn() : renderPairColumn()}
                {layout.mainColumnOrder[1] === 'navigator' ? renderNavigatorColumn() : renderPairColumn()}
              </>
            ) : layout.mainColumnOrder[0] === 'navigator' ? (
              <>
                {renderNavigatorColumn()}
                {renderPairColumn()}
              </>
            ) : (
              <>
                {renderPairColumn()}
                {renderNavigatorColumn()}
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
