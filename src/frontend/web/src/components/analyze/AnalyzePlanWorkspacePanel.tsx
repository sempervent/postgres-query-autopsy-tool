import type { Dispatch, SetStateAction } from 'react'
import type { AnalyzedPlanNode } from '../../api/types'
import type { AnalyzeGraph } from '../../presentation/analyzeGraphAdapter'
import type { AnalyzeGraphSearchHit } from '../../presentation/analyzeGraphState'
import { AnalyzePlanGraph } from '../AnalyzePlanGraph'
import { applyGraphView, shouldAutoFitOnVisibilityChange, toggleCollapsed } from '../../presentation/analyzeGraphState'
import { AnalyzePlanTextTree } from './AnalyzePlanTextTree'
import type { AnalyzeWorkspaceLayoutApi } from '../../analyzeWorkspace/useAnalyzeWorkspaceLayout'
import { AnalyzeWorkspaceCustomizer } from './AnalyzeWorkspaceCustomizer'

export function AnalyzePlanWorkspacePanel(props: {
  layoutApi: AnalyzeWorkspaceLayoutApi
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

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Plan workspace</h2>
        <div style={{ minWidth: 200, flex: '1 1 220px' }}>
          <AnalyzeWorkspaceCustomizer api={layoutApi} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.82 }}>
        Narrative and inspect-next sit beside the graph on wide screens; narrow view stacks the guide under the graph. Use <b>Customize workspace</b> to show, hide, or reorder panels—preferences persist locally; with auth + API credentials they also sync to your account.
      </p>
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
        <div style={{ opacity: 0.8, fontSize: 12 }}>Tip: inspect-next and findings jump the graph selection.</div>
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
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                cursor: graphHits.length ? 'pointer' : 'not-allowed',
                opacity: graphHits.length ? 1 : 0.5,
              }}
            >
              prev
            </button>
            <button
              onClick={() => selectGraphHit(matchIdx + 1)}
              disabled={!graphHits.length}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                cursor: graphHits.length ? 'pointer' : 'not-allowed',
                opacity: graphHits.length ? 1 : 0.5,
              }}
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
        <AnalyzePlanTextTree
          rootId={rootId}
          byId={byId}
          childrenById={childrenById}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          nodeSearch={nodeSearch}
          nodeLabel={nodeLabel}
        />
      ) : null}
    </div>
  )
}
