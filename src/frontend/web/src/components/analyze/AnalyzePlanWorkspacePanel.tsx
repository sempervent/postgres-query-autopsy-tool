import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { AnalyzedPlanNode } from '../../api/types'
import type { AnalyzeGraph } from '../../presentation/analyzeGraphAdapter'
import type { AnalyzeGraphSearchHit } from '../../presentation/analyzeGraphState'
import { AnalyzePlanGraphLazy, prefetchAnalyzePlanGraph } from '../AnalyzePlanGraphLazy'
import { applyGraphView, shouldAutoFitOnVisibilityChange, toggleCollapsed } from '../../presentation/analyzeGraphState'
import { AnalyzePlanTextTree } from './AnalyzePlanTextTree'
import type { AnalyzeWorkspaceLayoutApi } from '../../analyzeWorkspace/useAnalyzeWorkspaceLayout'
import { AnalyzeWorkspaceCustomizer } from './AnalyzeWorkspaceCustomizer'

export function AnalyzePlanWorkspacePanel(props: {
  layoutApi: AnalyzeWorkspaceLayoutApi
  /** Plan guide sits beside this panel in the same grid row (medium/wide). */
  pairedWithGuide?: boolean
  analysis: import('../../api/types').PlanAnalysisResult
  treeMode: 'graph' | 'text'
  setTreeMode: (m: 'graph' | 'text') => void
  nodeSearch: string
  setNodeSearch: (v: string) => void
  graph: AnalyzeGraph | null
  graphView: ReturnType<typeof applyGraphView> | null
  graphHits: AnalyzeGraphSearchHit[]
  graphSearch: string
  setGraphSearch: (v: string) => void
  setMatchIdx: (i: number | ((n: number) => number)) => void
  matchIdx: number
  selectGraphHit: (i: number) => void
  jumpToNodeId: (id: string) => void
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
  collapsed: Set<string>
  setCollapsed: Dispatch<SetStateAction<Set<string>>>
  reframeToken: number
  setReframeToken: Dispatch<SetStateAction<number>>
  childrenById: Map<string, string[]>
  rootId: string | null
  nodeLabel: (n: AnalyzedPlanNode) => string
}) {
  const {
    layoutApi,
    pairedWithGuide = false,
    treeMode,
    setTreeMode,
    nodeSearch,
    setNodeSearch,
    graph,
    graphView,
    graphHits,
    graphSearch,
    setGraphSearch,
    setMatchIdx,
    matchIdx,
    selectGraphHit,
    jumpToNodeId,
    selectedNodeId,
    setSelectedNodeId,
    setCollapsed,
    reframeToken,
    setReframeToken,
    childrenById,
    rootId,
    nodeLabel,
    analysis,
  } = props

  const byId = new Map(analysis.nodes.map((n) => [n.nodeId, n]))

  useEffect(() => {
    if (treeMode !== 'graph' || !graph) return
    const hasRic = typeof window.requestIdleCallback === 'function'
    const handle = hasRic
      ? window.requestIdleCallback(() => prefetchAnalyzePlanGraph(), { timeout: 4500 })
      : window.setTimeout(() => prefetchAnalyzePlanGraph(), 2000)
    return () => {
      if (hasRic && typeof handle === 'number') window.cancelIdleCallback(handle)
      else window.clearTimeout(handle as number)
    }
  }, [treeMode, graph])

  const investigationBandStyle = pairedWithGuide
    ? { flex: 1, minHeight: 0, display: 'flex' as const, flexDirection: 'column' as const }
    : undefined

  return (
    <div
      className={`pqat-panel pqat-panel--workspace${pairedWithGuide ? ' pqat-planWorkspaceShell' : ''}`}
      style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '18px 20px',
        ...(pairedWithGuide ? { height: '100%', minHeight: 0 } : {}),
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="pqat-eyebrow">Investigation</div>
          <h2 style={{ margin: 0 }}>Plan workspace</h2>
        </div>
        <div style={{ minWidth: 200, flex: '1 1 220px' }}>
          <AnalyzeWorkspaceCustomizer api={layoutApi} />
        </div>
      </div>
      <p className="pqat-hint">
        Narrative and inspect-next sit beside the graph on wide screens; narrow view stacks the guide under the graph. Use <b>Customize workspace</b> to show, hide, or reorder panels—preferences persist locally; with auth + API credentials they also sync to your account.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
        <div className="pqat-seg" role="group" aria-label="Plan view mode">
          <button
            type="button"
            className={`pqat-seg__btn${treeMode === 'graph' ? ' pqat-seg__btn--active' : ''}`}
            onClick={() => setTreeMode('graph')}
            onMouseEnter={() => prefetchAnalyzePlanGraph()}
            onFocus={() => prefetchAnalyzePlanGraph()}
          >
            Graph
          </button>
          <button
            type="button"
            className={`pqat-seg__btn${treeMode === 'text' ? ' pqat-seg__btn--active' : ''}`}
            onClick={() => setTreeMode('text')}
          >
            Text
          </button>
        </div>
        <div className="pqat-hint" style={{ margin: 0 }}>
          Tip: inspect-next and findings jump the graph selection.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <input
          className="pqat-input"
          value={nodeSearch}
          onChange={(e) => setNodeSearch(e.target.value)}
          placeholder="Search nodes (type/relation/index)"
        />
      </div>
      {treeMode === 'graph' && graph ? (
        <div style={investigationBandStyle}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <input
              className="pqat-input"
              value={graphSearch}
              onChange={(e) => {
                setGraphSearch(e.target.value)
                setMatchIdx(0)
              }}
              placeholder="Graph search (operator / relation / index)"
              style={{ flex: 1, minWidth: 220 }}
            />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
              {graphSearch.trim().length ? `${graphHits.length} match${graphHits.length === 1 ? '' : 'es'}` : ''}
            </div>
            <button
              type="button"
              className="pqat-btn pqat-btn--sm"
              onClick={() => selectGraphHit(matchIdx - 1)}
              disabled={!graphHits.length}
            >
              prev
            </button>
            <button
              type="button"
              className="pqat-btn pqat-btn--sm"
              onClick={() => selectGraphHit(matchIdx + 1)}
              disabled={!graphHits.length}
            >
              next
            </button>
          </div>
          {graphSearch.trim().length && graphHits.length ? (
            <div
              className="pqat-panel pqat-panel--tool"
              style={{
                marginBottom: 8,
                padding: 12,
                maxHeight: 220,
                overflow: 'auto',
              }}
            >
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>Matches (click to jump)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {graphHits.slice(0, 25).map((h, i) => (
                  <button
                    type="button"
                    key={h.nodeId}
                    onClick={() => jumpToNodeId(h.nodeId)}
                    className="pqat-btn pqat-btn--ghost pqat-btn--sm"
                    style={{
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      width: '100%',
                      border: i === matchIdx ? '1px solid var(--accent-border)' : '1px solid var(--border-subtle)',
                      background: i === matchIdx ? 'color-mix(in srgb, var(--accent-bg) 40%, transparent)' : 'transparent',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{h.label}</div>
                    {h.subtitle ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{h.subtitle}</div> : null}
                  </button>
                ))}
                {graphHits.length > 25 ? (
                  <div className="pqat-hint" style={{ margin: 0 }}>
                    Showing first 25 results. Refine your search to narrow down.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <AnalyzePlanGraphLazy
            graphFillColumn={pairedWithGuide}
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
                const view = graph ? applyGraphView(graph, { collapsed: next, searchTerm: graphSearch }, selectedNodeId) : null
                if (selectedNodeId && view && !view.nodes.some((n) => n.id === selectedNodeId)) setSelectedNodeId(id)
                const nextVisible = view?.nodes.length ?? prevVisible
                if (shouldAutoFitOnVisibilityChange(prevVisible, nextVisible)) setReframeToken((x) => x + 1)
                return next
              })
            }}
            reframeToken={reframeToken}
          />
          <p className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Legend: <span style={{ fontFamily: 'var(--mono)' }}>hot ex</span> = exclusive runtime hotspot,{' '}
            <span style={{ fontFamily: 'var(--mono)' }}>hot reads</span> = shared-read hotspot.
          </p>
        </div>
      ) : rootId ? (
        pairedWithGuide ? (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <AnalyzePlanTextTree
              rootId={rootId}
              byId={byId}
              childrenById={childrenById}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
              nodeSearch={nodeSearch}
              nodeLabel={nodeLabel}
            />
          </div>
        ) : (
          <AnalyzePlanTextTree
            rootId={rootId}
            byId={byId}
            childrenById={childrenById}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            nodeSearch={nodeSearch}
            nodeLabel={nodeLabel}
          />
        )
      ) : null}
    </div>
  )
}
