import { useMemo, useState } from 'react'
import type { AnalysisFinding, AnalyzedPlanNode, PlanAnalysisResult } from '../api/types'
import { analyzePlan, exportHtml, exportJson, exportMarkdown } from '../api/client'
import { findingAnchorLabel, joinLabelAndSubtitle, nodeShortLabel } from '../presentation/nodeLabels'

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
  const [analysis, setAnalysis] = useState<PlanAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
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

  async function onAnalyze() {
    setError(null)
    setLoading(true)
    setAnalysis(null)
    setSelectedNodeId(null)
    try {
      const plan = JSON.parse(input) as unknown
      const result = await analyzePlan(plan)
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
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 240,
            padding: 12,
            borderRadius: 12,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
            fontFamily: 'var(--mono)',
          }}
          placeholder='[\n  {\n    "Plan": { ... }\n  }\n]'
        />
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
            {rootId ? <TreeNode nodeId={rootId} /> : null}
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
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    <span style={{ fontFamily: 'var(--mono)' }}>
                      {findingAnchorLabel((f.nodeIds ?? [])[0], byId as any)}
                    </span>
                  </div>
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

            <h2 style={{ marginTop: 16 }}>Selected node</h2>
            {selectedNode ? (
              <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 900 }}>{nodeLabel(selectedNode)}</div>
                {(() => {
                  const js = joinLabelAndSubtitle(selectedNode, byId)
                  if (!js?.subtitle) return null
                  return <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{js.subtitle}</div>
                })()}
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
              <h3>Where time went</h3>
              <p style={{ marginTop: -6, whiteSpace: 'pre-wrap' }}>{analysis.narrative.whereTimeWent}</p>
              <h3>What likely matters</h3>
              <p style={{ marginTop: -6, whiteSpace: 'pre-wrap' }}>{analysis.narrative.whatLikelyMatters}</p>
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

