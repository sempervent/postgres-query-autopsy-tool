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
  exportCompareHtml,
  exportCompareJson,
  exportCompareMarkdown,
  fetchAppConfig,
  getComparison,
} from '../api/client'
import { buildCompareBranchViewModel, resolveFindingDiffPair } from '../presentation/compareBranchContext'
import { joinLabelAndSubtitle, nodeShortLabel, pairShortLabel } from '../presentation/nodeLabels'
import {
  buildCompareIndexSectionModel,
  buildCompareSummaryCards,
  compareCoverageLine,
  compareEmptyStateCopy,
} from '../presentation/comparePresentation'
import { resolveCompareContinuitySummaryCue } from '../presentation/compareContinuityPresentation'
import {
  buildCompareExportTriageSummary,
  injectCompareExportSupplementIntoHtml,
  jsonCompareExportWithTriageEnvelope,
  markdownCompareExportSupplement,
} from '../presentation/compareExportTriage'
import { exportDownloadSuccessHint } from '../presentation/exportStatusCopy'
import { compareLeadTakeaway, compareTriagePairBridgeLine, resolveComparePairFallbackDisplay } from '../presentation/compareOutputGuidance'
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
import { parseCompareUrlPinAndPairState } from '../presentation/compareDeepLinkSync'
import {
  COMPARE_PIN_HYDRATE_CLEAR_MS,
  COMPARE_WORKSPACE_KEYBOARD_HINTS_ID,
  COMPARE_WORKSPACE_KEYBOARD_HINTS_TEXT,
  comparePinAnnouncementForFingerprint,
  comparePinHydrateAnnouncementForFingerprint,
  comparePinLiveFingerprint,
} from '../presentation/comparePinLiveAnnouncement'
import { buildSuggestedExplainSql } from '../presentation/explainCommandBuilder'
import { PIN_LIVE_ANNOUNCE_DEFER_MS, useCopyFeedback } from '../presentation/useCopyFeedback'
import { useWorkspaceLayoutTier } from '../hooks/useWorkspaceLayoutTier'
import { useCompareWorkspaceLayout } from '../compareWorkspace/useCompareWorkspaceLayout'
import { TryCompareExampleChips } from '../components/examples/TryPlanExampleChips'
import { CompareCapturePanel } from '../components/compare/CompareCapturePanel'
import { COMPARE_PLAN_EXAMPLES, getComparePlanExample, type ComparePlanExampleId } from '../examples/comparePlanExamples'
import { ArtifactErrorBanner } from '../components/ArtifactErrorBanner'
import { CompareWorkflowGuide } from '../help/CompareWorkflowGuide'
import { WorkflowGuideBar } from '../help/WorkflowGuideBar'
import { COMPARE_WORKFLOW_GUIDE_TITLE_ID } from '../help/workflowGuideDomIds'
import { isWorkflowGuideHotkey, workflowGuideHotkeyShouldIgnoreTarget } from '../help/workflowGuideHotkey'
import { openWorkflowGuideWhenUrlRequests } from '../help/workflowGuideOpenFromUrl'
import {
  readWorkflowGuideDismissed,
  urlWantsWorkflowGuide,
  WorkflowGuideQueryParam,
  writeWorkflowGuideDismissed,
} from '../help/workflowGuidePrefs'
import { CompareNavigatorPanel } from '../components/compare/CompareNavigatorPanel'
import { SkipToPairInspectorLink } from '../components/compare/SkipToPairInspectorLink'

const COMPARE_GUIDE_PANEL_ID = 'compare-workflow-guide-panel'
import { ComparePairColumn } from '../components/compare/ComparePairColumn'
import type { ComparePairHandoffKind } from '../components/compare/CompareSelectedPairPanel'
import { CompareSummaryColumn } from '../components/compare/CompareSummaryColumn'
import { CompareTopChangesPanel } from '../components/compare/CompareTopChangesPanel'

function downloadCompareText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
  /** Pair handoff copy: saved /compare?comparison=… load vs run in this tab (Phase 132). */
  const [compareHandoffOrigin, setCompareHandoffOrigin] = useState<'link' | 'session'>('session')
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null)
  const [exportCompareBusyKind, setExportCompareBusyKind] = useState<'md' | 'html' | 'json' | null>(null)
  const [exportCompareHint, setExportCompareHint] = useState<string | null>(null)

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
  const [comparePinLiveMessage, setComparePinLiveMessage] = useState('')
  const comparePinLiveRef = useRef<{ comparisonId: string; fingerprint: string } | null>(null)
  const pinLiveTransitionTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
  const copyPair = useCopyFeedback()
  const copyFinding = useCopyFeedback()
  const copyNav = useCopyFeedback()
  const copyDeepLink = useCopyFeedback()
  const copyPinContext = useCopyFeedback()
  const copyShareCompare = useCopyFeedback()
  const copyCompareSuggestion = useCopyFeedback()
  const lastSyncedCompareQs = useRef<string | null>(null)
  const comparePinLastLayoutCidRef = useRef<string | null>(null)
  /** Skips one redundant transition announcement right after hydrate seeds the same fingerprint (strict mount / batching). */
  const suppressNextPinTransitionForFpRef = useRef<string | null>(null)
  const loadPersistedCompareSeqRef = useRef(0)
  /** After Clear, keep guide open even when workspace intro default would stay closed. */
  const skipCompareEmptyGuideSyncRef = useRef(false)
  const prevCompareGuideOpenRef = useRef<boolean | undefined>(undefined)
  const compareGuideToggleRef = useRef<HTMLButtonElement | null>(null)
  const urlComparisonId = searchParams.get(CompareDeepLinkParam.comparison)?.trim() ?? ''
  const urlWantsGuide = useMemo(() => urlWantsWorkflowGuide(searchParams), [searchParams])
  const layoutTier = useWorkspaceLayoutTier()
  const workspaceLayout = useCompareWorkspaceLayout(appConfig?.authEnabled ?? false)
  const { layout, setVisibility } = workspaceLayout
  /** `?guide=` is applied in `useLayoutEffect` (shared with Analyze) so the first paint matches the open state. */
  const [compareGuideOpen, setCompareGuideOpen] = useState(
    () => layout.visibility.intro && !readWorkflowGuideDismissed('compare'),
  )
  const [compareGuideKeyboardContain, setCompareGuideKeyboardContain] = useState(false)
  const [compareGuideLiveMsg, setCompareGuideLiveMsg] = useState('')
  const compareGuideLiveClearRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
  const pendingCompareGuideOpenAnnRef = useRef<string | null>(null)
  const announceCompareGuideCloseRef = useRef(false)
  const prevCompareGuideOpenAnnRef = useRef(compareGuideOpen)
  const compareGuideOpenRef = useRef(compareGuideOpen)
  const pendingCompareGuideFocusTitleRef = useRef(false)
  const explicitCompareGuideClosePendingRef = useRef(false)
  compareGuideOpenRef.current = compareGuideOpen

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
        setCompareHandoffOrigin('link')
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

  const queueCompareGuideLiveMsg = useCallback((text: string) => {
    if (compareGuideLiveClearRef.current != null) {
      globalThis.clearTimeout(compareGuideLiveClearRef.current)
      compareGuideLiveClearRef.current = null
    }
    setCompareGuideLiveMsg(text)
    compareGuideLiveClearRef.current = globalThis.setTimeout(() => {
      setCompareGuideLiveMsg('')
      compareGuideLiveClearRef.current = null
    }, 2800)
  }, [])

  useEffect(() => {
    return () => {
      if (compareGuideLiveClearRef.current != null) globalThis.clearTimeout(compareGuideLiveClearRef.current)
    }
  }, [])

  useEffect(() => {
    const prev = prevCompareGuideOpenAnnRef.current
    prevCompareGuideOpenAnnRef.current = compareGuideOpen
    if (!compareGuideOpen && prev) {
      if (announceCompareGuideCloseRef.current) {
        announceCompareGuideCloseRef.current = false
        queueCompareGuideLiveMsg('Compare workflow guide closed.')
      }
    } else if (compareGuideOpen && !prev) {
      const m = pendingCompareGuideOpenAnnRef.current
      pendingCompareGuideOpenAnnRef.current = null
      if (m) queueCompareGuideLiveMsg(m)
    }
  }, [compareGuideOpen, queueCompareGuideLiveMsg])

  useLayoutEffect(() => {
    openWorkflowGuideWhenUrlRequests({
      urlWantsGuide,
      setGuideOpen: setCompareGuideOpen,
      pendingFocusTitleRef: pendingCompareGuideFocusTitleRef,
      pendingOpenAnnRef: pendingCompareGuideOpenAnnRef,
      setKeyboardContain: setCompareGuideKeyboardContain,
    })
  }, [urlWantsGuide])

  useEffect(() => {
    if (urlComparisonId.trim()) setCompareGuideOpen(false)
  }, [urlComparisonId])

  useEffect(() => {
    if (comparison) setCompareGuideOpen(false)
  }, [comparison?.comparisonId])

  useEffect(() => {
    if (comparison || urlComparisonId.trim()) return
    if (urlWantsGuide) return
    if (skipCompareEmptyGuideSyncRef.current) {
      skipCompareEmptyGuideSyncRef.current = false
      return
    }
    pendingCompareGuideOpenAnnRef.current = null
    setCompareGuideKeyboardContain(false)
    setCompareGuideOpen(layout.visibility.intro && !readWorkflowGuideDismissed('compare'))
  }, [comparison, urlComparisonId, layout.visibility.intro, urlWantsGuide])

  useEffect(() => {
    const prev = prevCompareGuideOpenRef.current
    prevCompareGuideOpenRef.current = compareGuideOpen
    if (prev === undefined) return
    if (prev && !compareGuideOpen && urlWantsWorkflowGuide(searchParams)) {
      const p = new URLSearchParams(searchParams)
      p.delete(WorkflowGuideQueryParam)
      setSearchParams(p, { replace: true })
    }
  }, [compareGuideOpen, searchParams, setSearchParams])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isWorkflowGuideHotkey(e)) {
        e.preventDefault()
        setCompareGuideOpen((was) => {
          if (!was) {
            pendingCompareGuideFocusTitleRef.current = true
            pendingCompareGuideOpenAnnRef.current = 'Compare workflow guide opened.'
            queueMicrotask(() => setCompareGuideKeyboardContain(true))
          }
          return true
        })
        return
      }
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (!compareGuideOpenRef.current) return
      if (workflowGuideHotkeyShouldIgnoreTarget(e.target)) return
      e.preventDefault()
      explicitCompareGuideClosePendingRef.current = true
      announceCompareGuideCloseRef.current = true
      setCompareGuideOpen((prev) => {
        if (prev) writeWorkflowGuideDismissed('compare', true)
        return false
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!compareGuideOpen || !pendingCompareGuideFocusTitleRef.current) return
    pendingCompareGuideFocusTitleRef.current = false
    const id = requestAnimationFrame(() => {
      document.getElementById(COMPARE_WORKFLOW_GUIDE_TITLE_ID)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [compareGuideOpen])

  useEffect(() => {
    if (!compareGuideOpen) setCompareGuideKeyboardContain(false)
  }, [compareGuideOpen])

  useEffect(() => {
    if (compareGuideOpen) return
    if (!explicitCompareGuideClosePendingRef.current) return
    explicitCompareGuideClosePendingRef.current = false
    const id = requestAnimationFrame(() => compareGuideToggleRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [compareGuideOpen])

  const toggleCompareGuide = useCallback(() => {
    setCompareGuideOpen((prev) => {
      if (prev) {
        writeWorkflowGuideDismissed('compare', true)
        explicitCompareGuideClosePendingRef.current = true
        announceCompareGuideCloseRef.current = true
        return false
      }
      pendingCompareGuideFocusTitleRef.current = true
      pendingCompareGuideOpenAnnRef.current = 'Compare workflow guide opened.'
      queueMicrotask(() => setCompareGuideKeyboardContain(true))
      return true
    })
  }, [])

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

  const comparePairTriageBridge = useMemo(
    () =>
      comparison
        ? compareTriagePairBridgeLine(comparison, selectedDetail, {
            highlightFindingDiffId,
            highlightIndexInsightDiffId,
            highlightSuggestionId,
          })
        : null,
    [
      comparison,
      selectedDetail,
      highlightFindingDiffId,
      highlightIndexInsightDiffId,
      highlightSuggestionId,
    ],
  )

  const pairFallbackDisplay = useMemo(
    () => resolveComparePairFallbackDisplay(comparePairTriageBridge, continuitySummaryCue),
    [comparePairTriageBridge, continuitySummaryCue],
  )

  const comparePairHandoffKind = useMemo((): ComparePairHandoffKind | null => {
    if (!selectedDetail) return null
    if (comparePairTriageBridge?.trim()) return 'summary'
    if (pairFallbackDisplay?.body?.trim()) return 'briefing'
    if (highlightFindingDiffId || highlightIndexInsightDiffId || highlightSuggestionId) return 'pinned'
    return 'navigator'
  }, [
    selectedDetail,
    comparePairTriageBridge,
    pairFallbackDisplay,
    highlightFindingDiffId,
    highlightIndexInsightDiffId,
    highlightSuggestionId,
  ])

  const navigatorBriefingHighlightPair = useMemo(() => {
    if (!comparison || !highlightFindingDiffId) return null
    const item = comparison.findingsDiff?.items?.find((i) => i.diffId === highlightFindingDiffId)
    if (!item) return null
    return resolveFindingDiffPair(item, comparison.matches ?? [])
  }, [comparison, highlightFindingDiffId])

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
    if (!exportCompareHint) return
    const t = window.setTimeout(() => setExportCompareHint(null), 6500)
    return () => window.clearTimeout(t)
  }, [exportCompareHint])

  const onExportCompare = useCallback(
    async (kind: 'md' | 'html' | 'json') => {
      if (!comparison) return
      setExportCompareBusyKind(kind)
      setExportCompareHint(null)
      const hasBothPlans = Boolean(planA.trim() && planB.trim())
      const explainMetadataA = sendCompareExplainMetadata
        ? {
            options: {
              format: 'json' as const,
              analyze: compareExplainToggles.analyze,
              verbose: compareExplainToggles.verbose,
              buffers: compareExplainToggles.buffers,
              costs: compareExplainToggles.costs,
            },
            sourceExplainCommand: recordedCommandA.trim() || null,
          }
        : undefined
      const explainMetadataB = sendCompareExplainMetadata
        ? {
            options: {
              format: 'json' as const,
              analyze: compareExplainToggles.analyze,
              verbose: compareExplainToggles.verbose,
              buffers: compareExplainToggles.buffers,
              costs: compareExplainToggles.costs,
            },
            sourceExplainCommand: recordedCommandB.trim() || null,
          }
        : undefined
      const fromSavedLink = !hasBothPlans
      const args = hasBothPlans
        ? {
            planAText: planA,
            planBText: planB,
            queryTextA,
            queryTextB,
            explainMetadataA,
            explainMetadataB,
            diagnostics: includeDiagnostics,
          }
        : { comparison, diagnostics: includeDiagnostics }
      const triageEnvelope = buildCompareExportTriageSummary(comparison, selectedDetail, {
        lead: compareLeadTakeaway(comparison),
        triageBridgeLine: comparePairTriageBridge,
        continuitySummaryCue,
      })
      try {
        if (kind === 'md') {
          const r = await exportCompareMarkdown(args)
          downloadCompareText(
            `compare-${r.comparisonId}.md`,
            markdownCompareExportSupplement(triageEnvelope) + r.markdown,
            'text/markdown',
          )
        } else if (kind === 'html') {
          const r = await exportCompareHtml(args)
          downloadCompareText(
            `compare-${r.comparisonId}.html`,
            injectCompareExportSupplementIntoHtml(r.html, triageEnvelope),
            'text/html',
          )
        } else {
          const r = await exportCompareJson(args)
          downloadCompareText(
            `compare-${r.comparisonId}.json`,
            JSON.stringify(jsonCompareExportWithTriageEnvelope(r, triageEnvelope), null, 2),
            'application/json',
          )
        }
        setExportCompareHint(
          exportDownloadSuccessHint(fromSavedLink ? 'snapshot' : 'fromPlanText', {
            restoredFromLink: fromSavedLink && compareHandoffOrigin === 'link',
          }),
        )
      } catch (e) {
        setExportCompareHint(e instanceof Error ? e.message : String(e))
      } finally {
        setExportCompareBusyKind(null)
      }
    },
    [
      comparison,
      planA,
      planB,
      queryTextA,
      queryTextB,
      sendCompareExplainMetadata,
      compareExplainToggles,
      recordedCommandA,
      recordedCommandB,
      includeDiagnostics,
      selectedDetail,
      comparePairTriageBridge,
      continuitySummaryCue,
      compareHandoffOrigin,
    ],
  )

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
      comparePinLastLayoutCidRef.current = null
      suppressNextPinTransitionForFpRef.current = null
      comparePinLiveRef.current = null
      setComparePinLiveMessage('')
      return
    }

    const parsed = parseCompareUrlPinAndPairState(comparison, location.search)
    if (parsed.pairSelection) {
      setSelectedPair((prev) =>
        prev?.a === parsed.pairSelection!.a && prev?.b === parsed.pairSelection!.b
          ? prev
          : parsed.pairSelection!,
      )
    }

    setHighlightFindingDiffId(parsed.findingDiffId)
    setHighlightIndexInsightDiffId(parsed.indexInsightDiffId)
    setHighlightSuggestionId(parsed.suggestionId)

    const cid = comparison.comparisonId
    const urlFp = comparePinLiveFingerprint(
      parsed.findingDiffId,
      parsed.indexInsightDiffId,
      parsed.suggestionId,
    )

    const cidChanged = comparePinLastLayoutCidRef.current !== cid
    comparePinLastLayoutCidRef.current = cid

    if (cidChanged) {
      comparePinLiveRef.current = { comparisonId: cid, fingerprint: urlFp }
      const hydrateLine = comparePinHydrateAnnouncementForFingerprint(urlFp)
      setComparePinLiveMessage(hydrateLine)
      if (hydrateLine) {
        suppressNextPinTransitionForFpRef.current = urlFp
      }
    }
  }, [comparison, location.search])

  useEffect(() => {
    const line = comparePinLiveMessage
    if (!line || !/^opened with /i.test(line)) return
    const t = globalThis.setTimeout(() => {
      setComparePinLiveMessage((m) => (m === line ? '' : m))
    }, COMPARE_PIN_HYDRATE_CLEAR_MS)
    return () => globalThis.clearTimeout(t)
  }, [comparePinLiveMessage])

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

    // When `pair=` is dropped from the URL, we stop treating the address bar as authoritative for pair id:
    // fall back to the explicit UI selection if any, otherwise the effective navigator/default pair.
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

  useEffect(() => {
    if (!comparison?.comparisonId) {
      suppressNextPinTransitionForFpRef.current = null
      if (pinLiveTransitionTimerRef.current != null) {
        globalThis.clearTimeout(pinLiveTransitionTimerRef.current)
        pinLiveTransitionTimerRef.current = null
      }
      comparePinLiveRef.current = null
      setComparePinLiveMessage('')
      return
    }
    const cid = comparison.comparisonId
    const fp = comparePinLiveFingerprint(
      highlightFindingDiffId,
      highlightIndexInsightDiffId,
      highlightSuggestionId,
    )
    const prev = comparePinLiveRef.current
    if (!prev || prev.comparisonId !== cid) return
    if (prev.fingerprint === fp) return
    if (suppressNextPinTransitionForFpRef.current === fp) {
      suppressNextPinTransitionForFpRef.current = null
      comparePinLiveRef.current = { comparisonId: cid, fingerprint: fp }
      return
    }
    comparePinLiveRef.current = { comparisonId: cid, fingerprint: fp }
    if (pinLiveTransitionTimerRef.current != null) {
      globalThis.clearTimeout(pinLiveTransitionTimerRef.current)
      pinLiveTransitionTimerRef.current = null
    }
    pinLiveTransitionTimerRef.current = globalThis.setTimeout(() => {
      pinLiveTransitionTimerRef.current = null
      setComparePinLiveMessage(comparePinAnnouncementForFingerprint(fp))
    }, PIN_LIVE_ANNOUNCE_DEFER_MS)
    return () => {
      if (pinLiveTransitionTimerRef.current != null) {
        globalThis.clearTimeout(pinLiveTransitionTimerRef.current)
        pinLiveTransitionTimerRef.current = null
      }
    }
  }, [
    comparison?.comparisonId,
    highlightFindingDiffId,
    highlightIndexInsightDiffId,
    highlightSuggestionId,
  ])

  function loadCompareExampleAndRun(id: ComparePlanExampleId) {
    const ex = getComparePlanExample(id)
    if (!ex) return
    setPlanA(ex.planAText)
    setPlanB(ex.planBText)
    void onCompare(ex.planAText, ex.planBText)
  }

  async function onCompare(overridePlanA?: string, overridePlanB?: string) {
    const textA = (overridePlanA ?? planA).trim()
    const textB = (overridePlanB ?? planB).trim()
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
        planAText: textA,
        planBText: textB,
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
      setCompareHandoffOrigin('session')
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
    setCompareHandoffOrigin('session')
    setError(null)
    skipCompareEmptyGuideSyncRef.current = true
    setCompareGuideOpen(true)
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

  const showComparePairInspectorSkip = useMemo(
    () =>
      Boolean(comparison) &&
      layoutTier === 'narrow' &&
      (layout.visibility.branchStrip || layout.visibility.selectedPair),
    [comparison, layoutTier, layout.visibility.branchStrip, layout.visibility.selectedPair],
  )

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
        setHighlightSuggestionId={setHighlightSuggestionId}
        copyNav={copyNav}
        copyFinding={copyFinding}
        briefingHighlightPair={navigatorBriefingHighlightPair}
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
          copyPinContext,
          highlightFindingDiffId,
          highlightIndexInsightDiffId,
          highlightSuggestionId,
          compareOptForPair,
          pairSubtitle,
          triageBridgeLine: comparePairTriageBridge,
          continuityPairFallback: pairFallbackDisplay,
          pairHandoffKind: comparePairHandoffKind,
          pairHandoffOrigin: compareHandoffOrigin,
        }}
      />
    )
  }

  return (
    <div className="pqat-page pqat-pageGrid">
      <div
        className="pqat-srOnly"
        aria-live="polite"
        aria-atomic="true"
        data-testid="compare-workflow-guide-announcer"
      >
        {compareGuideLiveMsg}
      </div>
      <WorkflowGuideBar
        expanded={compareGuideOpen}
        onToggle={toggleCompareGuide}
        toggleCollapsedLabel="How to use Compare"
        toggleExpandedLabel="Hide guide"
        hint="Instructional guide—distinct from change briefings and plan deltas below."
        keyboardHint="Press ? to reopen (not while typing). Share /compare?guide=1 for onboarding."
        toggleRef={compareGuideToggleRef}
        toggleTitle="Press ? to reopen help when focus is not in a text field. Esc closes the guide."
        testId="compare-workflow-guide-bar"
        panelId={COMPARE_GUIDE_PANEL_ID}
      />
      {compareGuideOpen ? (
        <CompareWorkflowGuide
          panelId={COMPARE_GUIDE_PANEL_ID}
          testId="compare-workflow-guide-panel"
          keyboardContain={compareGuideKeyboardContain}
          examplePicker={
            <TryCompareExampleChips
              variant="help"
              examples={COMPARE_PLAN_EXAMPLES}
              disabled={loading || loadingPersistedComparison}
              onSelect={loadCompareExampleAndRun}
            />
          }
        />
      ) : null}

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
            examplePicker={
              !comparison ? (
                <TryCompareExampleChips
                  examples={COMPARE_PLAN_EXAMPLES}
                  disabled={loading || loadingPersistedComparison}
                  onSelect={loadCompareExampleAndRun}
                />
              ) : undefined
            }
            comparison={comparison}
            exportCompareBusyKind={exportCompareBusyKind}
            exportCompareHint={exportCompareHint}
            canExportCompareReports={Boolean(comparison)}
            exportUsesSnapshot={Boolean(comparison && (!planA.trim() || !planB.trim()))}
            onExportCompare={onExportCompare}
          />
        </div>
      ) : null}

      {loadingPersistedComparison ? (
        <div className="pqat-stateBanner pqat-stateBanner--loading" data-testid="compare-persisted-loading">
          <span className="pqat-stateBanner__title">Loading your comparison</span>
          <div className="pqat-stateBanner__body">Fetching the saved result for this link…</div>
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
          <span className="pqat-stateBanner__title">Running comparison</span>
          <div className="pqat-stateBanner__body">
            Building the diff readout. Larger plans may take a few seconds—sections appear as they’re ready.
          </div>
        </div>
      ) : null}

      {comparison ? (
        <section className="pqat-sectionStack">
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-relevant="additions text"
            className="pqat-srOnly"
            data-testid="compare-pin-live"
          >
            {comparePinLiveMessage}
          </div>
          <div id={COMPARE_WORKSPACE_KEYBOARD_HINTS_ID} className="pqat-srOnly">
            {COMPARE_WORKSPACE_KEYBOARD_HINTS_TEXT}
          </div>
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
                  summaryStickyNarrow={layoutTier === 'narrow'}
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
            {layoutTier === 'narrow' ? (
              <>
                {renderNavigatorColumn()}
                <SkipToPairInspectorLink visible={showComparePairInspectorSkip} />
                {renderPairColumn()}
              </>
            ) : (
              <>
                {layout.mainColumnOrder[0] === 'navigator' ? renderNavigatorColumn() : renderPairColumn()}
                {layout.mainColumnOrder[1] === 'navigator' ? renderNavigatorColumn() : renderPairColumn()}
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
