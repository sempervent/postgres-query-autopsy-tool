import { useMemo, useState } from 'react'
import type { AnalysisFinding, AnalyzedPlanNode, PlanAnalysisResult } from '../api/types'
import { analyzePlanWithQuery, exportHtml, exportJson, exportMarkdown } from '../api/client'
import { findingAnchorLabel, joinLabelAndSubtitle, nodeShortLabel } from '../presentation/nodeLabels'
import { joinSideContextLineForNode } from '../presentation/joinPainHints'
import { buildHotspots } from '../presentation/hotspotPresentation'
import { buildAnalyzeGraph } from '../presentation/analyzeGraphAdapter'
import { AnalyzePlanGraph } from '../components/AnalyzePlanGraph'
import { applyGraphView, revealPath, shouldAutoFitOnVisibilityChange, toggleCollapsed } from '../presentation/analyzeGraphState'
import { findingReferenceText, hotspotReferenceText, nodeReferenceText } from '../presentation/nodeReferences'
import { useCopyFeedback } from '../presentation/useCopyFeedback'

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
  const [input, setInput] = useState('')
  const [queryText, setQueryText] = useState('')
  const [analysis, setAnalysis] = useState<PlanAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [treeMode, setTreeMode] = useState<'graph' | 'text'>('graph')
  const [graphSearch, setGraphSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [matchIdx, setMatchIdx] = useState(0)
  const [reframeToken, setReframeToken] = useState(0)
  const [nodeSearch, setNodeSearch] = useState('')
  const [findingSearch, setFindingSearch] = useState('')
  const [minSeverity, setMinSeverity] = useState<number>(1) // default: Low+

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

  async function onAnalyze() {
    setError(null)
    setLoading(true)
    setAnalysis(null)
    setSelectedNodeId(null)
    try {
      const plan = JSON.parse(input) as unknown
      const result = await analyzePlanWithQuery(plan, queryText)
      setAnalysis(result)
      setSelectedNodeId(result.rootNodeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
          Paste PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` output (the full JSON payload).
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
            placeholder='Plan JSON: [ { "Plan": { ... } } ]'
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
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onAnalyze}
            disabled={loading || input.trim().length === 0}
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
                  nodes={analysis.summary.totalNodeCount} depth={analysis.summary.maxDepth} timing={String(analysis.summary.hasActualTiming)} buffers=
                  {String(analysis.summary.hasBuffers)}
                </div>
              </div>
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
        <h2>Findings</h2>
        {analysis ? (
          <>
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
              {filteredFindings.slice(0, 60).map((f: AnalysisFinding) => (
                <button
                  key={f.findingId}
                  onClick={() => {
                    const target = (f.nodeIds ?? [])[0]
                    if (target) setSelectedNodeId(target)
                  }}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: 'color-mix(in srgb, var(--accent-bg) 20%, transparent)',
                    color: 'var(--text-h)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                      <span style={{ fontFamily: 'var(--mono)' }}>{findingAnchorLabel((f.nodeIds ?? [])[0], byId as any)}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const nid = (f.nodeIds ?? [])[0]
                        if (!nid) return
                        copyFinding.copy(findingReferenceText(nid, byId, f.title), 'Copied finding reference')
                      }}
                      style={{ padding: '4px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 12, opacity: 0.9 }}
                      title="Copy finding reference"
                    >
                      Copy
                    </button>
                  </div>
                  {(() => {
                    const nid = (f.nodeIds ?? [])[0]
                    if (!nid) return null
                    const n = byId.get(nid) ?? null
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
                </button>
              ))}
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
                  {copyNode.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyNode.status}</div> : null}
                </div>
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: 'pointer', opacity: 0.85 }}>Debug node id</summary>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9, marginTop: 6 }}>{selectedNode.nodeId}</div>
                </details>
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
                if (!hs.length) return <div style={{ opacity: 0.85 }}>No hotspots available (missing timing/buffer fields).</div>
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    {hs.slice(0, 10).map((h) => (
                      <button
                        key={`${h.kind}-${h.nodeId}`}
                        onClick={() => setSelectedNodeId(h.nodeId)}
                        style={{ textAlign: 'left', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div style={{ fontWeight: 800 }}>{h.label}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyHotspot.copy(
                                hotspotReferenceText(
                                  h.nodeId,
                                  byId,
                                  h.kind === 'exclusiveTime' ? 'exclusive runtime hotspot' : h.kind === 'subtreeTime' ? 'subtree runtime hotspot' : 'shared reads hotspot',
                                ),
                                'Copied hotspot reference',
                              )
                            }}
                            style={{ padding: '4px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 12, opacity: 0.9 }}
                            title="Copy hotspot reference"
                          >
                            Copy
                          </button>
                        </div>
                        <div style={{ marginTop: 4, fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>
                          {h.kind === 'exclusiveTime' ? 'exclusive runtime' : h.kind === 'subtreeTime' ? 'subtree runtime' : 'shared reads'}
                          {h.evidence ? ` · ${h.evidence}` : ''}
                        </div>
                      </button>
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

