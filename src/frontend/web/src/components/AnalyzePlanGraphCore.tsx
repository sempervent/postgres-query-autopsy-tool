import { useEffect, useMemo } from 'react'
import ReactFlow, { Background, Controls, type NodeTypes, useReactFlow } from 'reactflow'
import type { AnalyzeGraphNodeData } from '../presentation/analyzeGraphAdapter'

import 'reactflow/dist/style.css'

export type AnalyzePlanGraphCoreProps = {
  nodes: { id: string; type?: string; position: { x: number; y: number }; data: AnalyzeGraphNodeData }[]
  edges: { id: string; source: string; target: string; type?: string }[]
  selectedNodeId: string | null
  onSelectNodeId: (nodeId: string) => void
  onToggleCollapse: (nodeId: string) => void
  reframeToken: number
  graphHeight?: string
}

/** React Flow canvas + toolbar (heavy chunk — load via `AnalyzePlanGraphLazy`). */
export function AnalyzePlanGraphCore({
  nodes,
  edges,
  selectedNodeId,
  onSelectNodeId,
  onToggleCollapse,
  reframeToken,
  graphHeight = 'clamp(360px, 48vh, 620px)',
}: AnalyzePlanGraphCoreProps) {
  const nodeTypes: NodeTypes = useMemo(() => ({ analyzePlanNode: AnalyzePlanNode }), [])
  const decoratedNodes = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, onToggleCollapse } })), [nodes, onToggleCollapse])

  return (
    <div className="pqat-graphFrame" style={{ height: graphHeight, minHeight: 320 }}>
      <ReactFlow
        nodes={decoratedNodes as any}
        edges={edges as any}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => onSelectNodeId(String(n.id))}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <GraphToolbar selectedNodeId={selectedNodeId} />
        <GraphSync selectedNodeId={selectedNodeId} reframeToken={reframeToken} />
        <Background gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

function GraphSync({ selectedNodeId, reframeToken }: { selectedNodeId: string | null; reframeToken: number }) {
  const rf = useReactFlow()
  useEffect(() => {
    if (!selectedNodeId) return
    const n = rf.getNode(selectedNodeId)
    if (!n) return
    rf.setCenter(n.position.x + 130, n.position.y + 37, { zoom: 1.05, duration: 250 })
  }, [selectedNodeId, rf])

  useEffect(() => {
    if (reframeToken <= 0) return
    rf.fitView({ padding: 0.12, duration: 250 })
  }, [reframeToken, rf])
  return null
}

function GraphToolbar({ selectedNodeId }: { selectedNodeId: string | null }) {
  const rf = useReactFlow()

  function fit() {
    rf.fitView({ padding: 0.12, duration: 250 })
  }

  function focusSelected() {
    if (!selectedNodeId) return
    const n = rf.getNode(selectedNodeId)
    if (!n) return
    rf.setCenter(n.position.x + 130, n.position.y + 37, { zoom: Math.max(rf.getZoom(), 1.05), duration: 250 })
  }

  function reset() {
    rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 250 })
  }

  return (
    <div
      className="pqat-graphToolbar"
      style={{
        position: 'absolute',
        left: 10,
        top: 10,
        zIndex: 20,
      }}
    >
      <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--ghost" onClick={fit}>
        Fit
      </button>
      <button
        type="button"
        className="pqat-btn pqat-btn--sm pqat-btn--ghost"
        onClick={focusSelected}
        disabled={!selectedNodeId}
        style={{ opacity: selectedNodeId ? 1 : 0.55 }}
      >
        Focus
      </button>
      <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--ghost" onClick={reset}>
        Reset
      </button>
      <details className="pqat-details">
        <summary>Legend</summary>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div>
            <span style={{ fontFamily: 'var(--mono)' }}>hot ex</span>, <span style={{ fontFamily: 'var(--mono)' }}>hot subtree</span>,{' '}
            <span style={{ fontFamily: 'var(--mono)' }}>hot reads</span>
          </div>
          <div>
            <span style={{ fontFamily: 'var(--mono)' }}>▾</span> collapse/expand subtree
          </div>
          <div>Search highlights matches; non-matches are dimmed.</div>
        </div>
      </details>
    </div>
  )
}

function AnalyzePlanNode({
  data,
  selected,
}: {
  data: AnalyzeGraphNodeData & {
    isSearchMatch?: boolean
    isSearchDim?: boolean
    isCollapsed?: boolean
    hasChildren?: boolean
    onToggleCollapse?: (id: string) => void
  }
  selected: boolean
}) {
  const border = selected
    ? '2px solid var(--accent-border)'
    : data.severityMax != null && severityRank(data.severityMax) >= 3
      ? '1px solid color-mix(in srgb, #ef4444 45%, var(--border))'
      : '1px solid var(--border)'

  const bg =
    data.isHotExclusive || data.isHotReads || data.isHotSubtree
      ? 'color-mix(in srgb, var(--accent-bg) 32%, transparent)'
      : 'transparent'

  const opacity = data.isSearchDim ? 0.25 : 1
  const ring = data.isSearchMatch && !selected ? '0 0 0 2px color-mix(in srgb, #f59e0b 45%, transparent)' : 'none'

  const hotBadges: string[] = []
  if (data.isHotExclusive) hotBadges.push('hot ex')
  if (data.isHotSubtree) hotBadges.push('hot subtree')
  if (data.isHotReads) hotBadges.push('hot reads')

  return (
    <div style={{ width: 260, height: 74, padding: 10, borderRadius: 12, border, background: bg, opacity, boxShadow: ring }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {data.onToggleCollapse ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                data.onToggleCollapse?.(data.nodeId)
              }}
              title={data.isCollapsed ? 'Expand subtree' : 'Collapse subtree'}
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                lineHeight: '16px',
                opacity: data.hasChildren ? 1 : 0.35,
              }}
              disabled={!data.hasChildren}
            >
              {data.isCollapsed ? '▸' : '▾'}
            </button>
          ) : null}
          <div style={{ fontWeight: 900, fontSize: 12, lineHeight: 1.2, maxWidth: 186, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.label}
          </div>
          {hotBadges.length ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.85, whiteSpace: 'nowrap' }}>{hotBadges[0]}</div>
          ) : null}
        </div>
      </div>
      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {data.kindChips.map((c) => (
          <span
            key={c}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              opacity: 0.9,
            }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

function severityRank(sev: number): number {
  return sev
}
