import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { AnalyzedPlanNode } from '../../api/types'
import type { AnalyzeGraph } from '../../presentation/analyzeGraphAdapter'
import type { AnalyzeGraphSearchHit } from '../../presentation/analyzeGraphState'
import { AnalyzePlanGraphLazy, prefetchAnalyzePlanGraph } from '../AnalyzePlanGraphLazy'
import { applyGraphView, shouldAutoFitOnVisibilityChange, toggleCollapsed } from '../../presentation/analyzeGraphState'
import { AnalyzePlanTextTree } from './AnalyzePlanTextTree'
import type { AnalyzeWorkspaceLayoutApi } from '../../analyzeWorkspace/useAnalyzeWorkspaceLayout'
import { AnalyzeWorkspaceCustomizer } from './AnalyzeWorkspaceCustomizer'
import { AnalyzeGraphIssueSummary } from './AnalyzeGraphIssueSummary'
import { AnalyzeLocalFindingsShelf } from './AnalyzeLocalFindingsShelf'
import { SkipToRankedFindingsLink } from './SkipToRankedFindingsLink'

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
  findingsForSelectedNode: import('../../api/types').AnalysisFinding[]
  onSeeFindingInRankedList: (findingId: string) => void
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
  collapsed: Set<string>
  setCollapsed: Dispatch<SetStateAction<Set<string>>>
  reframeToken: number
  setReframeToken: Dispatch<SetStateAction<number>>
  childrenById: Map<string, string[]>
  rootId: string | null
  nodeLabel: (n: AnalyzedPlanNode) => string
  /** When Ranked column is visible, offer skip link after local evidence (Phase 126). */
  showSkipToRankedFindings?: boolean
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
    findingsForSelectedNode,
    onSeeFindingInRankedList,
    selectedNodeId,
    setSelectedNodeId,
    setCollapsed,
    reframeToken,
    setReframeToken,
    childrenById,
    rootId,
    nodeLabel,
    analysis,
    showSkipToRankedFindings = false,
  } = props

  const byId = new Map(analysis.nodes.map((n) => [n.nodeId, n]))
  const selectedPlanNode = selectedNodeId ? (byId.get(selectedNodeId) ?? null) : null
  const operatorLabel = selectedPlanNode ? nodeLabel(selectedPlanNode) : null

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
        <b>Customize workspace</b> controls which panels appear and in what order (saved per device; syncs with account when signed in).
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
        <div className="pqat-help-inline" style={{ margin: 0, flex: '1 1 200px' }} data-testid="analyze-plan-view-mode-hint">
          <strong>Graph</strong> or <strong>Text</strong> — same selection; the readout under the plan shows what matters for the node you pick.
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
          <p className="pqat-hint pqat-graphLegendHint" style={{ marginTop: 0, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--mono)' }}>hot ex</span> exclusive time ·{' '}
            <span style={{ fontFamily: 'var(--mono)' }}>hot reads</span> buffer read pressure
          </p>
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
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>Matches (click to select)</div>
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
          <div
            className={`pqat-graphInvestigationStack${pairedWithGuide ? ' pqat-graphInvestigationStack--fillsColumn' : ''}`}
          >
            <AnalyzePlanGraphLazy
            graphFillColumn={pairedWithGuide}
            graphHeight="clamp(240px, 30vh, 420px)"
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
            {selectedNodeId ? (
              <>
                <AnalyzeGraphIssueSummary
                  findingsForSelectedNode={findingsForSelectedNode}
                  operatorLabel={operatorLabel}
                />
                <AnalyzeLocalFindingsShelf
                  variant="workspace"
                  compactWorkspacePreview
                  findings={findingsForSelectedNode}
                  onSeeInRankedList={onSeeFindingInRankedList}
                  testId="analyze-graph-local-findings-shelf"
                />
              </>
            ) : null}
          </div>
          <SkipToRankedFindingsLink visible={Boolean(selectedNodeId && showSkipToRankedFindings)} />
        </div>
      ) : rootId ? (
        pairedWithGuide ? (
          <div className="pqat-planTextTreeBand">
            <AnalyzePlanTextTree
              rootId={rootId}
              byId={byId}
              childrenById={childrenById}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
              nodeSearch={nodeSearch}
              nodeLabel={nodeLabel}
            />
            {selectedNodeId ? (
              <>
                <AnalyzeGraphIssueSummary
                  findingsForSelectedNode={findingsForSelectedNode}
                  operatorLabel={operatorLabel}
                />
                <AnalyzeLocalFindingsShelf
                  variant="workspace"
                  compactWorkspacePreview
                  findings={findingsForSelectedNode}
                  onSeeInRankedList={onSeeFindingInRankedList}
                  testId="analyze-graph-local-findings-shelf"
                />
              </>
            ) : null}
            <SkipToRankedFindingsLink visible={Boolean(selectedNodeId && showSkipToRankedFindings)} />
          </div>
        ) : (
          <>
            <AnalyzePlanTextTree
              rootId={rootId}
              byId={byId}
              childrenById={childrenById}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
              nodeSearch={nodeSearch}
              nodeLabel={nodeLabel}
            />
            {selectedNodeId ? (
              <>
                <AnalyzeGraphIssueSummary
                  findingsForSelectedNode={findingsForSelectedNode}
                  operatorLabel={operatorLabel}
                />
                <AnalyzeLocalFindingsShelf
                  variant="workspace"
                  compactWorkspacePreview
                  findings={findingsForSelectedNode}
                  onSeeInRankedList={onSeeFindingInRankedList}
                  testId="analyze-graph-local-findings-shelf"
                />
              </>
            ) : null}
            <SkipToRankedFindingsLink visible={Boolean(selectedNodeId && showSkipToRankedFindings)} />
          </>
        )
      ) : null}
    </div>
  )
}
