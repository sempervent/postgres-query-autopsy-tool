import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { AnalyzedPlanNode, OptimizationSuggestion, PlanAnalysisResult } from '../api/types'
import {
  AccessDeniedError,
  AnalysisNotFoundError,
  ArtifactCorruptError,
  ArtifactIncompatibleSchemaError,
  analyzePlanWithQuery,
  exportHtml,
  exportJson,
  exportMarkdown,
  fetchAppConfig,
  getAnalysis,
  PlanParseError,
} from '../api/client'
import { nodeShortLabel } from '../presentation/nodeLabels'
import { buildAnalyzeGraph } from '../presentation/analyzeGraphAdapter'
import { applyGraphView, revealPath } from '../presentation/analyzeGraphState'
import {
  compareSuggestionsByPriority,
  normalizeOptimizationSuggestionsForDisplay,
} from '../presentation/optimizationSuggestionsPresentation'
import { AnalyzeDeepLinkParam, buildAnalyzeDeepLinkSearchParams } from '../presentation/artifactLinks'
import { buildSuggestedExplainSql } from '../presentation/explainCommandBuilder'
import { useCopyFeedback } from '../presentation/useCopyFeedback'
import { useWorkspaceLayoutTier } from '../hooks/useWorkspaceLayoutTier'
import { useAnalyzeWorkspaceLayout } from '../analyzeWorkspace/useAnalyzeWorkspaceLayout'
import type { AnalyzeLowerBandColumnId } from '../analyzeWorkspace/analyzeWorkspaceModel'
import { AnalyzeCapturePanel } from '../components/analyze/AnalyzeCapturePanel'
import { AnalyzeSummaryCard } from '../components/analyze/AnalyzeSummaryCard'
import { LowerBandPanelSkeleton } from '../components/HeavyPanelShell'
import { AnalyzePlanWorkspacePanel } from '../components/analyze/AnalyzePlanWorkspacePanel'
import { AnalyzePlanGuideRail } from '../components/analyze/AnalyzePlanGuideRail'

const AnalyzeFindingsPanel = lazy(() =>
  import('../components/analyze/AnalyzeFindingsPanel').then((m) => ({ default: m.AnalyzeFindingsPanel })),
)
const AnalyzeOptimizationSuggestionsPanel = lazy(() =>
  import('../components/analyze/AnalyzeOptimizationSuggestionsPanel').then((m) => ({ default: m.AnalyzeOptimizationSuggestionsPanel })),
)
const AnalyzeSelectedNodePanel = lazy(() =>
  import('../components/analyze/AnalyzeSelectedNodePanel').then((m) => ({ default: m.AnalyzeSelectedNodePanel })),
)

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AnalyzePage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState('')
  const [queryText, setQueryText] = useState('')
  const [explainToggles, setExplainToggles] = useState({
    analyze: true,
    verbose: true,
    buffers: true,
    costs: true,
  })
  const [sendExplainMetadata, setSendExplainMetadata] = useState(true)
  const [recordedExplainCommand, setRecordedExplainCommand] = useState('')
  const [analysis, setAnalysis] = useState<PlanAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPersisted, setLoadingPersisted] = useState(false)
  const [appConfig, setAppConfig] = useState<import('../api/types').AppConfig | null>(null)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [treeMode, setTreeMode] = useState<'graph' | 'text'>('graph')
  const [graphSearch, setGraphSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [matchIdx, setMatchIdx] = useState(0)
  const [reframeToken, setReframeToken] = useState(0)
  const [nodeSearch, setNodeSearch] = useState('')
  const [findingSearch, setFindingSearch] = useState('')
  const [minSeverity, setMinSeverity] = useState<number>(1)
  const [expandedOptimizationId, setExpandedOptimizationId] = useState<string | null>(null)

  const copyNode = useCopyFeedback()
  const copyHotspot = useCopyFeedback()
  const copyFinding = useCopyFeedback()
  const copyShareLink = useCopyFeedback()
  const copySuggestedExplain = useCopyFeedback()
  const lastSyncedAnalyzeQs = useRef('')
  const loadPersistedSeqRef = useRef(0)

  const urlAnalysisId = searchParams.get(AnalyzeDeepLinkParam.analysis)?.trim() ?? ''
  const layoutTier = useWorkspaceLayoutTier()
  const layoutApi = useAnalyzeWorkspaceLayout(appConfig?.authEnabled ?? false)
  const { layout } = layoutApi

  const byId = useMemo(() => {
    if (!analysis) return new Map<string, AnalyzedPlanNode>()
    return new Map(analysis.nodes.map((n) => [n.nodeId, n]))
  }, [analysis])

  const childrenById = useMemo(() => {
    if (!analysis) return new Map<string, string[]>()
    return new Map(analysis.nodes.map((n) => [n.nodeId, n.childNodeIds ?? []]))
  }, [analysis])

  const rootId = analysis?.rootNodeId ?? null
  const selectedNode = selectedNodeId ? byId.get(selectedNodeId) ?? null : null

  useEffect(() => {
    let cancelled = false
    fetchAppConfig()
      .then((c) => {
        if (!cancelled) setAppConfig(c)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const suggestedExplainSql = useMemo(
    () => buildSuggestedExplainSql(queryText, explainToggles),
    [queryText, explainToggles],
  )

  useEffect(() => {
    if (!urlAnalysisId) return
    if (analysis?.analysisId === urlAnalysisId) return
    let cancelled = false
    const seq = ++loadPersistedSeqRef.current
    setLoadingPersisted(true)
    setError(null)
    ;(async () => {
      try {
        const data = await getAnalysis(urlAnalysisId)
        if (cancelled || loadPersistedSeqRef.current !== seq) return
        setAnalysis(data)
        setInput('')
      } catch (e) {
        if (cancelled || loadPersistedSeqRef.current !== seq) return
        setAnalysis(null)
        setError(
          e instanceof AnalysisNotFoundError
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
        if (!cancelled && loadPersistedSeqRef.current === seq) setLoadingPersisted(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [urlAnalysisId, analysis?.analysisId])

  useEffect(() => {
    if (!analysis) return
    const id = searchParams.get('node')
    if (id && analysis.nodes.some((x) => x.nodeId === id) && id !== selectedNodeId) setSelectedNodeId(id)
  }, [analysis, analysis?.analysisId, searchParams, selectedNodeId])

  useEffect(() => {
    if (!analysis) {
      lastSyncedAnalyzeQs.current = ''
      return
    }
    const urlNode = searchParams.get('node')
    const resolvedNodeId =
      selectedNodeId ?? (urlNode && analysis.nodes.some((x) => x.nodeId === urlNode) ? urlNode : null)
    const next = buildAnalyzeDeepLinkSearchParams({
      analysisId: analysis.analysisId,
      nodeId: resolvedNodeId,
    })
    const nextQs = next.toString()
    const curNorm = location.search.startsWith('?') ? location.search.slice(1) : location.search
    if (nextQs === curNorm) {
      lastSyncedAnalyzeQs.current = nextQs
      return
    }
    if (nextQs === lastSyncedAnalyzeQs.current) return
    lastSyncedAnalyzeQs.current = nextQs
    setSearchParams(next, { replace: true })
  }, [analysis, analysis?.analysisId, selectedNodeId, location.search, searchParams, setSearchParams])

  function nodeLabel(n: AnalyzedPlanNode) {
    return nodeShortLabel(n, byId)
  }

  const filteredFindings = useMemo(() => {
    if (!analysis) return []
    const q = findingSearch.trim().toLowerCase()
    return analysis.findings.filter((f) => {
      if (f.severity < minSeverity) return false
      if (!q) return true
      const hay = `${f.title} ${f.summary} ${f.ruleId}`.toLowerCase()
      return hay.includes(q)
    })
  }, [analysis, findingSearch, minSeverity])

  const findingsForSelectedNode = useMemo(() => {
    if (!analysis || !selectedNodeId) return []
    return analysis.findings.filter((f) => (f.nodeIds ?? []).includes(selectedNodeId))
  }, [analysis, selectedNodeId])

  const sortedOptimizationSuggestions = useMemo(() => {
    const raw = analysis?.optimizationSuggestions ?? []
    const sorted = [...raw].sort(compareSuggestionsByPriority)
    return normalizeOptimizationSuggestionsForDisplay(sorted)
  }, [analysis])

  const relatedOptimizationForSelectedNode = useMemo((): OptimizationSuggestion | null => {
    if (!sortedOptimizationSuggestions.length || !selectedNodeId) return null
    const hits = sortedOptimizationSuggestions.filter((s) => (s.targetNodeIds ?? []).includes(selectedNodeId))
    return [...hits].sort(compareSuggestionsByPriority)[0] ?? null
  }, [sortedOptimizationSuggestions, selectedNodeId])

  const graph = useMemo(() => {
    if (!analysis) return null
    return buildAnalyzeGraph(analysis)
  }, [analysis])

  const graphView = useMemo(() => {
    if (!graph) return null
    return applyGraphView(graph, { collapsed, searchTerm: graphSearch }, selectedNodeId)
  }, [graph, collapsed, graphSearch, selectedNodeId])

  const graphHits = graphView?.hits ?? []

  function selectGraphHit(i: number) {
    if (!graphHits.length) return
    const idx = ((i % graphHits.length) + graphHits.length) % graphHits.length
    setMatchIdx(idx)
    const id = graphHits[idx].nodeId
    if (graph) setCollapsed((prev) => revealPath(prev, graph, id))
    setSelectedNodeId(id)
  }

  function jumpToNodeId(id: string) {
    if (graph) setCollapsed((prev) => revealPath(prev, graph, id))
    const idx = graphHits.findIndex((h) => h.nodeId === id)
    if (idx >= 0) setMatchIdx(idx)
    setSelectedNodeId(id)
  }

  function stripAnalyzeUrlParams() {
    const p = new URLSearchParams(location.search)
    p.delete(AnalyzeDeepLinkParam.analysis)
    p.delete(AnalyzeDeepLinkParam.node)
    lastSyncedAnalyzeQs.current = ''
    setSearchParams(p, { replace: true })
  }

  async function onAnalyze() {
    setError(null)
    setLoading(true)
    const nodeHint = searchParams.get('node')
    stripAnalyzeUrlParams()
    loadPersistedSeqRef.current += 1
    setAnalysis(null)
    setSelectedNodeId(null)
    try {
      const result = await analyzePlanWithQuery(
        input,
        queryText,
        sendExplainMetadata
          ? {
              options: {
                format: 'json',
                analyze: explainToggles.analyze,
                verbose: explainToggles.verbose,
                buffers: explainToggles.buffers,
                costs: explainToggles.costs,
              },
              sourceExplainCommand: recordedExplainCommand.trim() || null,
            }
          : undefined,
      )
      setAnalysis(result)
      if (nodeHint && result.nodes.some((x) => x.nodeId === nodeHint)) setSelectedNodeId(nodeHint)
      else setSelectedNodeId(result.rootNodeId)
    } catch (e) {
      if (e instanceof PlanParseError) {
        const parts = [e.message, e.hint].filter((x) => x && String(x).trim().length)
        setError(parts.join(' '))
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  async function onExport(kind: 'md' | 'html' | 'json') {
    if (!analysis) return
    try {
      if (kind === 'md') {
        const r = await exportMarkdown(analysis)
        downloadText(`autopsy-${r.analysisId}.md`, r.markdown, 'text/markdown')
      } else if (kind === 'html') {
        const r = await exportHtml(analysis)
        downloadText(`autopsy-${r.analysisId}.html`, r.html, 'text/html')
      } else {
        const r = await exportJson(analysis)
        downloadText(`autopsy-${r.analysisId}.json`, JSON.stringify(r, null, 2), 'application/json')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function onClear() {
    setInput('')
    setAnalysis(null)
    setError(null)
    setSelectedNodeId(null)
    loadPersistedSeqRef.current += 1
    const p = new URLSearchParams(location.search)
    p.delete(AnalyzeDeepLinkParam.node)
    p.delete(AnalyzeDeepLinkParam.analysis)
    lastSyncedAnalyzeQs.current = ''
    setSearchParams(p, { replace: true })
  }

  const visibleLower = layout.lowerBandOrder.filter((col) => {
    if (col === 'findings') return layout.visibility.findings
    if (col === 'suggestions') return layout.visibility.suggestions
    return layout.visibility.selectedNode
  })

  function lowerBandFallback(col: AnalyzeLowerBandColumnId) {
    if (col === 'findings') return <LowerBandPanelSkeleton title="Findings" eyebrow="Loading" lines={6} />
    if (col === 'suggestions') return <LowerBandPanelSkeleton title="Optimization suggestions" eyebrow="Loading" lines={5} />
    return <LowerBandPanelSkeleton title="Selected node" eyebrow="Loading" lines={5} />
  }

  function renderLowerColumn(col: AnalyzeLowerBandColumnId) {
    if (!analysis) return null
    if (col === 'findings' && layout.visibility.findings) {
      return (
        <AnalyzeFindingsPanel
          findingSearch={findingSearch}
          setFindingSearch={setFindingSearch}
          minSeverity={minSeverity}
          setMinSeverity={setMinSeverity}
          filteredFindings={filteredFindings}
          selectedNodeId={selectedNodeId}
          jumpToNodeId={jumpToNodeId}
          byId={byId}
          copyFinding={copyFinding}
        />
      )
    }
    if (col === 'suggestions' && layout.visibility.suggestions) {
      return (
        <AnalyzeOptimizationSuggestionsPanel
          sortedOptimizationSuggestions={sortedOptimizationSuggestions}
          expandedOptimizationId={expandedOptimizationId}
          setExpandedOptimizationId={setExpandedOptimizationId}
          jumpToNodeId={jumpToNodeId}
          byId={byId}
          nodeLabel={nodeLabel}
          bottlenecks={analysis.summary.bottlenecks ?? undefined}
        />
      )
    }
    if (col === 'selectedNode' && layout.visibility.selectedNode) {
      return (
        <AnalyzeSelectedNodePanel
          analysis={analysis}
          selectedNode={selectedNode}
          selectedNodeId={selectedNodeId}
          byId={byId}
          findingsForSelectedNode={findingsForSelectedNode}
          relatedOptimizationForSelectedNode={relatedOptimizationForSelectedNode}
          appConfig={appConfig}
          locationPathname={location.pathname}
          copyNode={copyNode}
          copyShareLink={copyShareLink}
          nodeLabel={nodeLabel}
        />
      )
    }
    return null
  }

  return (
    <div className="pqat-page pqat-stack" style={{ gap: 18 }}>
      {!layout.visibility.capture ? (
        <div
          className="pqat-panel pqat-panel--tool"
          style={{
            padding: 12,
            borderStyle: 'dashed',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span className="pqat-hint" style={{ margin: 0 }}>
            Plan capture is hidden.
          </span>
          <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--primary" onClick={() => layoutApi.setVisibility('capture', true)}>
            Show input
          </button>
        </div>
      ) : (
        <AnalyzeCapturePanel
          input={input}
          setInput={setInput}
          queryText={queryText}
          setQueryText={setQueryText}
          explainToggles={explainToggles}
          setExplainToggles={setExplainToggles}
          sendExplainMetadata={sendExplainMetadata}
          setSendExplainMetadata={setSendExplainMetadata}
          recordedExplainCommand={recordedExplainCommand}
          setRecordedExplainCommand={setRecordedExplainCommand}
          suggestedExplainSql={suggestedExplainSql}
          copySuggestedExplain={copySuggestedExplain}
          onAnalyze={onAnalyze}
          onClear={onClear}
          onExport={onExport}
          loading={loading}
          loadingPersisted={loadingPersisted}
          analysis={analysis}
          error={error}
        />
      )}

      {analysis && layout.visibility.summary ? (
        <AnalyzeSummaryCard
          analysis={analysis}
          appConfig={appConfig}
          sendExplainMetadata={sendExplainMetadata}
          selectedNodeId={selectedNodeId}
          locationPathname={location.pathname}
          copyShareLink={copyShareLink}
          setAnalysis={setAnalysis}
          jumpToNodeId={jumpToNodeId}
        />
      ) : null}

      {analysis && layout.visibility.workspace ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              layoutTier !== 'narrow' && layout.visibility.guide
                ? layoutTier === 'wide'
                  ? 'minmax(0, 1.4fr) minmax(280px, min(26vw, 480px))'
                  : 'minmax(0, 1fr) minmax(240px, 36%)'
                : '1fr',
            gap: 18,
            alignItems: 'stretch',
          }}
          aria-label="Analyze workspace"
        >
          <AnalyzePlanWorkspacePanel
            layoutApi={layoutApi}
            analysis={analysis}
            treeMode={treeMode}
            setTreeMode={setTreeMode}
            nodeSearch={nodeSearch}
            setNodeSearch={setNodeSearch}
            graph={graph}
            graphView={graphView}
            graphHits={graphHits}
            graphSearch={graphSearch}
            setGraphSearch={setGraphSearch}
            setMatchIdx={setMatchIdx}
            matchIdx={matchIdx}
            selectGraphHit={selectGraphHit}
            jumpToNodeId={jumpToNodeId}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            reframeToken={reframeToken}
            setReframeToken={setReframeToken}
            childrenById={childrenById}
            rootId={rootId}
            nodeLabel={nodeLabel}
          />
          {layout.visibility.guide ? (
            <AnalyzePlanGuideRail
              analysis={analysis}
              guideSectionOrder={layout.guideSectionOrder}
              byId={byId}
              selectedNode={selectedNode}
              selectedNodeId={selectedNodeId}
              findingsForSelectedNode={findingsForSelectedNode}
              filteredFindings={filteredFindings}
              sortedOptimizationSuggestions={sortedOptimizationSuggestions}
              jumpToNodeId={jumpToNodeId}
              copyHotspot={copyHotspot}
              nodeLabel={nodeLabel}
            />
          ) : null}
        </div>
      ) : null}

      {analysis ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              visibleLower.length <= 1
                ? '1fr'
                : layoutTier === 'wide'
                  ? visibleLower.map(() => 'minmax(0, 1fr)').join(' ')
                  : 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 18,
            alignItems: 'start',
          }}
          aria-label="Findings and node detail"
        >
          {visibleLower.length === 0 ? (
            <div className="pqat-panel pqat-panel--tool pqat-hint" style={{ padding: 14, fontSize: 13, margin: 0 }}>
              Findings, suggestions, and selected-node panels are hidden. Open <b>Customize workspace</b> in Plan workspace to show them again.
            </div>
          ) : (
            visibleLower.map((col) => (
              <div key={col} style={{ minWidth: 0 }}>
                <Suspense fallback={lowerBandFallback(col)}>{renderLowerColumn(col)}</Suspense>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
