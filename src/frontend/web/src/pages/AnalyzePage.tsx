import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { AnalysisFinding, AnalyzedPlanNode, OptimizationSuggestion, PlanAnalysisResult } from '../api/types'
import {
  AnalysisNotFoundError,
  analyzePlanWithQuery,
  exportHtml,
  exportJson,
  exportMarkdown,
  getAnalysis,
  PlanParseError,
} from '../api/client'
import { findingAnchorLabel, joinLabelAndSubtitle, nodeShortLabel } from '../presentation/nodeLabels'
import { joinSideContextLineForNode } from '../presentation/joinPainHints'
import { buildHotspots } from '../presentation/hotspotPresentation'
import { buildAnalyzeGraph } from '../presentation/analyzeGraphAdapter'
import { AnalyzePlanGraph } from '../components/AnalyzePlanGraph'
import { applyGraphView, revealPath, shouldAutoFitOnVisibilityChange, toggleCollapsed } from '../presentation/analyzeGraphState'
import { bufferCounterRowsForApiNode, planNodeApiHasAnyBufferCounter } from '../presentation/bufferFieldsPresentation'
import { getWorkersFromPlanNode, workerSummaryCue, workerTableRows } from '../presentation/workerPresentation'
import {
  formatAccessPathSummaryLine,
  indexInsightsForNodeId,
  indexOverviewSummaryLine,
} from '../presentation/indexInsightPresentation'
import { findingReferenceText, hotspotReferenceText, nodeReferenceText } from '../presentation/nodeReferences'
import {
  compareSuggestionsByPriority,
  optimizationCategoryLabel,
  suggestionConfidenceLabel,
  suggestionPriorityLabel,
} from '../presentation/optimizationSuggestionsPresentation'
import {
  AnalyzeDeepLinkParam,
  analyzeDeepLinkPath,
  buildAnalyzeDeepLinkSearchParams,
} from '../presentation/artifactLinks'
import { buildSuggestedExplainSql } from '../presentation/explainCommandBuilder'
import { formatDeclaredExplainOptionsLine, plannerCostsLabel } from '../presentation/explainMetadataPresentation'
import { useCopyFeedback } from '../presentation/useCopyFeedback'
import { ClickableRow } from '../components/ClickableRow'
import { ReferenceCopyButton } from '../components/ReferenceCopyButton'

function severityLabel(sev: number) {
  return ['Info', 'Low', 'Medium', 'High', 'Critical'][sev] ?? String(sev)
}
function confidenceLabel(conf: number) {
  return ['Low', 'Medium', 'High'][conf] ?? String(conf)
}

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

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [treeMode, setTreeMode] = useState<'graph' | 'text'>('graph')
  const [graphSearch, setGraphSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [matchIdx, setMatchIdx] = useState(0)
  const [reframeToken, setReframeToken] = useState(0)
  const [nodeSearch, setNodeSearch] = useState('')
  const [findingSearch, setFindingSearch] = useState('')
  const [minSeverity, setMinSeverity] = useState<number>(1) // default: Low+
  const [expandedOptimizationId, setExpandedOptimizationId] = useState<string | null>(null)

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
  const copyNode = useCopyFeedback()
  const copyHotspot = useCopyFeedback()
  const copyFinding = useCopyFeedback()
  const copyShareLink = useCopyFeedback()
  const copySuggestedExplain = useCopyFeedback()
  const lastSyncedAnalyzeQs = useRef('')
  const loadPersistedSeqRef = useRef(0)

  const urlAnalysisId = searchParams.get(AnalyzeDeepLinkParam.analysis)?.trim() ?? ''

  const suggestedExplainSql = useMemo(
    () => buildSuggestedExplainSql(queryText, explainToggles),
    [queryText, explainToggles],
  )

  /** Open shared analysis from `?analysis=` (opaque persisted id). */
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

  /** Restore selection from `?node=` when the URL or analysis changes (browser back/forward, shared links). */
  useEffect(() => {
    if (!analysis) return
    const id = searchParams.get('node')
    if (id && analysis.nodes.some((x) => x.nodeId === id) && id !== selectedNodeId) setSelectedNodeId(id)
  }, [analysis, analysis?.analysisId, searchParams, selectedNodeId])

  /** Keep `?analysis=` + `?node=` in sync (deduped; replace history to avoid noise). */
  useEffect(() => {
    if (!analysis) {
      lastSyncedAnalyzeQs.current = ''
      return
    }
    const urlNode = searchParams.get('node')
    const resolvedNodeId =
      selectedNodeId ??
      (urlNode && analysis.nodes.some((x) => x.nodeId === urlNode) ? urlNode : null)
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

  const topOptimizationSuggestions = useMemo(() => {
    const raw = analysis?.optimizationSuggestions ?? []
    return [...raw].sort(compareSuggestionsByPriority).slice(0, 5)
  }, [analysis])

  const relatedOptimizationForSelectedNode = useMemo((): OptimizationSuggestion | null => {
    if (!analysis?.optimizationSuggestions?.length || !selectedNodeId) return null
    const hits = analysis.optimizationSuggestions.filter((s) => (s.targetNodeIds ?? []).includes(selectedNodeId))
    return hits.sort(compareSuggestionsByPriority)[0] ?? null
  }, [analysis, selectedNodeId])

  function matchesNodeSearch(n: AnalyzedPlanNode) {
    const q = nodeSearch.trim().toLowerCase()
    if (!q) return true
    const t = String((n.node as any)?.nodeType ?? '').toLowerCase()
    const rel = String((n.node as any)?.relationName ?? '').toLowerCase()
    const idx = String((n.node as any)?.indexName ?? '').toLowerCase()
    return t.includes(q) || rel.includes(q) || idx.includes(q)
  }

  function TreeNode({ nodeId }: { nodeId: string }) {
    const node = byId.get(nodeId)
    if (!node) return null

    if (!matchesNodeSearch(node)) {
      // If the node doesn't match, still render it if any descendant matches.
      const kids = childrenById.get(nodeId) ?? []
      const anyDesc = kids.some((k) => {
        const child = byId.get(k)
        return child ? matchesNodeSearch(child) : false
      })
      if (!anyDesc) return null
    }

    const kids = childrenById.get(nodeId) ?? []

    return (
      <div style={{ marginLeft: 12, borderLeft: '1px solid var(--border)', paddingLeft: 10, marginTop: 6 }}>
        <button
          onClick={() => setSelectedNodeId(nodeId)}
          style={{
            display: 'flex',
            width: '100%',
            textAlign: 'left',
            gap: 8,
            alignItems: 'center',
            padding: '6px 8px',
            borderRadius: 10,
            border: selectedNodeId === nodeId ? '1px solid var(--accent-border)' : '1px solid transparent',
            background: selectedNodeId === nodeId ? 'var(--accent-bg)' : 'transparent',
            color: 'var(--text-h)',
            cursor: 'pointer',
            fontFamily: 'var(--mono)',
            fontSize: 12,
          }}
        >
          <span style={{ opacity: 0.8, fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)' }}>
            {String((node.node as any)?.nodeType ?? 'Unknown')}
          </span>
          <span style={{ fontFamily: 'var(--mono)' }}>{nodeLabel(node)}</span>
        </button>
        {kids.length > 0 ? kids.map((k) => <TreeNode key={k} nodeId={k} />) : null}
      </div>
    )
  }

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
    if (graph)
      setCollapsed((prev) => {
        const next = revealPath(prev, graph, id)
        return next
      })
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
      <section>
        <h2>Input plan</h2>
        <p style={{ opacity: 0.85, marginTop: -8, marginBottom: 12 }}>
          Paste raw <code>EXPLAIN (…, FORMAT JSON)</code> output: plain JSON, or <code>psql</code> tabular output with a <code>QUERY PLAN</code> header and optional line wraps ending in <code>+</code>. The server normalizes common shapes before parsing. Planner <code>COSTS</code> are optional; cost fields are detected from the JSON.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 220,
              padding: 12,
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
              fontFamily: 'var(--mono)',
            }}
            placeholder='JSON or psql QUERY PLAN cell text: [ { "Plan": { ... } } ]'
          />
          <details>
            <summary style={{ cursor: 'pointer', opacity: 0.9 }}>Optional: source SQL query</summary>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 140,
                marginTop: 8,
                padding: 12,
                borderRadius: 12,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-h)',
                fontFamily: 'var(--mono)',
              }}
              placeholder="SELECT ... FROM ... WHERE ..."
            />
          </details>
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', opacity: 0.9 }}>Suggested EXPLAIN command (copy-paste)</summary>
            <p style={{ fontSize: 12, opacity: 0.82, marginTop: 8, marginBottom: 0 }}>
              Wraps the optional source SQL below—no parsing, only text wrapping. Default matches a forensic-style capture; turn <strong>COSTS</strong> off to align with{' '}
              <code>EXPLAIN (…, COSTS false, …)</code> output.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={sendExplainMetadata}
                onChange={(e) => setSendExplainMetadata(e.target.checked)}
              />
              Send EXPLAIN options with analyze request (stored in API result and exports)
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
                    checked={explainToggles[k]}
                    onChange={(e) => setExplainToggles((prev) => ({ ...prev, [k]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <label style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 10 }}>
              Optional: exact EXPLAIN command you ran (preserved verbatim when sent)
            </label>
            <textarea
              value={recordedExplainCommand}
              onChange={(e) => setRecordedExplainCommand(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 56,
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-h)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
              }}
              placeholder="EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ..."
            />
            {suggestedExplainSql ? (
              <div style={{ marginTop: 10 }}>
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {suggestedExplainSql}
                </pre>
                <button
                  type="button"
                  onClick={() => suggestedExplainSql && void copySuggestedExplain.copy(suggestedExplainSql, 'Copied')}
                  style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  Copy suggested EXPLAIN
                </button>
                {copySuggestedExplain.status ? (
                  <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.85 }}>{copySuggestedExplain.status}</span>
                ) : null}
              </div>
            ) : (
              <p style={{ fontSize: 12, opacity: 0.8, marginTop: 10 }}>Add source SQL above to generate a suggested command.</p>
            )}
          </details>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onAnalyze}
            disabled={loading || loadingPersisted || input.trim().length === 0}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--accent-border)',
              background: 'var(--accent-bg)',
              color: 'var(--text-h)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
          <button
            onClick={() => {
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

          <div style={{ flex: 1 }} />

          <button disabled={!analysis} onClick={() => onExport('md')} style={{ padding: '8px 10px', borderRadius: 10 }}>
            Export Markdown
          </button>
          <button disabled={!analysis} onClick={() => onExport('html')} style={{ padding: '8px 10px', borderRadius: 10 }}>
            Export HTML
          </button>
          <button disabled={!analysis} onClick={() => onExport('json')} style={{ padding: '8px 10px', borderRadius: 10 }}>
            Export JSON
          </button>
        </div>

        {loadingPersisted ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', opacity: 0.9 }}>
            Opening shared analysis…
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid #f59e0b', color: 'var(--text-h)' }}>
            <b>Error:</b> {error}
          </div>
        ) : null}

        {analysis ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>AnalysisId</div>
                <div style={{ fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{analysis.analysisId}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Summary</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  nodes={analysis.summary.totalNodeCount} depth={analysis.summary.maxDepth} severe={analysis.summary.severeFindingsCount} timing=
                  {String(analysis.summary.hasActualTiming)} buffers={String(analysis.summary.hasBuffers)} plannerCosts=
                  {String(analysis.summary.plannerCosts ?? 'unknown')}
                </div>
              </div>
            </div>
            {analysis.planInputNormalization ? (
              <div style={{ fontSize: 12, opacity: 0.82, marginTop: 10 }} aria-label="Plan input normalization">
                {analysis.planInputNormalization.kind === 'queryPlanTable'
                  ? 'Normalized pasted QUERY PLAN output'
                  : analysis.planInputNormalization.kind === 'rawJson'
                    ? 'Parsed raw JSON directly'
                    : `Input normalization: ${analysis.planInputNormalization.kind}`}
              </div>
            ) : null}
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={async () => {
                  const path = analyzeDeepLinkPath(
                    location.pathname,
                    buildAnalyzeDeepLinkSearchParams({
                      analysisId: analysis.analysisId,
                      nodeId: selectedNodeId,
                    }),
                  )
                  await copyShareLink.copy(`${window.location.origin}${path}`, 'Copied share link')
                }}
                style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
              >
                Copy share link
              </button>
              {copyShareLink.status ? (
                <span style={{ fontSize: 12, opacity: 0.85 }}>{copyShareLink.status}</span>
              ) : null}
            </div>
            <div style={{ fontSize: 11, opacity: 0.78, marginTop: 8, fontFamily: 'var(--mono)' }}>
              Snapshots persist in server SQLite; share links survive API restart if the database file is kept.
            </div>
            <div
              style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13 }}
              aria-label="Plan source and EXPLAIN metadata"
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Plan source / EXPLAIN metadata</div>
              <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.92 }}>
                <li>Source query: {analysis.queryText?.trim() ? 'provided' : 'not provided'}</li>
                <li>{plannerCostsLabel(analysis.summary.plannerCosts)}</li>
                {analysis.explainMetadata?.options ? (
                  <li>
                    Declared EXPLAIN options (client):{' '}
                    {formatDeclaredExplainOptionsLine(analysis.explainMetadata) ?? '—'}
                  </li>
                ) : sendExplainMetadata ? (
                  <li>No declared options in response (server omitted empty metadata).</li>
                ) : (
                  <li>Declared EXPLAIN options were not sent with this request.</li>
                )}
                {analysis.explainMetadata?.sourceExplainCommand?.trim() ? (
                  <li style={{ marginTop: 6 }}>
                    <span style={{ display: 'block', fontSize: 11, opacity: 0.85 }}>Recorded command</span>
                    <pre
                      style={{
                        margin: '4px 0 0',
                        padding: 8,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {analysis.explainMetadata.sourceExplainCommand.trim()}
                    </pre>
                  </li>
                ) : null}
              </ul>
            </div>
            {analysis.summary.warnings?.length ? (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <b>Limitations:</b>
                <ul style={{ marginTop: 6 }}>
                  {analysis.summary.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(() => {
              const line = indexOverviewSummaryLine(analysis.indexOverview ?? null)
              if (!line) return null
              return (
                <div style={{ marginTop: 10, fontSize: 12, fontFamily: 'var(--mono)', opacity: 0.9 }} aria-label="Plan index overview">
                  <b>Index posture:</b> {line}
                </div>
              )
            })()}
          </div>
        ) : null}

        {selectedNode ? (
          <section style={{ marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ marginTop: 0 }}>Node context summary</h3>
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
                lines.push(`scan waste: removedByFilter=${String(waste?.rowsRemovedByFilter ?? '—')} recheck=${String(waste?.rowsRemovedByIndexRecheck ?? '—')} heapFetches=${String(waste?.heapFetches ?? '—')}`)
              }
              const memo = ctx?.memoize
              if (memo?.hitRate != null) {
                lines.push(`memoize: hitRate=${String(memo.hitRate)} hits=${String(memo.cacheHits ?? '—')} misses=${String(memo.cacheMisses ?? '—')}`)
              }

              if (lines.length === 0) return <div style={{ opacity: 0.8 }}>No contextual evidence for this node.</div>
              return (
                <ul style={{ marginTop: 8 }}>
                  {lines.map((l) => (
                    <li key={l} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{l}</li>
                  ))}
                </ul>
              )
            })()}
          </section>
        ) : null}

        {analysis ? (
          <div style={{ marginTop: 16 }}>
            <h2>Plan tree</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setTreeMode('graph')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: treeMode === 'graph' ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  background: treeMode === 'graph' ? 'var(--accent-bg)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                Graph
              </button>
              <button
                onClick={() => setTreeMode('text')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: treeMode === 'text' ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  background: treeMode === 'text' ? 'var(--accent-bg)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                Text
              </button>
              <div style={{ opacity: 0.8, fontSize: 12 }}>Tip: click a hotspot to focus the graph.</div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <input
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                placeholder="Search nodes (type/relation/index)"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-h)',
                }}
              />
            </div>
            {treeMode === 'graph' && graph ? (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <input
                    value={graphSearch}
                    onChange={(e) => {
                      setGraphSearch(e.target.value)
                      setMatchIdx(0)
                    }}
                    placeholder="Graph search (operator / relation / index)"
                    style={{
                      flex: 1,
                      minWidth: 220,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-h)',
                    }}
                  />
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>
                    {graphSearch.trim().length ? `${graphHits.length} match${graphHits.length === 1 ? '' : 'es'}` : ''}
                  </div>
                  <button
                    onClick={() => selectGraphHit(matchIdx - 1)}
                    disabled={!graphHits.length}
                    style={{ padding: '10px 12px', borderRadius: 12, cursor: graphHits.length ? 'pointer' : 'not-allowed', opacity: graphHits.length ? 1 : 0.5 }}
                  >
                    prev
                  </button>
                  <button
                    onClick={() => selectGraphHit(matchIdx + 1)}
                    disabled={!graphHits.length}
                    style={{ padding: '10px 12px', borderRadius: 12, cursor: graphHits.length ? 'pointer' : 'not-allowed', opacity: graphHits.length ? 1 : 0.5 }}
                  >
                    next
                  </button>
                </div>
                {graphSearch.trim().length && graphHits.length ? (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: 10,
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      maxHeight: 220,
                      overflow: 'auto',
                      background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Matches (click to jump)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {graphHits.slice(0, 25).map((h, i) => (
                        <button
                          key={h.nodeId}
                          onClick={() => jumpToNodeId(h.nodeId)}
                          style={{
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: i === matchIdx ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                            background: i === matchIdx ? 'var(--accent-bg)' : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{h.label}</div>
                          {h.subtitle ? <div style={{ fontSize: 12, opacity: 0.8 }}>{h.subtitle}</div> : null}
                        </button>
                      ))}
                      {graphHits.length > 25 ? (
                        <div style={{ fontSize: 12, opacity: 0.75 }}>Showing first 25 results. Refine your search to narrow down.</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <AnalyzePlanGraph
                  nodes={(graphView?.nodes ?? graph.nodes).map((n) => ({
                    ...n,
                    data: { ...n.data, hasChildren: (childrenById.get(n.id)?.length ?? 0) > 0 },
                  }))}
                  edges={graphView?.edges ?? graph.edges}
                  selectedNodeId={selectedNodeId}
                  onSelectNodeId={(id) => jumpToNodeId(id)}
                  onToggleCollapse={(id) => {
                    setCollapsed((prev) => {
                      const prevVisible = graph ? applyGraphView(graph, { collapsed: prev, searchTerm: graphSearch }, selectedNodeId).nodes.length : 0
                      const next = toggleCollapsed(prev, id)
                      // If current selection is now hidden, select the collapsed node.
                      const view = graph ? applyGraphView(graph, { collapsed: next, searchTerm: graphSearch }, selectedNodeId) : null
                      if (selectedNodeId && view && !view.nodes.some((n) => n.id === selectedNodeId)) setSelectedNodeId(id)
                      const nextVisible = view?.nodes.length ?? prevVisible
                      if (shouldAutoFitOnVisibilityChange(prevVisible, nextVisible)) setReframeToken((x) => x + 1)
                      return next
                    })
                  }}
                  reframeToken={reframeToken}
                />
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                  Legend: <span style={{ fontFamily: 'var(--mono)' }}>hot ex</span> = exclusive runtime hotspot,{' '}
                  <span style={{ fontFamily: 'var(--mono)' }}>hot reads</span> = shared-read hotspot.
                </div>
              </>
            ) : rootId ? (
              <TreeNode nodeId={rootId} />
            ) : null}
          </div>
        ) : null}
      </section>

      <aside style={{ minWidth: 0 }}>
        {analysis && topOptimizationSuggestions.length > 0 ? (
          <section style={{ marginBottom: 16 }} aria-label="Optimization suggestions">
            <h2 style={{ marginTop: 0 }}>Optimization suggestions</h2>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
              Evidence-linked next steps—not guaranteed fixes. Expand for rationale, cautions, and validation.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topOptimizationSuggestions.map((s) => {
                const expanded = expandedOptimizationId === s.suggestionId
                const target = (s.targetNodeIds ?? [])[0]
                return (
                  <div
                    key={s.suggestionId}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'color-mix(in srgb, var(--accent-bg) 12%, transparent)',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.35 }}>{s.title}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid var(--border)',
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        {optimizationCategoryLabel(s.category)}
                      </span>
                      <span style={{ fontSize: 11, opacity: 0.85 }}>{suggestionConfidenceLabel(s.confidence)}</span>
                      <span style={{ fontSize: 11, opacity: 0.85 }}>{suggestionPriorityLabel(s.priority)}</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.92 }}>{s.summary}</div>
                    {s.validationSteps?.length ? (
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.88 }}>
                        <b>Validate by:</b> {s.validationSteps[0]}
                        {s.validationSteps.length > 1 ? ` (+${s.validationSteps.length - 1} more)` : ''}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {target ? (
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(target)}
                          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
                        >
                          Show node {target}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setExpandedOptimizationId(expanded ? null : s.suggestionId)}
                        style={{ fontSize: 12, padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
                      >
                        {expanded ? 'Hide detail' : 'Why + cautions'}
                      </button>
                    </div>
                    {expanded ? (
                      <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
                        <div style={{ marginBottom: 8 }}>
                          <b>Rationale:</b> {s.rationale}
                        </div>
                        {s.details ? (
                          <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                            <b>Details:</b> {s.details}
                          </div>
                        ) : null}
                        {s.cautions?.length ? (
                          <div style={{ marginBottom: 8 }}>
                            <b>Cautions:</b>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                              {s.cautions.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {s.validationSteps?.length ? (
                          <div>
                            <b>Validation steps:</b>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                              {s.validationSteps.map((v) => (
                                <li key={v}>{v}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        <h2>Findings</h2>
        {analysis ? (
          <>
            <div style={{ marginBottom: 10, fontSize: 11, opacity: 0.8 }}>
              Index-related rules include seq-scan / indexing opportunities (J, F), heavy index paths (R), bitmap recheck (S), chunk+bitmap plans (P), nested-loop inner support (Q), hash join pressure (L), materialize loops (M), and sort cost (K).
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <input
                value={findingSearch}
                onChange={(e) => setFindingSearch(e.target.value)}
                placeholder="Search findings (title/summary/rule)"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-h)',
                }}
              />
              <select value={minSeverity} onChange={(e) => setMinSeverity(Number(e.target.value))} style={{ padding: '10px 12px', borderRadius: 12 }}>
                <option value={0}>Info+</option>
                <option value={1}>Low+</option>
                <option value={2}>Medium+</option>
                <option value={3}>High+</option>
                <option value={4}>Critical only</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredFindings.slice(0, 60).map((f: AnalysisFinding) => {
                const anchorId = (f.nodeIds ?? [])[0]
                return (
                <ClickableRow
                  key={f.findingId}
                  selected={!!anchorId && anchorId === selectedNodeId}
                  aria-label={`Finding: ${f.title}`}
                  onActivate={() => {
                    const target = anchorId
                    if (target) setSelectedNodeId(target)
                  }}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: 'color-mix(in srgb, var(--accent-bg) 20%, transparent)',
                    color: 'var(--text-h)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
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
                    return <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{side}</div>
                  })()}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontWeight: 800 }}>
                      [{severityLabel(f.severity)}] {f.title}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{confidenceLabel(f.confidence)}</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                    rule: <span style={{ fontFamily: 'var(--mono)' }}>{f.ruleId}</span> · category: {String(f.category)}
                  </div>
                  <div style={{ marginTop: 6 }}>{f.summary}</div>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', opacity: 0.9 }}>Evidence + explanation</summary>
                    <div style={{ marginTop: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>{f.explanation}</div>
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                      <b>Suggestion:</b> {f.suggestion}
                    </div>
                  </details>
                </ClickableRow>
                )
              })}
            </div>
            {copyFinding.status ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>{copyFinding.status}</div> : null}

            <h2 style={{ marginTop: 16 }}>Selected node</h2>
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
                        location.pathname,
                        buildAnalyzeDeepLinkSearchParams({
                          analysisId: analysis.analysisId,
                          nodeId: selectedNodeId,
                        }),
                      )
                      await copyShareLink.copy(`${window.location.origin}${path}`, 'Copied share link')
                    }}
                    style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
                  >
                    Copy share link
                  </button>
                  {copyNode.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyNode.status}</div> : null}
                  {copyShareLink.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyShareLink.status}</div> : null}
                </div>
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
                    This operator has no buffer counters in the payload (often normal for parents); check hotter children or a
                    worker-merged parent.
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
                    <div style={{ marginTop: 12 }}>
                      <b>Workers</b>
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
                          <div
                            key={r.workerNumber}
                            style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px 10px', ...cell }}
                          >
                            <div>{r.workerNumber}</div>
                            <div>{r.totalTime}</div>
                            <div>{r.rows}</div>
                            <div>{r.sharedHit}</div>
                            <div>{r.sharedRead}</div>
                            <div>{r.temp}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
                  <b>Key fields</b>
                  <pre style={{ marginTop: 6, overflow: 'auto' }}>{JSON.stringify(selectedNode.node, null, 2)}</pre>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
                  <b>Derived metrics</b>
                  <pre style={{ marginTop: 6, overflow: 'auto' }}>{JSON.stringify(selectedNode.metrics, null, 2)}</pre>
                </div>

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

            <h2 style={{ marginTop: 16 }}>Narrative</h2>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ marginTop: 0 }}>What happened</h3>
              <p style={{ marginTop: -6, whiteSpace: 'pre-wrap' }}>{analysis.narrative.whatHappened}</p>
              <h3>Where to inspect next</h3>
              {(() => {
                const hs = buildHotspots(analysis)
                if (!hs.length) {
                  const s = analysis.summary
                  const hotspotIdCount =
                    (s.topExclusiveTimeHotspotNodeIds?.length ?? 0) +
                    (s.topInclusiveTimeHotspotNodeIds?.length ?? 0) +
                    (s.topSharedReadHotspotNodeIds?.length ?? 0)
                  const anyIds = hotspotIdCount > 0
                  const msg = anyIds
                    ? 'Summary listed hotspot ids but none resolved in the current node list.'
                    : !s.hasActualTiming && !s.hasBuffers
                      ? 'No hotspots available. Use EXPLAIN (ANALYZE, BUFFERS) so timing and shared-read lists can be built.'
                      : s.hasBuffers && !s.hasActualTiming
                        ? 'No timing-based hotspots; buffer counters were detected—check shared-read hotspot ids if any.'
                        : 'No hotspot node ids were produced for this plan (sparse timing or read data).'
                  return <div style={{ opacity: 0.85 }}>{msg}</div>
                }
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    {hs.slice(0, 10).map((h) => (
                      <ClickableRow
                        key={`${h.kind}-${h.nodeId}`}
                        selected={h.nodeId === selectedNodeId}
                        aria-label={`Hotspot: ${h.label}`}
                        onActivate={() => setSelectedNodeId(h.nodeId)}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          background: 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div style={{ fontWeight: 800 }}>{h.label}</div>
                          <ReferenceCopyButton
                            aria-label="Copy hotspot reference"
                            onCopy={() =>
                              copyHotspot.copy(
                                hotspotReferenceText(
                                  h.nodeId,
                                  byId,
                                  h.kind === 'exclusiveTime'
                                    ? 'exclusive runtime hotspot'
                                    : h.kind === 'subtreeTime'
                                      ? 'subtree runtime hotspot'
                                      : 'shared reads hotspot',
                                ),
                                'Copied hotspot reference',
                              )
                            }
                          />
                        </div>
                        <div style={{ marginTop: 4, fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>
                          {h.kind === 'exclusiveTime' ? 'exclusive runtime' : h.kind === 'subtreeTime' ? 'subtree runtime' : 'shared reads'}
                          {h.evidence ? ` · ${h.evidence}` : ''}
                        </div>
                      </ClickableRow>
                    ))}
                  </div>
                )
              })()}
              {copyHotspot.status ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>{copyHotspot.status}</div> : null}

              {analysis.queryText ? (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: 'pointer' }}>Source query</summary>
                  <pre style={{ marginTop: 8, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{analysis.queryText}</pre>
                </details>
              ) : null}
            </div>
          </>
        ) : (
          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', opacity: 0.9 }}>
            Paste a plan and click <b>Analyze</b>.
          </div>
        )}
      </aside>
    </div>
  )
}

